#!/bin/bash
# ============================================================
# EC2 Bootstrap Script — Unified Cloud WAFR Platform
# Run this ONCE on a fresh Amazon Linux 2023 EC2 instance
# Usage: bash setup-ec2.sh
# ============================================================
set -e

echo "============================================"
echo "  WAFR Platform — EC2 Setup Script"
echo "============================================"

# ── 1. System update ────────────────────────────────────────
echo "[1/7] Updating system packages..."
sudo dnf update -y

# ── 2. Install Docker ────────────────────────────────────────
echo "[2/7] Installing Docker..."
sudo dnf install -y docker
sudo systemctl enable docker --now
sudo usermod -aG docker ec2-user
echo "  ✔ Docker installed"

# ── 3. Install Docker Compose plugin ────────────────────────
echo "[3/7] Installing Docker Compose..."
sudo dnf install -y docker-compose-plugin
docker compose version
echo "  ✔ Docker Compose installed"

# ── 4. Install Nginx ─────────────────────────────────────────
echo "[4/7] Installing Nginx..."
sudo dnf install -y nginx
sudo systemctl enable nginx --now
echo "  ✔ Nginx installed"

# ── 5. Install Node.js 20 (for optional frontend build on server) ──
echo "[5/7] Installing Node.js 20..."
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
node -v && npm -v
echo "  ✔ Node.js installed"

# ── 6. Create app directory ──────────────────────────────────
echo "[6/7] Creating app directory..."
mkdir -p /home/ec2-user/wafr-app/nginx
echo "  ✔ Directory /home/ec2-user/wafr-app created"

# ── 7. Open firewall ports (if using firewalld) ──────────────
echo "[7/7] Configuring firewall..."
sudo firewall-cmd --permanent --add-service=http 2>/dev/null || true
sudo firewall-cmd --permanent --add-port=8080/tcp 2>/dev/null || true
sudo firewall-cmd --reload 2>/dev/null || true
echo "  ✔ Firewall configured"

echo ""
echo "============================================"
echo "  Setup COMPLETE!"
echo "  NEXT: Upload your app files and run:"
echo "    cd /home/ec2-user/wafr-app"
echo "    docker compose up -d"
echo "============================================"
echo ""
echo "NOTE: Log out and back in for Docker group to take effect."
