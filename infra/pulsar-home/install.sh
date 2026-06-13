#!/usr/bin/env bash
# Pulsar Home installer.
# Tested on Raspberry Pi OS Lite (Bookworm, arm64) and Ubuntu 24.04 (amd64).
#
# What this script does:
#   1. Installs Docker + Compose if missing
#   2. Creates the data directory at $PULSAR_HOME_DATA
#   3. Generates a fresh .env with random secrets (if one doesn't exist)
#   4. Configures avahi/mDNS so the box appears as pulsar.local on the LAN
#   5. Builds and starts the stack
#   6. Smoke-checks the proxy
#
# Re-running is safe: existing .env / data / containers are preserved.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
ENV_FILE="$HERE/.env"
DATA_DIR="${PULSAR_HOME_DATA:-/var/lib/pulsar-home}"

log() { printf "\033[1;36m[pulsar-home]\033[0m %s\n" "$*"; }
die() { printf "\033[1;31m[pulsar-home]\033[0m %s\n" "$*" >&2; exit 1; }

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "Run with sudo: sudo bash $0"
  fi
}

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    log "Docker + Compose already installed, skipping."
    return
  fi
  log "Installing Docker…"
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
}

install_avahi() {
  if command -v avahi-daemon >/dev/null 2>&1; then
    log "avahi already installed, skipping."
    return
  fi
  log "Installing avahi for mDNS (pulsar.local)…"
  apt-get update -y
  apt-get install -y avahi-daemon
  hostnamectl set-hostname pulsar
  systemctl enable --now avahi-daemon
}

ensure_data_dir() {
  log "Preparing data directory at $DATA_DIR"
  mkdir -p "$DATA_DIR"/{postgres,redis,minio,caddy,shards}
  chmod 700 "$DATA_DIR"/shards
}

gen_secret() {
  # 32 base64 chars (24 raw bytes) — plenty of entropy without weird chars.
  openssl rand -base64 24 | tr -d '\n=+/' | cut -c1-32
}

gen_id() {
  printf "home-%s" "$(openssl rand -hex 6)"
}

ensure_env() {
  if [[ -f "$ENV_FILE" ]]; then
    log ".env already exists, skipping secret generation."
    return
  fi
  log "Generating fresh .env with random secrets…"
  cp "$HERE/.env.example" "$ENV_FILE"
  # POSIX-style sed -i with backup arg works on both BSD and GNU.
  sed_i() { sed -i.bak -e "$1" "$ENV_FILE" && rm -f "$ENV_FILE.bak"; }
  sed_i "s|^HOME_INSTANCE_ID=.*|HOME_INSTANCE_ID=$(gen_id)|"
  sed_i "s|^DB_PASSWORD=.*|DB_PASSWORD=$(gen_secret)|"
  sed_i "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=$(gen_secret)|"
  sed_i "s|^JWT_SECRET=.*|JWT_SECRET=$(gen_secret)$(gen_secret)|"
  sed_i "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$(gen_secret)$(gen_secret)|"
  sed_i "s|^WALLET_ENCRYPTION_SALT=.*|WALLET_ENCRYPTION_SALT=$(gen_secret)|"
  sed_i "s|^S3_ACCESS_KEY=.*|S3_ACCESS_KEY=pulsar-home|"
  sed_i "s|^S3_SECRET_KEY=.*|S3_SECRET_KEY=$(gen_secret)$(gen_secret)|"
  chmod 600 "$ENV_FILE"
}

compose() {
  (cd "$HERE" && docker compose -f docker-compose.home.yml --env-file "$ENV_FILE" "$@")
}

bring_up() {
  log "Building images (first run will take a while on RPi)…"
  compose build
  log "Starting services…"
  compose up -d
  log "Running database migrations…"
  # Small wait for postgres healthcheck; compose dep ordering already gates this.
  compose exec -T server npx prisma migrate deploy --schema=prisma/schema.prisma
}

smoke_check() {
  log "Waiting for proxy to answer (up to 60s)…"
  for i in $(seq 1 30); do
    if curl -fsS http://localhost/_pulsar_home_alive >/dev/null 2>&1; then
      log "Proxy is alive. Open http://pulsar.local on a LAN device."
      return
    fi
    sleep 2
  done
  die "Proxy did not respond. Check: docker compose -f $HERE/docker-compose.home.yml logs caddy"
}

main() {
  require_root
  log "Pulsar Home installer — repo: $REPO_ROOT"
  install_docker
  install_avahi
  ensure_data_dir
  ensure_env
  bring_up
  smoke_check
  log "Done. Status: docker compose -f $HERE/docker-compose.home.yml ps"
}

main "$@"
