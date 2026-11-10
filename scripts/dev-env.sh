#!/usr/bin/env bash
# Dev environment runner (runs alongside prod on the same VM, shares nothing).
#
#   Mongo     : docker container wafr-dev-mongo   -> :27018  (prod uses :27017)
#   Backend   : uvicorn backend.main:app          -> :8001   (prod uses :8000)
#   Frontend  : vite preview of a mock-auth build -> :8444   (prod uses :8443)
#   Keycloak  : NONE. Frontend uses VITE_AUTH_MODE=mock. The backend's
#               KEYCLOAK_URL points at a dead address on purpose so it can
#               never sync with or mutate the PROD Keycloak on :8080.
#
# Usage:  scripts/dev-env.sh start|stop|restart|status|rebuild
#   start    start mongo + backend + frontend (builds the frontend if needed)
#   rebuild  force a frontend rebuild, then start
#
# Override with env vars: DEV_HOST (public IP used by the browser),
# DEV_API_PORT, DEV_WEB_PORT.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN="$ROOT/.dev-run"
mkdir -p "$RUN"

API_PORT="${DEV_API_PORT:-8001}"
WEB_PORT="${DEV_WEB_PORT:-8444}"
MONGO_PORT=27018
MONGO_NAME=wafr-dev-mongo

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

start_backend() {
  if is_running "$RUN/backend.pid"; then echo "backend already running"; return; fi
  [ -d "$ROOT/.venv" ] || { echo "missing $ROOT/.venv (create venv + pip install first)"; exit 1; }
  (
    cd "$ROOT"
    # shellcheck disable=SC1091
    source .venv/bin/activate
    MONGO_URI="mongodb://localhost:${MONGO_PORT}" DB_NAME=wafr_db \
    KEYCLOAK_URL="http://127.0.0.1:1" \
      nohup python -m uvicorn backend.main:app --host 0.0.0.0 --port "$API_PORT" \
      > "$RUN/backend.log" 2>&1 &
    echo $! > "$RUN/backend.pid"
  )
  echo "backend starting on :$API_PORT"
}

build_frontend() {
  local host; host="$(host_ip)"
  echo "building frontend (API=http://$host:$API_PORT/api, auth=mock)"
  (
    cd "$ROOT"
    npx -y pnpm install --frozen-lockfile
    VITE_API_URL="http://$host:$API_PORT/api" VITE_AUTH_MODE=mock npx -y pnpm build
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

status() {
  local host; host="$(host_ip)"
  echo "mongo    : $(docker ps -f name=^${MONGO_NAME}$ --format '{{.Status}}' | head -1 || true)"
  is_running "$RUN/backend.pid" && echo "backend  : running  http://$host:$API_PORT/api/health" || echo "backend  : stopped"
  is_running "$RUN/web.pid"     && echo "frontend : running  http://$host:$WEB_PORT" || echo "frontend : stopped"
}

case "${1:-}" in
  start)   start_mongo; start_backend; start_frontend; sleep 4; status ;;
  rebuild) rm -rf "$ROOT/dist"; stop_pid "$RUN/web.pid" frontend; start_mongo; start_backend; start_frontend; sleep 4; status ;;
  stop)    stop_pid "$RUN/web.pid" frontend; stop_pid "$RUN/backend.pid" backend; docker stop "$MONGO_NAME" >/dev/null 2>&1 && echo "stopped mongo" || true ;;
  restart) "$0" stop; "$0" start ;;
  status)  status ;;
  *) echo "usage: $0 start|stop|restart|status|rebuild"; exit 1 ;;
esac
