/**
 * Shared ZoomInfo authentication module.
 * Module-level JWT cache is preserved across warm Vercel invocations.
 */

let cachedJwt = null;
let jwtExpiry = 0;

/**
 * Fetch a fresh JWT from ZoomInfo using username/password credentials.
 * Throws if authentication fails.
 */
async function fetchJwt() {
  const username = process.env.ZOOMINFO_USERNAME;
  const password = process.env.ZOOMINFO_PASSWORD;

  if (!username || !password) {
    throw new Error('ZOOMINFO_USERNAME and ZOOMINFO_PASSWORD environment variables are not set');
  }

  const res = await fetch('https://api.zoominfo.com/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ZoomInfo authentication failed (${res.status}): ${body}`);
  }

  const data = await res.json();

  if (!data.jwt) {
    throw new Error('ZoomInfo authentication response did not contain a JWT');
  }

  return data.jwt;
}

/**
 * Returns a valid Bearer token.
 * Priority:
 *   1. ZOOMINFO_BEARER_TOKEN env var (pre-generated, good for testing)
 *   2. Cached JWT (if not expired)
 *   3. Fresh JWT fetched from ZoomInfo /authenticate
 */
export async function getBearerToken() {
  // Option B: static bearer token
  const staticToken = process.env.ZOOMINFO_BEARER_TOKEN;
  if (staticToken) return staticToken;

  // Option A: cached JWT
  if (cachedJwt && Date.now() < jwtExpiry) return cachedJwt;

  // Fetch fresh JWT
  cachedJwt = await fetchJwt();
  jwtExpiry = Date.now() + 55 * 60 * 1000; // Cache for 55 min (expires at 60 min)
  return cachedJwt;
}

/**
 * Invalidate the cached JWT — call this on 401 responses so the next
 * getBearerToken() call will fetch a fresh one.
 */
export function invalidateJwt() {
  cachedJwt = null;
  jwtExpiry = 0;
}

/**
 * Returns true if any credentials are configured in the environment.
 */
export function hasCredentials() {
  return !!(
    process.env.ZOOMINFO_BEARER_TOKEN ||
    (process.env.ZOOMINFO_USERNAME && process.env.ZOOMINFO_PASSWORD)
  );
}
