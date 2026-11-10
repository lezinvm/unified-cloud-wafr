/**
 * OpenID Connect sign-in against Keycloak: authorization code flow with PKCE
 * (S256), the standard for browser apps. The app never sees the password;
 * Keycloak's hosted login page handles credentials, lockout and resets.
 *
 * Enabled with VITE_AUTH_MODE=oidc plus:
 *   VITE_KEYCLOAK_URL        e.g. http://35.232.48.159:8080
 *   VITE_KEYCLOAK_REALM      e.g. lens-dev
 *   VITE_KEYCLOAK_CLIENT_ID  e.g. lens-dev-app   (public client, PKCE S256 required)
 *
 * Tokens are kept in memory and mirrored to sessionStorage (this tab only) so
 * a page reload keeps the session. They are refreshed shortly before expiry.
 */

export const OIDC_ENABLED = (import.meta.env.VITE_AUTH_MODE as string) === 'oidc';

const BASE = String(import.meta.env.VITE_KEYCLOAK_URL || '').replace(/\/+$/, '');
const REALM = String(import.meta.env.VITE_KEYCLOAK_REALM || '');
const CLIENT_ID = String(import.meta.env.VITE_KEYCLOAK_CLIENT_ID || '');
const ISSUER = `${BASE}/realms/${REALM}`;
const ENDPOINT = `${ISSUER}/protocol/openid-connect`;

const STORE_KEY = 'lens_oidc_tokens';
const PKCE_KEY = 'lens_oidc_pkce';

export interface OidcProfile {
  sub: string;
  email: string;
  name: string;
  orgId: string;
  roles: string[];
  isAdmin: boolean;
}

interface Tokens {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_at: number; // epoch ms
}

let tokens: Tokens | null = null;
let refreshing: Promise<Tokens | null> | null = null;

// ── SHA-256 (crypto.subtle is unavailable on plain-http origins) ──────────
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256(msg: Uint8Array): Uint8Array {
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const bitLen = msg.length * 8;
  const padded = new Uint8Array(((msg.length + 9 + 63) >> 6) << 6);
  padded.set(msg);
  padded[msg.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLen >>> 0);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000));
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) ov.setUint32(i * 4, h[i]);
  return out;
}

function b64url(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach(b => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(nBytes = 32): string {
  const a = new Uint8Array(nBytes);
  crypto.getRandomValues(a); // available on insecure origins, unlike crypto.subtle
  return b64url(a);
}

function decodeJwt(token: string): any {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(part).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function save(t: Tokens | null) {
  tokens = t;
  try {
    if (t) sessionStorage.setItem(STORE_KEY, JSON.stringify(t));
    else sessionStorage.removeItem(STORE_KEY);
  } catch { /* storage unavailable */ }
}

function load(): Tokens | null {
  if (tokens) return tokens;
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    tokens = raw ? JSON.parse(raw) : null;
  } catch {
    tokens = null;
  }
  return tokens;
}

function redirectUri(): string {
  return `${window.location.origin}/`;
}

async function tokenRequest(params: Record<string, string>): Promise<Tokens> {
  const res = await fetch(`${ENDPOINT}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...params }).toString(),
  });
  if (!res.ok) throw new Error(`Token request failed (${res.status})`);
  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    id_token: data.id_token,
    expires_at: Date.now() + (Number(data.expires_in) || 60) * 1000,
  };
}

/** Send the browser to Keycloak's login page. */
export function login(): void {
  const verifier = randomString(48);
  const state = randomString(16);
  const nonce = randomString(16);
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state, nonce }));
  const challenge = b64url(sha256(new TextEncoder().encode(verifier)));
  const q = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    scope: 'openid profile email',
    redirect_uri: redirectUri(),
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    nonce,
  });
  window.location.assign(`${ENDPOINT}/auth?${q.toString()}`);
}

/** Handle `?code=...&state=...` on return from Keycloak. Returns true if signed in. */
async function handleCallback(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');
  if (!code && !error) return false;
  const pkce = JSON.parse(sessionStorage.getItem(PKCE_KEY) || 'null');
  sessionStorage.removeItem(PKCE_KEY);
  // Remove the code from the address bar so it can't be reused or leaked.
  window.history.replaceState(null, '', window.location.pathname);
  if (error || !pkce || params.get('state') !== pkce.state) return false;
  const t = await tokenRequest({
    grant_type: 'authorization_code',
    code: code as string,
    redirect_uri: redirectUri(),
    code_verifier: pkce.verifier,
  });
  const idClaims = t.id_token ? decodeJwt(t.id_token) : null;
  if (idClaims && idClaims.nonce !== pkce.nonce) throw new Error('Sign-in response failed the nonce check.');
  save(t);
  return true;
}

async function refresh(): Promise<Tokens | null> {
  const t = load();
  if (!t?.refresh_token) return null;
  if (!refreshing) {
    refreshing = tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh_token })
      .then(nt => { save(nt); return nt; })
      .catch(() => { save(null); return null; })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

/** A valid access token, refreshed if it expires within 30 s. Null if signed out. */
export async function getAccessToken(): Promise<string | null> {
  const t = load();
  if (!t) return null;
  if (t.expires_at - Date.now() > 30_000) return t.access_token;
  const nt = await refresh();
  return nt?.access_token ?? null;
}

export function getProfile(): OidcProfile | null {
  const t = load();
  if (!t) return null;
  const c = decodeJwt(t.access_token);
  if (!c) return null;
  const roles: string[] = c.realm_access?.roles || [];
  return {
    sub: c.sub,
    email: String(c.email || '').toLowerCase(),
    name: c.name || c.preferred_username || c.email || '',
    orgId: c.org_id || '',
    roles,
    isAdmin: roles.includes('lens-admin'),
  };
}

/**
 * Run once before the app mounts: completes a pending sign-in and makes sure
 * any stored session is still valid. Returns the signed-in profile or null.
 */
export async function bootstrap(): Promise<OidcProfile | null> {
  try {
    await handleCallback();
  } catch (e) {
    console.error('Sign-in failed:', e);
    save(null);
  }
  const token = await getAccessToken();
  return token ? getProfile() : null;
}

/** End the session locally and in Keycloak. */
export function logout(): void {
  const idToken = load()?.id_token;
  save(null);
  const q = new URLSearchParams({ client_id: CLIENT_ID, post_logout_redirect_uri: redirectUri() });
  if (idToken) q.set('id_token_hint', idToken);
  window.location.assign(`${ENDPOINT}/logout?${q.toString()}`);
}

export const oidcConfigOk = Boolean(BASE && REALM && CLIENT_ID);
