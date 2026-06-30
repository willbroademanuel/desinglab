import { AIProvider, GenerateImagePayload, GenerateImageResponse } from './types';

// ==============================================================================
// FAL.AI PROVIDER
// ==============================================================================

export class FalProvider implements AIProvider {
  /**
   * Fal is extremely fast, but for production systems it's best to use their
   * webhooks for guaranteed delivery and to avoid Vercel timeouts.
   */
  async execute(payload: GenerateImagePayload, generationId: string): Promise<GenerateImageResponse> {
    try {
      // TODO: Initialize Fal.ai SDK here.
      // You will pass the generationId to their webhook URL parameter so it comes back to us.
      // Example:
      // const result = await fal.subscribe("fal-ai/flux-pro", {
      //   input: { prompt: payload.prompt },
      //   webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/ai?generationId=${generationId}`
      // });
      
      console.log(`[FalProvider] Submitting job for payload:`, payload.prompt);
      
      return {
        status: 'pending',
        jobId: 'mock-fal-job-uuid'
      };
    } catch (error: any) {
      console.error('[FalProvider] Error:', error);
      return {
        status: 'failed',
        error: error.message || 'Fal API failed.'
      };
    }
  }
}
