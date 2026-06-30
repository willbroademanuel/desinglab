'use client';

/**
 * @deprecated This hook has been replaced by the centralized NavigationGuardProvider.
 * 
 * Use `useNavigationGuard()` from `@/lib/providers/NavigationGuardProvider` instead.
 * 
 * The old approach of each overlay pushing its own history entry and listening for
 * popstate caused race conditions when multiple overlays were open simultaneously.
 * The new NavigationGuardProvider maintains a single popstate listener with a
 * priority-sorted overlay stack.
 * 
 * This file is kept only for backward compatibility during migration.
 * It is a no-op — calling it will have no effect.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useHardwareBackButton(_opts: {
  isOpen: boolean;
  onClose: () => void;
  modalName: string;
}) {
  // No-op — deprecated. See NavigationGuardProvider.
  if (process.env.NODE_ENV === 'development') {
    // Only warn once per mount
    console.warn(
      `[DEPRECATED] useHardwareBackButton("${_opts.modalName}") is deprecated. ` +
      `Use useNavigationGuard() from NavigationGuardProvider instead.`
    );
  }
}
