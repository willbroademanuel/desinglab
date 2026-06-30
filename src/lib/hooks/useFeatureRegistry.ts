'use client';

// ==============================================================================
// useFeatureRegistry — Client-Side Feature Pricing Hook
// ==============================================================================
// Provides real-time feature pricing data to client components.
// Subscribes to Supabase Realtime for instant price propagation.
// Falls back to periodic polling every 30s if Realtime drops.
// ==============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase';

/** Client-side feature config (subset of server FeatureConfig) */
export interface ClientFeature {
  slug: string;
  display_name: string;
  credit_cost: number;
  is_active: boolean;
  category: string;
  icon_name: string;
}

/** Map of feature slug → feature config */
export type FeatureMap = Record<string, ClientFeature>;

/** Hook return type */
interface UseFeatureRegistryReturn {
  features: FeatureMap;
  loading: boolean;
  error: string | null;
  /** Get cost for a specific feature, returns null if not found */
  getCost: (slug: string) => number | null;
  /** Get display string like "2 Credits" */
  getCostLabel: (slug: string) => string;
  /** Check if a feature is active */
  isActive: (slug: string) => boolean;
  /** Force refresh from database */
  refresh: () => Promise<void>;
}

/** Create Supabase browser client (singleton pattern) */
function getSupabaseBrowser() {
  return createClient();
}

export function useFeatureRegistry(): UseFeatureRegistryReturn {
  const [features, setFeatures] = useState<FeatureMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeChannelRef = useRef<ReturnType<ReturnType<typeof getSupabaseBrowser>['channel']> | null>(null);

  /** Fetch all features from the database */
  const fetchFeatures = useCallback(async () => {
    try {
      const supabase = getSupabaseBrowser();

      const { data, error: queryError } = await supabase
        .from('feature_registry')
        .select('slug, display_name, credit_cost, is_active, category, icon_name');

      if (queryError) {
        console.error('[useFeatureRegistry] Query error:', queryError.message);
        setError('Failed to load feature pricing');
        return;
      }

      if (data) {
        const map: FeatureMap = {};
        for (const row of data) {
          map[row.slug] = row as ClientFeature;
        }
        setFeatures(map);
        setError(null);
      }
    } catch (err) {
      console.error('[useFeatureRegistry] Fetch error:', err);
      setError('Failed to load feature pricing');
    } finally {
      setLoading(false);
    }
  }, []);

  /** Set up Supabase Realtime subscription + polling fallback */
  useEffect(() => {
    // 1. Initial fetch
    fetchFeatures();

    // 2. Subscribe to Realtime changes on feature_registry
    const supabase = getSupabaseBrowser();
    const channelId = `feature-registry-${Math.random().toString(36).substring(7)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'feature_registry',
        },
        (payload) => {
          // On any change, re-fetch the full registry
          // (simpler and safer than trying to patch individual rows)
          fetchFeatures();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Realtime connected — reduce poll frequency
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          // Still poll every 60s as a safety net
          pollIntervalRef.current = setInterval(fetchFeatures, 60_000);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Realtime failed — increase poll frequency as fallback
          console.warn('[useFeatureRegistry] Realtime subscription failed, falling back to polling');
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          pollIntervalRef.current = setInterval(fetchFeatures, 30_000);
        }
      });

    realtimeChannelRef.current = channel;

    // 3. Cleanup
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, [fetchFeatures]);

  /** Get cost for a specific feature */
  const getCost = useCallback(
    (slug: string): number | null => {
      return features[slug]?.credit_cost ?? null;
    },
    [features]
  );

  /** Get a display label like "2c" or "—" if not found */
  const getCostLabel = useCallback(
    (slug: string): string => {
      const cost = features[slug]?.credit_cost;
      if (cost === undefined || cost === null) return 'c';
      return `${cost}c`;
    },
    [features]
  );

  /** Check if a feature is currently active */
  const isActive = useCallback(
    (slug: string): boolean => {
      return features[slug]?.is_active ?? false;
    },
    [features]
  );

  return {
    features,
    loading,
    error,
    getCost,
    getCostLabel,
    isActive,
    refresh: fetchFeatures,
  };
}
