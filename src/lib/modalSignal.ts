/**
 * ModalSignal — Cross-tree communication between ModalWrapper and NavigationGuardProvider
 *
 * Problem: The @modal parallel route slot renders in the ROOT layout,
 * but NavigationGuardProvider wraps only the DASHBOARD layout. They can't
 * share React context. When ModalWrapper calls router.back(), the resulting
 * popstate event hits the NavigationGuardProvider, which sees no registered
 * overlays and incorrectly opens the logout modal.
 *
 * Solution: A simple module-level counter that ModalWrapper increments on
 * mount and decrements on unmount. NavigationGuardProvider checks this
 * before deciding to open the logout modal on popstate.
 *
 * Additionally, we track the timestamp of the most recent modal close so
 * the NavigationGuard can apply a cooldown — preventing the logout modal
 * from opening when a popstate fires just *after* a modal was dismissed
 * (the race condition where unmount runs before the popstate handler).
 */

let activeModalCount = 0;
let lastModalCloseTimestamp = 0;

/** Call when a ModalWrapper mounts */
export function registerActiveModal(): void {
  activeModalCount++;
}

/** Call when a ModalWrapper unmounts */
export function unregisterActiveModal(): void {
  activeModalCount--;
  if (activeModalCount < 0) activeModalCount = 0;
  // Record when the modal was dismissed so the NavigationGuard
  // can apply a cooldown to avoid the popstate → logout loop.
  lastModalCloseTimestamp = Date.now();
}

/** Check if any intercepted-route modal is currently mounted */
export function hasActiveModal(): boolean {
  return activeModalCount > 0;
}

/**
 * Check if a modal was recently closed (within the given window).
 * Used by NavigationGuardProvider to skip opening the logout modal
 * when a popstate fires immediately after a modal's router.back().
 */
export function wasModalRecentlyClosed(withinMs: number = 1500): boolean {
  return Date.now() - lastModalCloseTimestamp < withinMs;
}
