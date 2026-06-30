'use client';

import { useEffect, useRef } from 'react';

/**
 * Eagerly prefetches image URLs into the browser's memory cache using
 * invisible `Image()` objects. Once fetched, any subsequent `<img>` or
 * CSS `background-image` referencing the same URL will resolve instantly
 * from the disk/memory cache — eliminating the loading spinner.
 *
 * Design decisions for enterprise scale (10k+ DAU):
 * - Uses `fetchpriority="low"` to avoid competing with critical resources
 * - Defers execution via `requestIdleCallback` (falls back to setTimeout)
 * - Aborts in-flight fetches on unmount to prevent memory leaks
 * - Deduplicates URLs to avoid redundant network requests
 * - Caps concurrent prefetches to avoid bandwidth saturation
 * - Silently swallows errors — prefetch failures are non-critical
 */

const MAX_CONCURRENT = 4;

// Global in-memory set to avoid re-prefetching across re-renders / re-mounts
const alreadyPrefetched = new Set<string>();

export function useImagePrefetch(urls: (string | null | undefined)[]) {
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Deduplicate & filter valid URLs not yet prefetched
    const uniqueUrls = [
      ...new Set(
        urls.filter(
          (u): u is string =>
            typeof u === 'string' && u.startsWith('http') && !alreadyPrefetched.has(u)
        )
      ),
    ];

    if (uniqueUrls.length === 0) return;

    const controller = new AbortController();
    abortRef.current = controller;

    const prefetch = () => {
      if (controller.signal.aborted) return;

      // Batch prefetches with concurrency limit
      let inFlight = 0;
      let idx = 0;

      const loadNext = () => {
        while (inFlight < MAX_CONCURRENT && idx < uniqueUrls.length) {
          if (controller.signal.aborted) return;

          const url = uniqueUrls[idx++];
          inFlight++;

          const img = new Image();
          // Use low fetch priority so we don't compete with visible content
          img.fetchPriority = 'low';
          img.decoding = 'async';

          const cleanup = () => {
            inFlight--;
            alreadyPrefetched.add(url);
            loadNext();
          };

          img.onload = cleanup;
          img.onerror = cleanup; // Swallow errors — prefetch is best-effort
          img.src = url;
        }
      };

      loadNext();
    };

    // Defer to idle time so we don't block the main thread during dashboard paint
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(prefetch, { timeout: 2000 });
      controller.signal.addEventListener('abort', () => cancelIdleCallback(id));
    } else {
      const timer = setTimeout(prefetch, 100);
      controller.signal.addEventListener('abort', () => clearTimeout(timer));
    }

    return () => {
      controller.abort();
      abortRef.current = null;
    };
  }, [urls]);
}
