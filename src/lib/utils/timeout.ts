/**
 * Utility to wrap any Promise with a timeout.
 * Prevents UI from hanging forever if an API request or async task stalls.
 * @param promise The original promise to execute
 * @param timeoutMs Maximum time to wait in milliseconds
 * @param timeoutMessage Custom error message if timeout is reached
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage = 'Request timed out. Please try again.'): Promise<T> {
  let timerId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timerId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timerId);
  });
}
