'use client';

import { useCallback, useRef, useState } from 'react';

export interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  category: string;
  is_active: boolean;
  is_featured: boolean;
}

interface UseInfiniteTemplatesOptions {
  /** Category to filter by (omit or 'All' for no filter) */
  category?: string;
  /** Items per page (default: 20, max: 50) */
  limit?: number;
  /** Initial templates already loaded from SSR (avoids redundant first fetch) */
  initialData?: TemplateRow[];
  /** Initial total count from SSR */
  initialTotal?: number;
}

interface UseInfiniteTemplatesReturn {
  templates: TemplateRow[];
  total: number;
  isLoading: boolean;
  hasMore: boolean;
  error: string | null;
  /** Load the next page of templates */
  loadMore: () => Promise<void>;
  /** Reset and refetch from page 1 */
  reset: () => void;
}

/**
 * Infinite-scroll hook for paginated template loading.
 *
 * Features:
 * - Deduplicates in-flight requests
 * - Optimistic cache (won't re-fetch already loaded pages)
 * - AbortController for cleanup
 * - Works with SSR initial data to avoid double-fetch
 */
export function useInfiniteTemplates({
  category,
  limit = 20,
  initialData = [],
  initialTotal = 0,
}: UseInfiniteTemplatesOptions = {}): UseInfiniteTemplatesReturn {
  const [templates, setTemplates] = useState<TemplateRow[]>(initialData);
  const [total, setTotal] = useState(initialTotal);
  const [isLoading, setIsLoading] = useState(false);
  // hasMore is determined by whether we received a full page of data.
  // If initialData has fewer items than limit, this category has no more pages.
  // (initialTotal is the GLOBAL count, not per-category — so we can't use it here)
  const [hasMore, setHasMore] = useState(initialData.length >= limit);
  const [error, setError] = useState<string | null>(null);

  const pageRef = useRef(1); // Track current page (1 = initial data)
  const inFlightRef = useRef(false); // Prevent duplicate requests
  const abortRef = useRef<AbortController | null>(null);
  const loadedIdsRef = useRef<Set<string>>(new Set(initialData.map(t => t.id)));

  const loadMore = useCallback(async () => {
    if (inFlightRef.current || !hasMore) return;
    inFlightRef.current = true;
    setIsLoading(true);
    setError(null);

    // Cancel any previous in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    const nextPage = pageRef.current + 1;

    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: String(limit),
      });

      if (category && category !== 'All') {
        params.set('category', category);
      }

      const res = await fetch(`/api/templates?${params.toString()}`, {
        signal: abortRef.current.signal,
        credentials: 'same-origin',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const json = await res.json();
      const newTemplates: TemplateRow[] = json.data ?? [];

      // Deduplicate — avoid adding templates we already have
      const unique = newTemplates.filter(t => !loadedIdsRef.current.has(t.id));
      unique.forEach(t => loadedIdsRef.current.add(t.id));

      setTemplates(prev => [...prev, ...unique]);
      setTotal(json.total ?? 0);
      setHasMore(json.hasMore ?? false);
      pageRef.current = nextPage;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Request was cancelled — not an error
        return;
      }
      console.error('[useInfiniteTemplates] Load error:', err);
      setError(err.message || 'Failed to load templates');
    } finally {
      setIsLoading(false);
      inFlightRef.current = false;
    }
  }, [category, limit, hasMore]);

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    pageRef.current = 1;
    loadedIdsRef.current = new Set(initialData.map(t => t.id));
    setTemplates(initialData);
    setTotal(initialTotal);
    setHasMore(initialData.length >= limit);
    setError(null);
    setIsLoading(false);
    inFlightRef.current = false;
  }, [initialData, initialTotal]);

  return { templates, total, isLoading, hasMore, error, loadMore, reset };
}
