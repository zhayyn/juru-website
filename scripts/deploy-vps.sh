#!/usr/bin/env bash
set -euo pipefail

MODE="docker"
APP_DIR="${APP_DIR:-/opt/juru-website}"
DOMAIN="${DOMAIN:-website.juru.ai.id}"
REPO_URL="${REPO_URL:-https://github.com/zhayyn/juru-website.git}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --docker) MODE="docker"; shift ;;
    --systemd) MODE="systemd"; shift ;;
    --app-dir) APP_DIR="$2"; shift 2 ;;
    --domain) DOMAIN="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root (or via sudo)." >&2
  exit 1
fi

if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone --branch main --single-branch "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" pull --ff-only origin main
fi

ENV_FILE="$APP_DIR/.env"
if [[ "$MODE" == "systemd" ]]; then
  mkdir -p /etc/juru-website
  chmod 700 /etc/juru-website
  ENV_FILE="/etc/juru-website/juru-website.env"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  TOKEN="$(openssl rand -hex 24 2>/dev/null || dd if=/dev/urandom bs=24 count=1 2>/dev/null | od -An -tx1 | tr -d ' \n')"
  HOST_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  ALLOWED="${DOMAIN},127.0.0.1,127.0.0.1:3097,localhost,localhost:3097"
  if [[ -n "$HOST_IP" ]]; then
    ALLOWED="${ALLOWED},${HOST_IP}"
  fi
  umask 077
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
HOST=$([[ "$MODE" == "docker" ]] && echo "0.0.0.0" || echo "127.0.0.1")
PORT=3097
ALLOWED_HOSTS=${ALLOWED}
PILOT_ACCESS_TOKEN=${TOKEN}
PILOT_ALLOWED_TARGETS=example.com,pa-semarang.go.id,www.pa-semarang.go.id
AUDIT_STORAGE_ENABLED=true
AUDIT_DB_PATH=$([[ "$MODE" == "docker" ]] && echo "/app/data/private/audits.sqlite" || echo "/var/lib/juru-website/private/audits.sqlite")
AI_PROVIDER=none
RANKING_PUBLISH_ENABLED=false
PAGESPEED_API_KEY=
EOF
  chmod 600 "$ENV_FILE"
  echo "Created $ENV_FILE (Basic Auth user: prakom)."
fi

if [[ "$MODE" == "docker" ]]; then
  cd "$APP_DIR"
  docker compose up -d --build
else
  if ! id juru >/dev/null 2>&1; then
    useradd --system --home-dir /var/lib/juru-website --create-home --shell /usr/sbin/nologin juru
  fi
  mkdir -p /var/lib/juru-website/private
  chown -R juru:juru /var/lib/juru-website
  chmod 700 /var/lib/juru-website /var/lib/juru-website/private
  cd "$APP_DIR"
  npm ci --include=dev --ignore-scripts
  npm run build
  npm prune --omit=dev --ignore-scripts --package-lock=false
  chown -R juru:juru "$APP_DIR"
  cp "$APP_DIR/deploy/juru-website.service" /etc/systemd/system/juru-website.service
  systemctl daemon-reload
  systemctl enable --now juru-website.service
  systemctl restart juru-website.service
fi

if command -v nginx >/dev/null 2>&1; then
  cp "$APP_DIR/deploy/nginx-website.juru.ai.id.conf" /etc/nginx/sites-available/juru-website
  ln -sf /etc/nginx/sites-available/juru-website /etc/nginx/sites-enabled/juru-website
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl reload nginx
fi

echo "Deployment complete ($MODE mode)."
