// ==============================================================================
// CORE ORCHESTRATOR: AI SERVICE
// ==============================================================================
// This file acts as the main "Router" for our platform.
// A client request hits our API -> Our API calls `processImage()` here.
// This handles billing first, then sends the payload to the right Provider.

import { createServerSupabaseClient } from './supabase-server';
import { GenerateImagePayload, GenerateImageResponse } from './services/ai/types';
import { GeminiProvider, FalProvider, ReplicateProvider } from './services/ai';
import { getFeatureCost } from './feature-registry';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Upload provider output (URL or raw bytes) and mark generation completed. */
async function persistCompletedGenerationOutput(
  supabase: SupabaseClient,
  userId: string,
  generationId: string,
  response: GenerateImageResponse
): Promise<string | undefined> {
  if (response.status !== 'completed') {
    return undefined;
  }

  let outputUrl = response.outputUrl;

  if (!outputUrl && response.outputBase64 && response.outputMimeType) {
    const mime = response.outputMimeType;
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
    const path = `${userId}/gen_${generationId}.${ext}`;
    const buffer = Buffer.from(response.outputBase64, 'base64');
    const { error: uploadError } = await supabase.storage.from('images').upload(path, buffer, {
      contentType: mime,
    });
    if (uploadError) {
      console.error('[persistCompletedGenerationOutput] Storage upload failed:', uploadError);
      throw new Error('Failed to save generated image to storage.');
    }
    const { data: pub } = supabase.storage.from('images').getPublicUrl(path);
    outputUrl = pub.publicUrl;
  }

  if (outputUrl) {
    await supabase
      .from('generations')
      .update({
        status: 'completed',
        output_image_url: outputUrl,
      })
      .eq('id', generationId);
  }

  return outputUrl;
}

/**
 * processImage is the central function that handles a new AI Request from a user.
 *
 * @param payload The configured prompt and parameters.
 * @param modelId The database UUID of the AI Model selected.
 * @param userId  The database UUID of the User making the request.
 */
export async function processImage(payload: GenerateImagePayload, modelId: string, userId: string) {
  const processStart = Date.now();

  // 1. Initialize our secure Supabase connection
  const supabase = await createServerSupabaseClient();

  // 2. Look up the Model to retrieve its Provider Name and Cost
  const { data: modelData, error: modelError } = await supabase
    .from('models')
    .select('provider, credit_cost')
    .eq('id', modelId)
    .single();

  if (modelError || !modelData) {
    throw new Error('Failed to find the specified AI Model.');
  }

  // 2b. Feature Registry Override (Option C — use the higher of model vs registry cost)
  // This allows admins to set a floor price for all template generations via the
  // Pricing Engine, while model-specific costs still apply when they're higher.
  let effectiveCost = modelData.credit_cost;
  try {
    const registryCost = await getFeatureCost('photo-templates');
    effectiveCost = Math.max(modelData.credit_cost, registryCost);
  } catch (registryErr: any) {
    // If the feature is explicitly disabled in the registry, block the operation
    if (registryErr?.name === 'FeatureDisabledError') {
      throw new Error('Template generation is temporarily unavailable.');
    }
    // Otherwise, fall back to model cost (backwards-compatible)
    console.warn('[ai-service] Feature registry lookup failed, using model cost:', registryErr?.message);
  }

  // 3. ✨ ATOMIC TRANSACTION ✨
  // This is the most crucial part of this flow. By using `rpc()`, we invoke the
  // PostgreSQL function `create_generation_and_deduct_credits`.
  // It performs a row-level lock -> checks balance -> deducts credits -> creates the generation row.
  // We MUST do this simultaneously so users can't spam requests and bypass limits.
  const { data: generationId, error: rpcError } = await supabase.rpc(
    'create_generation_and_deduct_credits',
    {
      p_user_id: userId,
      p_model_id: modelId,
      p_cost: effectiveCost,
      p_input_image_url: payload.inputImageUrl || null
    }
  );

  if (rpcError || !generationId) {
    console.error('RPC Error:', rpcError);
    throw new Error('Transaction failed. You might not have enough credits or hit concurrency limits.');
  }

  // At this point, the credits are officially DEDUCTED, and a 'pending' generation row exists.

  // 4. Send the payload to the correct third-party API based on the Provider string.
  let response;
  try {
    switch (modelData.provider) {
      case 'google': {
        const gemini = new GeminiProvider();
        response = await gemini.execute(payload, generationId);
        break;
      }
      case 'fal': {
        const fal = new FalProvider();
        response = await fal.execute(payload, generationId);
        break;
      }
      case 'replicate': {
        const replicate = new ReplicateProvider();
        response = await replicate.execute(payload, generationId);
        break;
      }
      default:
        throw new Error(`Unsupported provider: ${modelData.provider}`);
    }

    // 5. Check if the Provider immediately failed (synchronous failure).
    // If it failed immediately, we MUST refund the user!
    if (response.status === 'failed') {
      await handleImmediateFailureAndRefund(supabase, generationId, userId, effectiveCost);
      throw new Error(response.error || 'Provider generation failed immediately.');
    }

    const finalOutputUrl = await persistCompletedGenerationOutput(
      supabase,
      userId,
      generationId,
      response
    );

    // NOTE: If status is 'pending' (like Fal/Replicate webhook), we do NOT update it here.
    // The generation record stays 'pending'. We just return the ID so the frontend can poll.

    const totalMs = Date.now() - processStart;
    console.log(`[ai-service] processImage completed total_ms=${totalMs} provider=${modelData.provider} status=${response.status}`);

    return {
      generationId,
      status: response.status,
      outputUrl: finalOutputUrl ?? response.outputUrl,
    };
  } catch (err: any) {
    // If our server crashed or the network failed before we even got a clean `response` object.
    const totalMs = Date.now() - processStart;
    console.error(`[ai-service] processImage failed total_ms=${totalMs}`, err?.message);
    await handleImmediateFailureAndRefund(supabase, generationId, userId, effectiveCost);
    throw err;
  }
}


/**
 * Atomically refunds credits and marks the generation as failed.
 * Uses an RPC function for the credit update to prevent read-then-write race conditions.
 * Falls back to a direct update if the RPC hasn't been migrated yet.
 */
async function handleImmediateFailureAndRefund(
  supabase: SupabaseClient,
  generationId: string,
  userId: string,
  refundAmount: number
) {
  // 1. Mark the generation as failed so it shows up correctly in history.
  await supabase
    .from('generations')
    .update({ status: 'failed' })
    .eq('id', generationId);

  // 2. Atomically re-award credits using a single UPDATE (no read-then-write race).
  //    The RPC `refund_generation_credits` uses:
  //      UPDATE profiles SET credits = credits + p_amount WHERE id = p_user_id
  //    This is safe under concurrent failures on the same user.
  const { error: rpcError } = await supabase.rpc('refund_generation_credits', {
    p_user_id: userId,
    p_amount: refundAmount,
  });

  if (rpcError) {
    // Fallback for environments where the migration hasn't been run yet.
    // Less safe under very high concurrency but acceptable as a temporary path.
    console.warn(
      '[ai-service] refund_generation_credits RPC not available, using fallback. ' +
      'Run supabase/migrations/20260422_atomic_refund.sql to fix this.',
      rpcError.message
    );
    const { data: userRecord } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single();

    if (userRecord) {
      await supabase
        .from('profiles')
        .update({ credits: userRecord.credits + refundAmount })
        .eq('id', userId);
    }
  }
}
