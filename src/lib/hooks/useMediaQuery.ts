'use client';

import { useState, useEffect } from 'react';

/**
 * Returns `true` if the media query matches, `false` if not,
 * and `null` during SSR / before first paint.
 *
 * Returning `null` on the first render lets callers render both
 * layouts (CSS-hidden) to avoid hydration mismatch, then switch
 * to conditional rendering once the viewport is known.
 */
export function useMediaQuery(query: string): boolean | null {
  const [matches, setMatches] = useState<boolean | null>(null);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
