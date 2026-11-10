# L.E.N.S backend image with the scan toolchain (FastAPI + check engine +
# official gcloud MCP server). Build context: repository root.
#
# The container authenticates to GCP as the VM's attached service account via
# the metadata server: no key files are baked in or mounted.
FROM node:20.18.0-bookworm-slim AS node

FROM python:3.12.7-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Node.js (for the MCP fetcher), copied from the official image.
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

# gcloud CLI from Google's signed apt repository.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
 && curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg \
      | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg \
 && echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" \
      > /etc/apt/sources.list.d/google-cloud-sdk.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends google-cloud-cli \
 && apt-get purge -y gnupg && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

# Official gcloud MCP server, pinned (the fetcher uses it via GCLOUD_MCP_BIN).
RUN npm install -g @google-cloud/gcloud-mcp@0.5.3 && npm cache clean --force

WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt

COPY backend/ backend/

# Unprivileged runtime user; scan data lives on a volume at /data.
RUN useradd --create-home --uid 10001 lens \
 && mkdir -p /data/fetch /data/run \
 && chown -R lens:lens /app /data
USER lens

ENV GCLOUD_MCP_BIN=gcloud-mcp \
    LENS_DATA_DIR=/data/fetch \
    LENS_RUN_DIR=/data/run

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/api/health || exit 1

# No --reload: this is a deployed service, not a dev server.
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
