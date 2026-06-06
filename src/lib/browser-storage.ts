/**
 * Safe accessor for browser Web Storage APIs.
 * Returns null when called server-side or when the storage API throws
 * (e.g. private browsing with storage disabled).
 */
export function getBrowserStorage(type: 'session' | 'local'): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return type === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}
