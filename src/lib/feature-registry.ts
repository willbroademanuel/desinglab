// ==============================================================================
// FEATURE REGISTRY — Server-Side Pricing Service
// ==============================================================================
// Central module for reading feature pricing from the database.
// All server actions call getFeatureCost() instead of using hardcoded constants.
//
// Design: FAIL-CLOSED — if the registry is unavailable, features are BLOCKED,
// never free. This prevents a DB blip from giving away unlimited generations.
// ==============================================================================

import { createServerSupabaseClient } from './supabase-server';

/** Shape of a feature row from the database */
export interface FeatureConfig {
  id: string;
  slug: string;
  display_name: string;
  description: string;
  credit_cost: number;
  is_active: boolean;
  category: string;
  icon_name: string;
  metadata: Record<string, unknown>;
  updated_at: string;
  updated_by: string | null;
  created_at: string;
}

/** Custom error types for precise error handling in server actions */
export class FeatureNotFoundError extends Error {
  constructor(slug: string) {
    super(`Feature "${slug}" is not registered in the pricing system.`);
    this.name = 'FeatureNotFoundError';
  }
}

export class FeatureDisabledError extends Error {
  constructor(slug: string) {
    super(`Feature "${slug}" is temporarily unavailable.`);
    this.name = 'FeatureDisabledError';
  }
}

export class InsufficientCreditsError extends Error {
  public required: number;
  public available: number;

  constructor(required: number, available: number) {
    super(`Insufficient credits. You need ${required} but have ${available}.`);
    this.name = 'InsufficientCreditsError';
    this.required = required;
    this.available = available;
  }
}

/**
 * Get the credit cost for a feature by its slug.
 *
 * FAIL-CLOSED: throws if the feature doesn't exist or is disabled.
 * This ensures we never accidentally give free generations on DB errors.
 *
 * @param slug - The unique feature identifier (e.g., 'text-to-image')
 * @returns The credit cost as an integer
 * @throws FeatureNotFoundError if slug doesn't exist
 * @throws FeatureDisabledError if feature is toggled off
 * @throws Error on database connection failures
 */
export async function getFeatureCost(slug: string): Promise<number> {
  if (!slug || typeof slug !== 'string') {
    throw new FeatureNotFoundError(slug);
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('feature_registry')
    .select('credit_cost, is_active')
    .eq('slug', slug)
    .single();

  if (error || !data) {
    console.error(`[FeatureRegistry] Failed to resolve feature "${slug}":`, error?.message);
    throw new FeatureNotFoundError(slug);
  }

  if (!data.is_active) {
    throw new FeatureDisabledError(slug);
  }

  return data.credit_cost;
}

/**
 * Atomically deduct credits for a feature using the DB-side RPC.
 * Combines feature lookup + balance check + deduction in one Postgres transaction.
 *
 * This is the preferred deduction path for new features. It reads the cost
 * directly from feature_registry inside a locked transaction, eliminating
 * any possibility of a stale cost being used.
 *
 * @param userId - The user's profile UUID
 * @param featureSlug - The feature slug to deduct for
 * @returns The amount of credits deducted (needed for refund on failure)
 * @throws FeatureNotFoundError, FeatureDisabledError, InsufficientCreditsError
 */
export async function deductCreditsForFeature(
  userId: string,
  featureSlug: string
): Promise<number> {
  const supabase = await createServerSupabaseClient();

  const { data: cost, error } = await supabase.rpc('deduct_credits_for_feature', {
    p_user_id: userId,
    p_feature_slug: featureSlug,
  });

  if (error) {
    const msg = error.message || '';

    if (msg.includes('FEATURE_NOT_FOUND')) {
      throw new FeatureNotFoundError(featureSlug);
    }
    if (msg.includes('FEATURE_DISABLED')) {
      throw new FeatureDisabledError(featureSlug);
    }
    if (msg.includes('INSUFFICIENT_CREDITS')) {
      // Parse out the numbers from the error message
      const match = msg.match(/need (\d+) credits but have (\d+)/);
      const required = match ? parseInt(match[1], 10) : 0;
      const available = match ? parseInt(match[2], 10) : 0;
      throw new InsufficientCreditsError(required, available);
    }

    console.error(`[FeatureRegistry] deduct_credits_for_feature RPC failed:`, msg);
    throw new Error(`Failed to process credits for feature "${featureSlug}". Please try again.`);
  }

  return cost as number;
}

/**
 * Fetch all active features for client-side display.
 * Returns an array of all features with their current pricing.
 *
 * Used by the useFeatureRegistry hook for hydrating credit badges.
 */
export async function getAllFeatures(): Promise<FeatureConfig[]> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('feature_registry')
    .select('*')
    .order('category', { ascending: true })
    .order('display_name', { ascending: true });

  if (error) {
    console.error('[FeatureRegistry] Failed to fetch all features:', error.message);
    return [];
  }

  return (data as FeatureConfig[]) || [];
}

/**
 * Get a single feature's full config (used by admin panel and server actions
 * that need more than just the cost).
 */
export async function getFeatureConfig(slug: string): Promise<FeatureConfig | null> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('feature_registry')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) {
    return null;
  }

  return data as FeatureConfig;
}
