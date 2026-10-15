#!/bin/bash
# ============================================================
# Deploy / Redeploy Script — run on EC2 after uploading files
# Usage: bash deploy.sh
# ============================================================
set -e

APP_DIR="/home/ec2-user/wafr-app"
cd "$APP_DIR"

echo "============================================"
echo "  WAFR Platform — Deploy Script"
echo "============================================"

# ── 1. Pull latest images ────────────────────────────────────
echo "[1/5] Pulling Docker images..."
docker compose pull --ignore-pull-failures
echo "  ✔ Images updated"

# ── 2. Build backend image ───────────────────────────────────
echo "[2/5] Building backend Docker image..."
docker compose build backend
echo "  ✔ Backend image built"

# ── 3. Start/restart all services ───────────────────────────
echo "[3/5] Starting all services..."
docker compose up -d
echo "  ✔ Services started"

# ── 4. Deploy Nginx config ───────────────────────────────────
echo "[4/5] Configuring Nginx..."
sudo cp "$APP_DIR/nginx/wafr.conf" /etc/nginx/conf.d/wafr.conf
sudo nginx -t && sudo systemctl reload nginx
echo "  ✔ Nginx configured and reloaded"

# ── 5. Health check ─────────────────────────────────────────
echo "[5/5] Running health checks..."
sleep 5

echo -n "  MongoDB:  "
docker compose exec -T mongo mongosh --quiet --eval "db.runCommand('ping').ok" && echo "✔ OK" || echo "✗ FAIL"

echo -n "  Backend:  "
curl -sf http://localhost:8000/api/health > /dev/null && echo "✔ OK" || echo "✗ FAIL (may still be starting)"

echo -n "  Nginx:    "
curl -sf http://localhost/ > /dev/null && echo "✔ OK" || echo "✗ FAIL"

echo -n "  Keycloak: "
curl -sf http://localhost:8080/ > /dev/null && echo "✔ OK" || echo "✗ Still starting (wait 60s)"

echo ""
docker compose ps
echo ""
echo "============================================"
echo "  Deploy COMPLETE!"
EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "YOUR_EC2_IP")
echo "  App:      http://$EC2_IP"
echo "  API:      http://$EC2_IP/api/health"
echo "  Keycloak: http://$EC2_IP:8080"
echo "============================================"
