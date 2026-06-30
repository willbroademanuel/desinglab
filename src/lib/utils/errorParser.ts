/**
 * Utility to parse and sanitize raw error messages or JSON strings
 * into professional, user-friendly, and safe error messages.
 * Prevents raw stack traces or internal API details (like GCP billing errors)
 * from being exposed to the end user.
 */

export function parseError(error: any, defaultMessage = 'An unexpected error occurred. Please try again.'): string {
  if (!error) return defaultMessage;

  let msg = '';

  // 1. Extract string from Error object
  if (error instanceof Error) {
    msg = error.message;
  }
  // 2. Extract string from generic objects
  else if (typeof error === 'object') {
    // Try to extract from common nested error structures (e.g., Axios, Fetch, GCP)
    msg = error?.error?.message
      || error?.message
      || error?.data?.message
      || error?.response?.data?.message
      || JSON.stringify(error);
  }
  // 3. Handle string errors (including JSON strings)
  else if (typeof error === 'string') {
    try {
      const parsed = JSON.parse(error);
      msg = parsed?.error?.message
        || parsed?.message
        || parsed?.error
        || error;
    } catch {
      msg = error;
    }
  }

  if (!msg || typeof msg !== 'string') return defaultMessage;

  // --- ERROR SANITIZATION & MASKING --- //

  const lowerMsg = msg.toLowerCase();

  // GCP Billing / Dunning / Quota / Permission / 403 Errors (Internal)
  if (lowerMsg.includes('dunning') || lowerMsg.includes('billing') || lowerMsg.includes('quota') || lowerMsg.includes('429') ||
    lowerMsg.includes('permission_denied') || lowerMsg.includes('403') || lowerMsg.includes('forbidden') || lowerMsg.includes('project: projects/')) {
    return 'Service temporarily unavailable. Please try again later.';
  }

  // Network / Connection Errors
  if (lowerMsg.includes('network') || lowerMsg.includes('failed to fetch') || lowerMsg.includes('timeout')) {
    return 'Network connection failed. Please check your internet connection and try again.';
  }

  // File size / format Errors
  if (lowerMsg.includes('file too large') || lowerMsg.includes('maximum size')) {
    return 'The file you uploaded is too large. Please upload a smaller file.';
  }
  if (lowerMsg.includes('invalid file') || lowerMsg.includes('unsupported format')) {
    return 'This file format is not supported. Please use a standard format like JPG or PNG.';
  }

  // Fallback for any remaining JSON-looking strings or raw code
  if (msg.includes('{') && msg.includes('}')) {
    return defaultMessage;
  }

  // Capitalize first letter for professionalism
  return msg.charAt(0).toUpperCase() + msg.slice(1);
}
