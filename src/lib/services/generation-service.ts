// ==============================================================================
// GENERATION SERVICE — Shared business rules for image generation
// ==============================================================================
// Pure functions and constants extracted from DashboardHomeClient and
// dashboard/actions/generate.ts. These are framework-agnostic and testable.

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
export const GENERATION_TIMEOUT_MS = 55_000; // 55 seconds

/**
 * Validates an uploaded image file before it reaches the server.
 * Returns a human-readable error string, or null if valid.
 */
export function validateImageFile(file: File): string | null {
  if (!file || !(file instanceof File)) {
    return 'No file provided.';
  }

  if (file.size === 0) {
    return 'Uploaded file is empty.';
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`;
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    return `Invalid file type "${file.type}". Allowed: JPG, PNG, WEBP, HEIC.`;
  }

  return null;
}

/**
 * Dispatches an optimistic credit deduction event.
 * This is an interim solution until a proper state manager (e.g. Zustand) is introduced.
 */
export function dispatchCreditDeduct(amount: number): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('optimistic-credit-deduct', { detail: { amount } })
  );
}

/**
 * Dispatches a credit refund event (e.g. on generation failure).
 */
export function dispatchCreditRefund(amount: number): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('optimistic-credit-refund', { detail: { amount } })
  );
}
