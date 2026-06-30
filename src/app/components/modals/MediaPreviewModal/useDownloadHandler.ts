'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

/* ══════════════════════════════════════════════════════════════
   SHARED DOWNLOAD UTILITIES
   ──────────────────────────────────────────────────────────────
   Consolidated from GenerationsLibraryDropdown + GalleryClient.
   Single source of truth for all media download logic.
   ══════════════════════════════════════════════════════════════ */

export type DownloadState = 'idle' | 'downloading' | 'done';

/**
 * Download a remote media URL as a file.
 *
 * Creates a temporary object URL from the fetched blob, triggers a
 * programmatic `<a>` click, then cleans up after a 5 s delay so the
 * browser's download manager has time to read the blob URL.
 *
 * Falls back to `window.open` on CORS / network errors.
 */
export async function downloadFromUrl(
  url: string,
  baseName: string,
  isVideo: boolean = false,
  abortSignal?: AbortSignal
): Promise<void> {
  if (!url || !url.startsWith('http')) {
    console.error('[MediaPreview] Invalid URL for download:', url);
    return;
  }

  try {
    // If we have an abort signal, we can't easily pass it to the share API natively,
    // but we can pass it if we were doing the fetch ourselves. 
    // For simplicity and enterprise robustness, we delegate to the new utility.
    const { downloadMedia } = await import('@/lib/utils/downloadUtility');
    
    // Check if aborted before starting
    if (abortSignal?.aborted) return;
    
    const result = await downloadMedia(url, baseName, isVideo);
    if (!result.success) {
      console.warn('[MediaPreview] Download returned non-success:', result.error);
    }
  } catch (error: any) {
    if (error?.name === 'AbortError') return;
    console.error('[MediaPreview] Download failed:', error);
  }
}

/**
 * Hook that manages per-key download state with visual feedback.
 *
 * After a successful download the state flashes "done" for 2 s, then
 * resets to "idle". All pending timeouts are cleaned up on unmount.
 */
export function useDownloadHandler() {
  const [states, setStates] = useState<Record<string, DownloadState>>({});
  const timeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const abortRef = useRef<AbortController | null>(null);

  const trigger = useCallback(
    async (url: string, baseName: string, isVideo: boolean = false, key?: string) => {
      const stateKey = key || url;
      setStates(prev => ({ ...prev, [stateKey]: 'downloading' }));

      // Create a new AbortController for this download
      abortRef.current = new AbortController();

      try {
        await downloadFromUrl(url, baseName, isVideo, abortRef.current.signal);
        setStates(prev => ({ ...prev, [stateKey]: 'done' }));
        // Flash "done" for 2s then reset
        if (timeoutsRef.current[stateKey]) clearTimeout(timeoutsRef.current[stateKey]);
        timeoutsRef.current[stateKey] = setTimeout(() => {
          setStates(prev => ({ ...prev, [stateKey]: 'idle' }));
        }, 2000);
      } catch {
        setStates(prev => ({ ...prev, [stateKey]: 'idle' }));
      }
    },
    []
  );

  const getState = useCallback(
    (key: string): DownloadState => {
      return states[key] || 'idle';
    },
    [states]
  );

  /** Abort any in-flight download (called on unmount) */
  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Cleanup timeouts + abort on unmount
  useEffect(() => {
    const refs = timeoutsRef.current;
    return () => {
      Object.values(refs).forEach(clearTimeout);
      abortRef.current?.abort();
    };
  }, []);

  return { trigger, getState, abort };
}
