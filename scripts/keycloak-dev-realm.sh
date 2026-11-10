#!/usr/bin/env bash
# Create/refresh the DEV realm on the (prod) Keycloak container. Idempotent.
# Touches only realm $DEV_REALM; the prod realm is never modified.
#
#   scripts/keycloak-dev-realm.sh <user-email> <org_id> [admin]
#
# Sets up:
#   realm       lens-dev: no self-registration, brute-force lockout,
#               password policy, short-lived access tokens
#   client      lens-dev-app: public, authorization code + PKCE S256 only
#               (no password grant, no implicit), redirect = the dev web URL
#   attribute   org_id on users (admin-only) -> `org_id` claim in tokens
#   role        lens-admin
#   user        <user-email> with org_id=<org_id> (temporary password printed
#               once if the user is new); "admin" grants lens-admin
#
# Reads the Keycloak master admin login from the prod .env (never printed).
set -euo pipefail

EMAIL="${1:?usage: $0 <user-email> <org_id> [admin]}"
ORG="${2:?usage: $0 <user-email> <org_id> [admin]}"
MAKE_ADMIN="${3:-}"
ENV_FILE="${PROD_ENV_FILE:-$HOME/wafr-app/.env}"
KC_CONTAINER="${KC_CONTAINER:-wafr-keycloak}"
REALM="${DEV_REALM:-lens-dev}"
CLIENT="${DEV_CLIENT:-lens-dev-app}"
WEB_PORT="${DEV_WEB_PORT:-8444}"

[[ "$ORG" =~ ^[A-Za-z0-9_-]{2,64}$ ]] || { echo "org_id must be 2-64 chars of letters, digits, _ or -"; exit 1; }
[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE (set PROD_ENV_FILE)"; exit 1; }
envval() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
KC_USER="$(envval KC_ADMIN_USER)"; KC_PASS="$(envval KC_ADMIN_PASS)"
[ -n "$KC_USER" ] && [ -n "$KC_PASS" ] || { echo "KC_ADMIN_USER/KC_ADMIN_PASS not found in $ENV_FILE"; exit 1; }

HOST="${DEV_HOST:-$(curl -s -m 3 -H 'Metadata-Flavor: Google' \
  http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip)}"
WEB="http://${HOST}:${WEB_PORT}"

kc() { docker exec -i "$KC_CONTAINER" /opt/keycloak/bin/kcadm.sh "$@"; }

echo "Keycloak admin login..."
kc config credentials --server http://localhost:8080 --realm master --user "$KC_USER" --password "$KC_PASS" >/dev/null

# ---- realm -------------------------------------------------------------------
if ! kc get "realms/$REALM" >/dev/null 2>&1; then
  kc create realms -s realm="$REALM" -s enabled=true >/dev/null
  echo "created realm $REALM"
fi
# sslRequired=NONE because dev is served over plain http (see WARNING below).
kc update "realms/$REALM" \
  -s sslRequired=NONE -s registrationAllowed=false -s resetPasswordAllowed=false \
  -s rememberMe=false -s loginWithEmailAllowed=true -s duplicateEmailsAllowed=false \
  -s bruteForceProtected=true -s failureFactor=5 -s maxFailureWaitSeconds=900 \
  -s 'passwordPolicy="length(12) and upperCase(1) and lowerCase(1) and digits(1) and notUsername"' \
  -s accessTokenLifespan=300 -s ssoSessionIdleTimeout=1800 -s ssoSessionMaxLifespan=36000
echo "realm settings applied"

# ---- org_id user attribute (admin-only) ---------------------------------------
kc get users/profile -r "$REALM" > /tmp/kc-profile.json
python3 - <<'PY'
import json
p = json.load(open("/tmp/kc-profile.json"))
attrs = p.setdefault("attributes", [])
if not any(a.get("name") == "org_id" for a in attrs):
    attrs.append({"name": "org_id", "displayName": "Organization ID", "multivalued": False,
                  "permissions": {"view": ["admin"], "edit": ["admin"]}})
json.dump(p, open("/tmp/kc-profile.json", "w"))
PY
kc update users/profile -r "$REALM" -f - < /tmp/kc-profile.json >/dev/null
rm -f /tmp/kc-profile.json
echo "org_id attribute ready"

# ---- client --------------------------------------------------------------------
CLIENT_JSON=$(cat <<JSON
{"clientId":"$CLIENT","name":"L.E.N.S dev","enabled":true,"protocol":"openid-connect",
 "publicClient":true,"standardFlowEnabled":true,"directAccessGrantsEnabled":false,
 "implicitFlowEnabled":false,"serviceAccountsEnabled":false,
 "redirectUris":["$WEB/*"],"webOrigins":["$WEB"],"rootUrl":"$WEB",
 "attributes":{"pkce.code.challenge.method":"S256","post.logout.redirect.uris":"$WEB/*"}}
JSON
)
CID=$(kc get clients -r "$REALM" -q clientId="$CLIENT" --fields id --format csv --noquotes | head -1)
if [ -z "$CID" ]; then
  echo "$CLIENT_JSON" | kc create clients -r "$REALM" -f - >/dev/null
  CID=$(kc get clients -r "$REALM" -q clientId="$CLIENT" --fields id --format csv --noquotes | head -1)
  echo "created client $CLIENT"
else
  echo "$CLIENT_JSON" | kc update "clients/$CID" -r "$REALM" -f - >/dev/null
  echo "updated client $CLIENT"
fi
if ! kc get "clients/$CID/protocol-mappers/models" -r "$REALM" --fields name --format csv --noquotes | grep -qx org_id; then
  kc create "clients/$CID/protocol-mappers/models" -r "$REALM" -f - >/dev/null <<'JSON'
{"name":"org_id","protocol":"openid-connect","protocolMapper":"oidc-usermodel-attribute-mapper",
 "config":{"user.attribute":"org_id","claim.name":"org_id","jsonType.label":"String",
           "access.token.claim":"true","id.token.claim":"true","userinfo.token.claim":"true"}}
JSON
  echo "added org_id token mapper"
fi

# ---- role ----------------------------------------------------------------------
kc get roles/lens-admin -r "$REALM" >/dev/null 2>&1 || { kc create roles -r "$REALM" -s name=lens-admin >/dev/null; echo "created role lens-admin"; }

# ---- user ----------------------------------------------------------------------
UID_=$(kc get users -r "$REALM" -q email="$EMAIL" -q exact=true --fields id --format csv --noquotes | head -1)
NEWPW=""
if [ -z "$UID_" ]; then
  kc create users -r "$REALM" -s username="$EMAIL" -s email="$EMAIL" -s enabled=true \
    -s emailVerified=true -s "attributes.org_id=[\"$ORG\"]" >/dev/null
  NEWPW="$(python3 -c 'import secrets,string; a=string.ascii_letters+string.digits; print("Lens-"+"".join(secrets.choice(a) for _ in range(16))+"9a")')"
  kc set-password -r "$REALM" --username "$EMAIL" --new-password "$NEWPW" --temporary >/dev/null
  echo "created user $EMAIL"
else
  kc update "users/$UID_" -r "$REALM" -s "attributes.org_id=[\"$ORG\"]" >/dev/null
  echo "user $EMAIL exists; org_id set to $ORG"
fi
if [ "$MAKE_ADMIN" = "admin" ]; then
  kc add-roles -r "$REALM" --uusername "$EMAIL" --rolename lens-admin && echo "granted lens-admin"
fi

cat <<EOF

Done. Realm '$REALM', client '$CLIENT', redirect $WEB/*
Issuer for the backend: http://$HOST:8080/realms/$REALM
EOF
if [ -n "$NEWPW" ]; then
  echo "Temporary password for $EMAIL (shown once; you must change it at first sign-in):"
  echo "  $NEWPW"
fi
cat <<'EOF'

WARNING: dev runs over plain http, so tokens and passwords cross the network
unencrypted (the firewall limits the web/API ports to your IP, but Keycloak's
:8080 is open). Add TLS before using real customer accounts.
EOF
