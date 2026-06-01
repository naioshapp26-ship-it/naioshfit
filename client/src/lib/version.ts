// Client-side version check utility
// Fetches /version.json (no-store) and compares with localStorage value.
// If changed, triggers a one-time reload.

const STORAGE_KEY = 'app_version_id';
const RELOAD_MARKER = 'app_version_reload_once';

export type AppVersion = {
  version: string;
  commit?: string | null;
  builtAt?: string;
};

export async function checkForAppUpdate(): Promise<void> {
  try {
    const res = await fetch('/version.json', { cache: 'no-store' });
    if (!res.ok) return;
    const data = (await res.json()) as AppVersion;
    const current = data?.version || null;
    if (!current) return;

    const last = localStorage.getItem(STORAGE_KEY);
    if (last && last !== current) {
      // Only reload once to avoid loops
      const already = sessionStorage.getItem(RELOAD_MARKER);
      if (!already) {
        sessionStorage.setItem(RELOAD_MARKER, '1');
        // For SW-controlled pages, ask SW to skip waiting first
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
        }
        window.location.reload();
        return;
      }
    }

    // Store current version for subsequent loads
    localStorage.setItem(STORAGE_KEY, current);
    // Reset reload marker if versions match
    if (last === current) sessionStorage.removeItem(RELOAD_MARKER);
  } catch (e) {
    // Silently ignore network errors
    console.debug('Version check failed:', e);
  }
}
