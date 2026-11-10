#!/usr/bin/env bash
# Dev environment runner (runs alongside prod on the same VM, shares nothing).
#
#   Mongo     : docker container wafr-dev-mongo   -> 127.0.0.1:27018 (prod uses :27017)
#   Backend   : uvicorn backend.main:app          -> :8001   (prod uses :8000)
#   Frontend  : vite preview of a dev build       -> :8444   (prod uses :8443)
#   Auth      : realm lens-dev on the prod Keycloak (:8080), set up with
#               scripts/keycloak-dev-realm.sh. Frontend signs in with OIDC
#               code+PKCE; backend runs AUTH_MODE=keycloak (every call needs
#               a token; org/user come from it). The prod realm is untouched.
#   Data      : REAL ONLY. Backend runs with REAL_DATA_ONLY=1 and the frontend
#               is built with VITE_REAL_DATA_ONLY=true (no demo fallbacks, no
#               simulated scans/re-runs).
#
# Usage:  scripts/dev-env.sh start|stop|restart|status|rebuild|reset-data
#   start       start mongo + backend + frontend (builds the frontend if needed)
#   rebuild     restart backend and force a frontend rebuild (after git pull)
#   reset-data  wipe demo data from the dev DB, then run check engine + loader
#               on backend/mcp_fetch/gcp_fetch_result.json
#   scan        live fetch (gcloud MCP, VM identity) -> check engine -> loader.
#               Keeps the previous data if the fetch is mostly blocked.
#
# Env overrides: DEV_HOST (public IP the browser uses), DEV_API_PORT,
# DEV_WEB_PORT, DEV_KEEP_EMAIL (user kept by reset-data).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN="$ROOT/.dev-run"
mkdir -p "$RUN"

API_PORT="${DEV_API_PORT:-8001}"
WEB_PORT="${DEV_WEB_PORT:-8444}"
KEEP_EMAIL="${DEV_KEEP_EMAIL:-lezin.menath@cloudifyops.com}"
REALM="${DEV_REALM:-lens-dev}"
CLIENT="${DEV_CLIENT:-lens-dev-app}"
MONGO_PORT=27018
MONGO_NAME=wafr-dev-mongo
DEV_MONGO_URI="mongodb://localhost:${MONGO_PORT}"

host_ip() {
  if [ -n "${DEV_HOST:-}" ]; then echo "$DEV_HOST"; return; fi
  curl -s -m 3 -H 'Metadata-Flavor: Google' \
    http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip \
    || echo "localhost"
}

is_running() { [ -f "$1" ] && kill -0 "$(cat "$1")" 2>/dev/null; }

stop_pid() {
  local f="$1" name="$2"
  if is_running "$f"; then
    kill "$(cat "$f")" 2>/dev/null || true
    echo "stopped $name"
  fi
  rm -f "$f"
}

start_mongo() {
  if [ "$(docker ps -q -f name=^${MONGO_NAME}$)" ]; then
    echo "mongo already running"
  elif [ "$(docker ps -aq -f name=^${MONGO_NAME}$)" ]; then
    docker start "$MONGO_NAME" >/dev/null && echo "mongo started"
  else
    # Bound to localhost only: this Mongo has no auth, so it must never be
    # reachable from outside the VM, whatever the firewall says.
    docker run -d --name "$MONGO_NAME" -p "127.0.0.1:${MONGO_PORT}:27017" \
      -v wafr_dev_mongo:/data/db mongo:7 >/dev/null && echo "mongo created"
  fi
}

venv() {
  [ -d "$ROOT/.venv" ] || { echo "missing $ROOT/.venv (create venv + pip install first)"; exit 1; }
  # shellcheck disable=SC1091
  source "$ROOT/.venv/bin/activate"
}

start_backend() {
  if is_running "$RUN/backend.pid"; then echo "backend already running"; return; fi
  (
    cd "$ROOT"
    venv
    local host; host="$(host_ip)"
    # AUTH_MODE=keycloak: every API call needs a token from realm $REALM;
    # org/user come from the token. Tokens are issued for the public host, so
    # the issuer uses it; signing keys are fetched over localhost.
    # KEYCLOAK_URL stays dead so the legacy admin-API code can't reach Keycloak.
    MONGO_URI="$DEV_MONGO_URI" DB_NAME=wafr_db \
    AUTH_MODE=keycloak \
    KEYCLOAK_ISSUER="http://$host:8080/realms/$REALM" \
    KEYCLOAK_JWKS_URL="http://127.0.0.1:8080/realms/$REALM/protocol/openid-connect/certs" \
    KEYCLOAK_CLIENT_ID="$CLIENT" \
    CORS_ORIGINS="http://$host:$WEB_PORT" \
    KEYCLOAK_URL="http://127.0.0.1:1" REAL_DATA_ONLY=1 SCAN_ENABLED=1 \
      nohup python -m uvicorn backend.main:app --host 0.0.0.0 --port "$API_PORT" \
      > "$RUN/backend.log" 2>&1 &
    echo $! > "$RUN/backend.pid"
  )
  echo "backend starting on :$API_PORT (keycloak auth, real data only)"
}

build_frontend() {
  local host; host="$(host_ip)"
  echo "building frontend (API=http://$host:$API_PORT/api, OIDC realm $REALM, real data only)"
  (
    cd "$ROOT"
    npx -y pnpm install --frozen-lockfile
    VITE_API_URL="http://$host:$API_PORT/api" VITE_REAL_DATA_ONLY=true \
    VITE_AUTH_MODE=oidc VITE_KEYCLOAK_URL="http://$host:8080" \
    VITE_KEYCLOAK_REALM="$REALM" VITE_KEYCLOAK_CLIENT_ID="$CLIENT" \
      npx -y pnpm build
  )
}

start_frontend() {
  if is_running "$RUN/web.pid"; then echo "frontend already running"; return; fi
  [ -d "$ROOT/dist" ] || build_frontend
  (
    cd "$ROOT"
    PORT="$WEB_PORT" nohup ./node_modules/.bin/vite preview \
      > "$RUN/web.log" 2>&1 &
    echo $! > "$RUN/web.pid"
  )
  echo "frontend starting on :$WEB_PORT"
}

reset_data() {
  local fetch="$ROOT/backend/mcp_fetch/gcp_fetch_result.json"
  [ -f "$fetch" ] || { echo "missing $fetch (upload or fetch it first)"; exit 1; }
  start_mongo
  (
    cd "$ROOT/backend"
    venv
    export MONGO_URI="$DEV_MONGO_URI" DB_NAME=wafr_db
    python reset_dev_real_only.py --keep-email "$KEEP_EMAIL" --yes
    # Log to a file: piping into `head`/`sed` would break the pipe and trip pipefail.
    python check_engine.py --provider gcp > "$RUN/check_engine.log"
    sed -n '1,10p' "$RUN/check_engine.log"
    # Own the loaded data with the kept user's real id and org.
    read -r uid org < <(python -c "
import os
from pymongo import MongoClient
u = MongoClient(os.environ['MONGO_URI'])[os.environ['DB_NAME']]['users'].find_one({'email': '$KEEP_EMAIL'})
print(u['id'], u.get('org_id') or 'org_' + u['id'])")
    python load_assessment_to_db.py --user-id "$uid" --org-id "$org" --real-only
  )
}

scan() {
  # Real scan: fetch live GCP data via the official gcloud MCP server using the
  # VM's own identity, then check engine + loader into the dev DB.
  # Does NOT wipe the DB; it refreshes this project's assessment in place.
  local project="${DEV_GCP_PROJECT:-lens-wafr-gcp}"
  local fetch="$ROOT/backend/mcp_fetch/gcp_fetch_result.json"
  local tmp="$RUN/gcp_fetch_new.json"
  echo "identity: $(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null)"
  echo "fetching $project (several minutes; log: $RUN/fetch.log)..."
  ( cd "$ROOT/backend/mcp_fetch" && node gcp_fetch_all.mjs --project "$project" --out "$tmp" > "$RUN/fetch.log" 2>&1 ) || {
    echo "fetch failed; see $RUN/fetch.log (previous data kept)"; exit 1; }
  # Refuse to replace good data with a mostly-blocked fetch (permission problem).
  local ok
  ok=$(python3 -c "
import json,sys
s=json.load(open('$tmp'))['projects']['$project']['services']
print(sum(1 for v in s.values() if v.get('ok')))")
  if [ "$ok" -lt 20 ]; then
    echo "only $ok services readable: the VM identity lacks access. Previous data kept."
    echo "see $RUN/fetch.log"; exit 1
  fi
  mv "$tmp" "$fetch"
  echo "fetch ok ($ok services readable)"
  start_mongo
  (
    cd "$ROOT/backend"
    venv
    export MONGO_URI="$DEV_MONGO_URI" DB_NAME=wafr_db
    python check_engine.py --provider gcp > "$RUN/check_engine.log"
    sed -n '1,10p' "$RUN/check_engine.log"
    read -r uid org < <(python -c "
import os
from pymongo import MongoClient
u = MongoClient(os.environ['MONGO_URI'])[os.environ['DB_NAME']]['users'].find_one({'email': '$KEEP_EMAIL'})
print(u['id'], u.get('org_id') or 'org_' + u['id'])")
    python load_assessment_to_db.py --user-id "$uid" --org-id "$org" --real-only
  )
}

status() {
  local host; host="$(host_ip)"
  echo "mongo    : $(docker ps -f name=^${MONGO_NAME}$ --format '{{.Status}} {{.Ports}}' | head -1 || true)"
  is_running "$RUN/backend.pid" && echo "backend  : running  http://$host:$API_PORT/api/health" || echo "backend  : stopped"
  is_running "$RUN/web.pid"     && echo "frontend : running  http://$host:$WEB_PORT" || echo "frontend : stopped"
}

case "${1:-}" in
  start)      start_mongo; start_backend; start_frontend; sleep 4; status ;;
  rebuild)    rm -rf "$ROOT/dist"; stop_pid "$RUN/web.pid" frontend; stop_pid "$RUN/backend.pid" backend
              start_mongo; start_backend; start_frontend; sleep 4; status ;;
  reset-data) reset_data ;;
  scan)       scan ;;
  stop)       stop_pid "$RUN/web.pid" frontend; stop_pid "$RUN/backend.pid" backend
              docker stop "$MONGO_NAME" >/dev/null 2>&1 && echo "stopped mongo" || true ;;
  restart)    "$0" stop; "$0" start ;;
  status)     status ;;
  *) echo "usage: $0 start|stop|restart|status|rebuild|reset-data|scan"; exit 1 ;;
esac
