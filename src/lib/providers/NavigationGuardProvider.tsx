'use client';

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import { useRouter } from 'next/navigation';
import { hasActiveModal, wasModalRecentlyClosed } from '@/lib/modalSignal';

/* ════════════════════════════════════════════════════════════════
   NAVIGATION GUARD PROVIDER
   ════════════════════════════════════════════════════════════════
   
   Centralized back-button controller for the dashboard.
   
   Problems solved:
   1. Multiple popstate listeners racing each other (LogoutGuardian 
      vs useHardwareBackButton)
   2. Auth pages remaining in history stack after login/signup
   3. Phantom history.back() calls consuming trap entries
   4. Unreliable history.length checks
   
   Strategy:
   - Push a single sentinel history entry when dashboard mounts
   - Maintain a LIFO stack of active overlays
   - On popstate: close topmost overlay, or show logout modal if empty
   - Re-push sentinel after every interception to stay protected
   
   This replaces BOTH LogoutGuardian.tsx AND useHardwareBackButton.ts
   ════════════════════════════════════════════════════════════════ */

// ── Sentinel marker for our history entries ──────────────────────
const SENTINEL_KEY = '__pixtrend_nav_guard';

// ── Types ────────────────────────────────────────────────────────
interface OverlayEntry {
  id: string;
  closeFn: () => void;
  priority: number; // Higher = closer to top of stack
}

interface NavigationGuardContextType {
  /**
   * Register an overlay that should be dismissed on back press.
   * Returns an unregister function (call on unmount).
   * 
   * @param id Unique identifier for the overlay (e.g. 'expanded-category')
   * @param closeFn Function to call when back is pressed while this overlay is active
   * @param priority Number — higher priority overlays are closed first (default: 0)
   */
  registerOverlay: (id: string, closeFn: () => void, priority?: number) => () => void;

  /**
   * Manually unregister an overlay by id.
   * Normally you'd use the return from registerOverlay, but this
   * is useful for conditional cleanup.
   */
  unregisterOverlay: (id: string) => void;
}

const NavigationGuardContext = createContext<NavigationGuardContextType | null>(null);

// ── Hook for consumers ───────────────────────────────────────────
// Returns a safe no-op fallback when used outside the provider
// (e.g. during static prerendering of intercepted routes like
// @modal/(.)m/logout which render at the root layout level).
const noopUnregister = () => {};
const noopFallback: NavigationGuardContextType = {
  registerOverlay: () => noopUnregister,
  unregisterOverlay: () => {},
};

export function useNavigationGuard() {
  const ctx = useContext(NavigationGuardContext);
  return ctx ?? noopFallback;
}

// ── Provider component ───────────────────────────────────────────
export default function NavigationGuardProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  // Overlay stack — ref-based so popstate handler always sees current state
  const overlaysRef = useRef<OverlayEntry[]>([]);

  // Whether we've pushed a sentinel into the history stack
  const sentinelActiveRef = useRef(false);

  // Guard against double-firing on the same popstate event
  const handlingPopStateRef = useRef(false);

  // ── Push sentinel entry ─────────────────────────────────────
  const pushSentinel = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (sentinelActiveRef.current) return;
    
    sentinelActiveRef.current = true;
    window.history.pushState(
      { [SENTINEL_KEY]: true, ts: Date.now() },
      '',
      // Preserve current URL — we don't change the address bar
    );
  }, []);

  // ── Register/unregister overlays ────────────────────────────
  const registerOverlay = useCallback(
    (id: string, closeFn: () => void, priority: number = 0) => {
      // Remove existing registration with same id to prevent duplicates
      overlaysRef.current = overlaysRef.current.filter((e) => e.id !== id);
      overlaysRef.current.push({ id, closeFn, priority });

      // Sort by priority descending — highest priority = first to close
      overlaysRef.current.sort((a, b) => b.priority - a.priority);

      // Ensure sentinel is active when overlays exist
      pushSentinel();

      // Return unregister function
      return () => {
        overlaysRef.current = overlaysRef.current.filter((e) => e.id !== id);
      };
    },
    [pushSentinel]
  );

  const unregisterOverlay = useCallback((id: string) => {
    overlaysRef.current = overlaysRef.current.filter((e) => e.id !== id);
  }, []);

  // ── Initial sentinel push on mount ──────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Small delay to let Next.js finish its own history manipulation on mount
    const timer = setTimeout(() => {
      pushSentinel();
    }, 100);

    return () => clearTimeout(timer);
  }, [pushSentinel]);

  // Track when the logout overlay was last dismissed to prevent re-opening loop
  const lastLogoutDismissRef = useRef(0);

  // ── Popstate handler — THE SINGLE source of truth ───────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = (event: PopStateEvent) => {
      // Re-entrancy guard
      if (handlingPopStateRef.current) return;
      handlingPopStateRef.current = true;

      try {
        // Mark sentinel as consumed (the back press used it)
        sentinelActiveRef.current = false;

        const stack = overlaysRef.current;

        if (stack.length > 0) {
          // Close the topmost overlay (highest priority = first in sorted array)
          const topOverlay = stack[0];
          // Remove it from the stack BEFORE calling closeFn
          // to prevent re-entrancy if closeFn triggers unregister
          overlaysRef.current = stack.filter((e) => e.id !== topOverlay.id);
          
          // Track if this was the logout modal being dismissed
          if (topOverlay.id === 'logout-modal') {
            lastLogoutDismissRef.current = Date.now();
          }

          // Call the close function
          topOverlay.closeFn();

          // Re-push sentinel after a delay to let any navigation from closeFn
          // settle (e.g. router.back() popping the modal route entry).
          // The handlingPopStateRef stays true during this window, blocking
          // any intermediate popstate events from re-entering this handler.
          setTimeout(() => {
            pushSentinel();
            handlingPopStateRef.current = false;
          }, 200);
        } else if (hasActiveModal()) {
          // An intercepted-route modal (ComingSoon, OutOfCredit, Logout, etc.)
          // is currently mounted in the @modal slot, which is OUTSIDE our
          // React tree — so it couldn't register as an overlay via context.
          //
          // This popstate was triggered by either:
          //   a) ModalWrapper.handleClose() calling router.back(), or
          //   b) The user pressing the hardware back button while a modal is open.
          //
          // In both cases, Next.js will handle the URL change and unmount the
          // @modal slot naturally. We just need to re-push the sentinel and
          // NOT open the logout modal.
          pushSentinel();
          requestAnimationFrame(() => {
            handlingPopStateRef.current = false;
          });
        } else {
          // No overlays open — user is trying to leave the dashboard
          
          // Cooldown check: if the logout modal was JUST dismissed (e.g. user
          // pressed Cancel which triggered router.back() → popstate → here),
          // do NOT re-open the logout modal. Just re-push the sentinel.
          const timeSinceLogoutDismiss = Date.now() - lastLogoutDismissRef.current;
          if (timeSinceLogoutDismiss < 1000) {
            // Within cooldown — just re-push sentinel without opening logout
            pushSentinel();
            requestAnimationFrame(() => {
              handlingPopStateRef.current = false;
            });
            return;
          }

          // Cooldown check: if ANY modal (ComingSoon, OutOfCredit, etc.) was
          // just closed via router.back(), the ModalWrapper unmount races with
          // this popstate handler. The modal counter is already 0, but we
          // should NOT open logout — the user just dismissed a different modal.
          if (wasModalRecentlyClosed(1500)) {
            pushSentinel();
            requestAnimationFrame(() => {
              handlingPopStateRef.current = false;
            });
            return;
          }

          // Show the logout confirmation modal
          // Re-push sentinel FIRST to block further back presses
          pushSentinel();

          // Navigate to logout confirmation via Next.js intercepted route
          router.push('/m/logout');

          requestAnimationFrame(() => {
            handlingPopStateRef.current = false;
          });
        }
      } catch (error) {
        console.error('[NavigationGuard] Error handling popstate:', error);
        // Recovery: re-push sentinel to prevent navigation leak
        sentinelActiveRef.current = false;
        pushSentinel();
        handlingPopStateRef.current = false;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [pushSentinel, router]);

  // ── Context value (stable reference) ────────────────────────
  const contextValue = useMemo<NavigationGuardContextType>(
    () => ({
      registerOverlay,
      unregisterOverlay,
    }),
    [registerOverlay, unregisterOverlay]
  );

  return (
    <NavigationGuardContext.Provider value={contextValue}>
      {children}
    </NavigationGuardContext.Provider>
  );
}
