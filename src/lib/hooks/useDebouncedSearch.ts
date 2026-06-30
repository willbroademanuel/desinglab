'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface TemplateSearchResult {
  id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  category: string;
  is_active: boolean;
  is_featured: boolean;
}

interface UseDebouncedSearchOptions {
  /** All locally-loaded templates for instant client-side filtering */
  localTemplates: TemplateSearchResult[];
  /** Threshold: if total templates exceed this, query the server */
  serverThreshold?: number;
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number;
}

interface UseDebouncedSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  results: TemplateSearchResult[];
  isSearching: boolean;
  isServerSearch: boolean;
  clearSearch: () => void;
}

/**
 * Dual-mode debounced search hook.
 *
 * - For small template sets (≤ threshold): filters locally (instant)
 * - For larger sets or when local results are sparse: queries server
 * - Debounces to avoid excessive API calls
 * - AbortController cancels stale server requests
 */
export function useDebouncedSearch({
  localTemplates,
  serverThreshold = 100,
  debounceMs = 300,
}: UseDebouncedSearchOptions): UseDebouncedSearchReturn {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TemplateSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isServerSearch, setIsServerSearch] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build a lightweight local index (lowercase name + description)
  const localIndex = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const idx = new Map<string, string>();
    for (const t of localTemplates) {
      idx.set(t.id, `${t.name} ${t.description ?? ''}`.toLowerCase());
    }
    localIndex.current = idx;
  }, [localTemplates]);

  const performLocalSearch = useCallback(
    (q: string): TemplateSearchResult[] => {
      const lower = q.toLowerCase();
      return localTemplates.filter(t => {
        const indexed = localIndex.current.get(t.id);
        return indexed ? indexed.includes(lower) : false;
      });
    },
    [localTemplates]
  );

  const performServerSearch = useCallback(
    async (q: string, signal: AbortSignal): Promise<TemplateSearchResult[]> => {
      const params = new URLSearchParams({
        search: q,
        limit: '30',
        page: '1',
      });

      const res = await fetch(`/api/templates?${params.toString()}`, {
        signal,
        credentials: 'same-origin',
      });

      if (!res.ok) {
        throw new Error(`Search failed: HTTP ${res.status}`);
      }

      const json = await res.json();
      return json.data ?? [];
    },
    []
  );

  useEffect(() => {
    // Clear previous timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Empty query → clear results
    if (!query.trim()) {
      setResults([]);
      setIsSearching(false);
      setIsServerSearch(false);
      return;
    }

    // Always do instant local search first
    const localResults = performLocalSearch(query);
    setResults(localResults);

    // Decide if server search is needed
    const needsServer = localTemplates.length >= serverThreshold || localResults.length === 0;

    if (!needsServer) {
      setIsServerSearch(false);
      setIsSearching(false);
      return;
    }

    // Debounced server search
    setIsSearching(true);
    setIsServerSearch(true);

    timerRef.current = setTimeout(async () => {
      // Cancel previous server request
      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = new AbortController();

      try {
        const serverResults = await performServerSearch(query, abortRef.current.signal);

        // Merge server results with local (deduplicate by ID)
        const mergedMap = new Map<string, TemplateSearchResult>();
        for (const t of localResults) mergedMap.set(t.id, t);
        for (const t of serverResults) mergedMap.set(t.id, t);

        setResults(Array.from(mergedMap.values()));
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.error('[useDebouncedSearch] Server search error:', err);
        // Keep local results on server error — graceful degradation
      } finally {
        setIsSearching(false);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, localTemplates.length, serverThreshold, debounceMs, performLocalSearch, performServerSearch]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setIsSearching(false);
    setIsServerSearch(false);
    if (abortRef.current) abortRef.current.abort();
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { query, setQuery, results, isSearching, isServerSearch, clearSearch };
}
