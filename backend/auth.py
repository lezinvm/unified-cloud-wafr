"""
Keycloak (OIDC) access-token verification.

Enabled with AUTH_MODE=keycloak. Every API request (except public routes) must
carry `Authorization: Bearer <access token>` issued by the configured realm.

Verified on every request:
  * RS256 signature against the realm's JWKS (cached, refreshed on unknown kid)
  * `iss` equals KEYCLOAK_ISSUER exactly
  * `exp` / `nbf` (with small clock-skew leeway)
  * `azp` (authorized party) equals KEYCLOAK_CLIENT_ID, so tokens minted for
    other clients in the same realm are rejected
  * an `org_id` claim is present (tenant), set per user via a Keycloak user
    attribute + protocol mapper

Identity comes ONLY from the verified token: user id = `sub`, org = `org_id`,
admin = realm role `lens-admin`.

Config (env):
  AUTH_MODE             'keycloak' to enforce; anything else = legacy (no auth)
  KEYCLOAK_ISSUER       e.g. http://35.232.48.159:8080/realms/lens-dev
                        (must match the token's iss: the URL the browser uses)
  KEYCLOAK_JWKS_URL     optional; defaults to <issuer>/protocol/openid-connect/certs
                        (set to a localhost URL when the backend runs on the same host)
  KEYCLOAK_CLIENT_ID    e.g. lens-dev-app
  ADMIN_ROLE            default lens-admin
"""
from __future__ import annotations

import json
import os
import threading
import time
import urllib.request
from dataclasses import dataclass, field

import jwt
from jwt import PyJWK

AUTH_MODE = os.getenv("AUTH_MODE", "").strip().lower()
AUTH_ENABLED = AUTH_MODE == "keycloak"
ISSUER = os.getenv("KEYCLOAK_ISSUER", "").rstrip("/")
JWKS_URL = os.getenv("KEYCLOAK_JWKS_URL", "") or (f"{ISSUER}/protocol/openid-connect/certs" if ISSUER else "")
CLIENT_ID = os.getenv("KEYCLOAK_CLIENT_ID", "")
ADMIN_ROLE = os.getenv("ADMIN_ROLE", "lens-admin")
LEEWAY_S = 30
JWKS_TTL_S = 3600
JWKS_MIN_REFRESH_S = 30


class AuthError(Exception):
    """Raised for any authentication failure. `status` is 401 or 403."""

    def __init__(self, message: str, status: int = 401):
        super().__init__(message)
        self.status = status


@dataclass(frozen=True)
class Principal:
    sub: str
    email: str
    name: str
    org_id: str
    roles: frozenset = field(default_factory=frozenset)

    @property
    def is_admin(self) -> bool:
        return ADMIN_ROLE in self.roles


def config_problems() -> list[str]:
    """Startup check: refuse to run AUTH_MODE=keycloak half-configured."""
    if not AUTH_ENABLED:
        return []
    probs = []
    if not ISSUER:
        probs.append("KEYCLOAK_ISSUER is not set")
    if not CLIENT_ID:
        probs.append("KEYCLOAK_CLIENT_ID is not set")
    return probs


class _JwksCache:
    def __init__(self, url: str, fetcher=None):
        self.url = url
        self._fetch = fetcher or self._http_fetch
        self._keys: dict[str, PyJWK] = {}
        self._fetched_at = 0.0
        self._lock = threading.Lock()

    @staticmethod
    def _http_fetch(url: str) -> dict:
        with urllib.request.urlopen(url, timeout=5) as res:  # noqa: S310 - fixed config URL
            return json.loads(res.read().decode())

    def _refresh(self) -> None:
        data = self._fetch(self.url)
        keys = {}
        for k in data.get("keys", []):
            if k.get("use", "sig") == "sig" and k.get("kid"):
                try:
                    keys[k["kid"]] = PyJWK(k)
                except jwt.PyJWTError:
                    continue
        self._keys = keys
        self._fetched_at = time.time()

    def get(self, kid: str) -> PyJWK:
        with self._lock:
            stale = time.time() - self._fetched_at > JWKS_TTL_S
            if stale or (kid not in self._keys and time.time() - self._fetched_at > JWKS_MIN_REFRESH_S):
                try:
                    self._refresh()
                except Exception as e:  # noqa: BLE001
                    if not self._keys:
                        raise AuthError(f"Cannot load signing keys from the identity provider: {e}", 503)
            key = self._keys.get(kid)
        if key is None:
            raise AuthError("Token signed with an unknown key.")
        return key


_jwks = _JwksCache(JWKS_URL)


def set_jwks_fetcher(fetcher, url: str = "test://jwks") -> None:
    """Test hook: replace the JWKS source."""
    global _jwks
    _jwks = _JwksCache(url, fetcher)


def verify_token(token: str, *, issuer: str | None = None, client_id: str | None = None) -> Principal:
    issuer = (issuer if issuer is not None else ISSUER).rstrip("/")
    client_id = client_id if client_id is not None else CLIENT_ID
    if not token:
        raise AuthError("Missing bearer token.")
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError:
        raise AuthError("Malformed token.")
    if header.get("alg") != "RS256":
        raise AuthError("Unsupported token algorithm.")
    key = _jwks.get(header.get("kid", ""))
    try:
        claims = jwt.decode(
            token, key=key, algorithms=["RS256"], issuer=issuer, leeway=LEEWAY_S,
            options={"require": ["exp", "iat", "iss", "sub"], "verify_aud": False},
        )
    except jwt.ExpiredSignatureError:
        raise AuthError("Token expired.")
    except jwt.InvalidIssuerError:
        raise AuthError("Token issuer is not trusted.")
    except jwt.PyJWTError as e:
        raise AuthError(f"Invalid token: {e}")
    if claims.get("azp") != client_id:
        raise AuthError("Token was not issued for this application.")
    if claims.get("typ") not in (None, "Bearer"):
        raise AuthError("Not an access token.")
    org_id = claims.get("org_id")
    if not isinstance(org_id, str) or not org_id.strip():
        raise AuthError("Your account is not assigned to an organization. Ask an administrator.", 403)
    roles = frozenset((claims.get("realm_access") or {}).get("roles") or [])
    return Principal(
        sub=str(claims["sub"]),
        email=str(claims.get("email") or "").lower(),
        name=str(claims.get("name") or claims.get("preferred_username") or ""),
        org_id=org_id.strip(),
        roles=roles,
    )
