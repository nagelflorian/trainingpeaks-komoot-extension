/**
 * Komoot authentication — session-based auth via browser cookies.
 *
 * Flow:
 *  1. User logs in to Komoot in the browser (any method: email, Google, Apple)
 *  2. verifyAuth() detects the existing session cookie via the session endpoint
 *  3. Persist {userId, displayName} in browser.storage.local
 *
 */

import browser from "webextension-polyfill";

const SESSION_URL = "https://account.komoot.com/v1/session";

const STORAGE_KEY = "komootAuth";

export interface StoredAuth {
  userId: string;
  displayName: string;
}

/** Sign out: clear stored auth. (Session cookie expiry handled by browser.) */
export async function signOut(): Promise<void> {
  await browser.storage.local.remove(STORAGE_KEY);
}

/** Return stored auth, or null if not authenticated. */
export async function getStoredAuth(): Promise<StoredAuth | null> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as StoredAuth) ?? null;
}

/**
 * Detect or verify a Komoot session using the browser's existing cookies.
 *
 * Works for ALL login methods (email/password, Apple Sign In, Google, etc.)
 * because it relies on the session cookie already present in the browser,
 * not on credentials stored by this extension.
 *
 * Flow:
 *  1. Call the session endpoint with credentials: 'include'
 *  2. If the browser already has a valid Komoot session cookie → returns user info
 *  3. Persist userId + displayName in storage.local for later API calls
 *  4. On 401 (no active session) → clear any stale storage, return null
 */
export async function verifyAuth(): Promise<StoredAuth | null> {
  try {
    const res = await fetch(SESSION_URL, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    if (res.status === 401 || res.status === 403) {
      await signOut();
      return null;
    }

    if (!res.ok) {
      // Network or server error — fall back to stored auth if available
      return getStoredAuth();
    }

    const data = await res.json();
    const user = data?._embedded?.profile;
    if (!user?.username) {
      await signOut();
      return null;
    }

    const auth: StoredAuth = {
      userId: String(user.username),
      displayName: user.display_name ?? user.username,
    };
    await browser.storage.local.set({ [STORAGE_KEY]: auth });
    return auth;
  } catch {
    // Network error — fall back to stored auth optimistically
    return getStoredAuth();
  }
}
