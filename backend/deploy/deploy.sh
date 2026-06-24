#!/usr/bin/env bash
# =============================================================================
# Elixir & Oak — Production Deployment Script
# Target: Ubuntu 22.04 / Debian 12 on VPS / EC2 / Droplet
# Usage:  sudo bash deploy.sh
# =============================================================================
set -euo pipefail

APP_NAME="elixir-oak"
APP_USER="deploy"
APP_DIR="/var/www/${APP_NAME}"
REPO_URL="git@github.com:your-org/elixir-oak.git"
BRANCH="main"
NODE_VERSION="20"

echo "=== Elixir & Oak Production Deployment ==="
echo "Target: ${APP_DIR}"
echo "Branch: ${BRANCH}"
echo ""

# ---- 1. System dependencies ----
echo "[1/8] Installing system dependencies..."
apt-get update -qq
apt-get install -y -qq curl wget git build-essential nginx certbot python3-certbot-nginx redis-server postgresql-client

# ---- 2. Node.js 20 LTS ----
echo "[2/8] Installing Node.js ${NODE_VERSION} LTS..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y -qq nodejs
fi
npm install -g pm2

# ---- 3. Create deploy user ----
echo "[3/8] Creating deploy user..."
id -u ${APP_USER} &>/dev/null || useradd -m -s /bin/bash ${APP_USER}
usermod -aG ${APP_USER} www-data

# ---- 4. Clone / pull application ----
echo "[4/8] Deploying application code..."
if [ -d "${APP_DIR}" ]; then
  cd "${APP_DIR}"
  git fetch origin
  git reset --hard "origin/${BRANCH}"
else
  git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
fi
mkdir -p "${APP_DIR}/uploads" "${APP_DIR}/logs"
chown -R ${APP_USER}:${APP_USER} "${APP_DIR}"

# ---- 5. Install dependencies & build ----
echo "[5/8] Installing npm dependencies..."
cd "${APP_DIR}/backend"
sudo -u ${APP_USER} npm ci --omit=dev
sudo -u ${APP_USER} npx prisma generate
echo "Building TypeScript..."
sudo -u ${APP_USER} npm run build

# ---- 6. Environment configuration ----
echo "[6/8] Configuring environment..."
if [ ! -f "${APP_DIR}/backend/.env.production" ]; then
  echo "WARNING: .env.production not found. Copying from .env.example..."
  cp "${APP_DIR}/backend/.env.example" "${APP_DIR}/backend/.env.production"
  echo ">>> EDIT ${APP_DIR}/backend/.env.production with production values and re-run <<<"
fi

# ---- 7. Database migration ----
echo "[7/8] Running database migrations..."
cd "${APP_DIR}/backend"
sudo -u ${APP_USER} npx prisma migrate deploy

# ---- 8. Start with PM2 ----
echo "[8/8] Starting application with PM2..."
sudo -u ${APP_USER} pm2 start "${APP_DIR}/backend/deploy/ecosystem.config.js" --env production
sudo -u ${APP_USER} pm2 save
env PATH=$PATH:/usr/bin pm2 startup systemd -u ${APP_USER} --hp "/home/${APP_USER}"

# ---- Setup Nginx ----
echo "Configuring Nginx..."
cp "${APP_DIR}/backend/deploy/nginx.conf" /etc/nginx/sites-available/${APP_NAME}
if [ ! -L "/etc/nginx/sites-enabled/${APP_NAME}" ]; then
  ln -s "/etc/nginx/sites-available/${APP_NAME}" "/etc/nginx/sites-enabled/${APP_NAME}"
fi
nginx -t && systemctl reload nginx

# ---- Setup Logrotate ----
echo "Configuring logrotate..."
cat > /etc/logrotate.d/${APP_NAME} <<'LOGROTATE'
/var/log/elixir-oak/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
LOGROTATE

echo ""
echo "=== Deployment Complete ==="
echo "API:        https://api.elixirandoak.com"
echo "App:        https://app.elixirandoak.com"
echo "Monitoring: pm2 monit"
echo "Logs:       pm2 logs elixir-oak-api"
echo ""
echo "Next steps:"
echo "  1. Configure SSL: certbot --nginx -d api.elixirandoak.com -d app.elixirandoak.com"
echo "  2. Verify .env.production has production secrets"
echo "  3. Set up PostgreSQL daily backup (cron)"
echo "  4. Configure Redis persistence"
echo "  5. Run smoke tests"
