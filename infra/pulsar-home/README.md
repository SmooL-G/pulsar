# Pulsar Home

Self-hosted Pulsar in a box. Plug a Raspberry Pi (or x86 mini-PC) into your
network, run one script, and you have a personal Pulsar server on
`pulsar.local` that also acts as a node in the global Pulsar key-storage
network and earns PLS for uptime.

This is Phase 1 of the [Pulsar Home plan](../../../C:/Users/smool/.claude/plans/quiet-prancing-dove.md):
single-machine, single-user, LAN-only, with a mocked heartbeat signer. ATECC
hardware, the captive-portal first-boot wizard, and federation come in later
phases.

## What's in this directory

| File | Purpose |
|---|---|
| `docker-compose.home.yml` | Postgres + Redis + MinIO + server + web + node-agent + Caddy |
| `Caddyfile` | LAN reverse proxy (HTTP-only on v1, internal TLS in v2) |
| `.env.example` | Template — `install.sh` fills in random secrets |
| `install.sh` | One-shot installer for Raspberry Pi OS / Ubuntu |
| `node-agent/` | Heartbeat agent (mock-signs for now, ATECC608B driver in Phase 2) |

## Hardware

Tested target: **Raspberry Pi 5, 4GB RAM**, with a 128GB NVMe SSD via the
official M.2 HAT. RPi 4 with 4GB also works but feels sluggish on first build.
On x86, anything from an Intel N100 mini-PC upward is comfortable.

```
~$108 BOM (RPi 5 reference):
  RPi 5 4GB + PSU            $65
  NVMe HAT + 128GB SSD       $25
  Case + cooling             $10
  WiFi antenna (built-in OK) — 
  (Phase 2 adds e-ink + ATECC608B)
```

## Quick start

On a fresh Raspberry Pi OS Lite (64-bit) or Ubuntu 24.04:

```bash
# 1. Clone the Pulsar repo
git clone https://github.com/SmooL-G/pulsar.git
cd pulsar/infra/pulsar-home

# 2. Run the installer
sudo bash install.sh
```

The installer:
- Installs Docker + Compose (idempotent — skips if present)
- Installs avahi/mDNS and sets the hostname to `pulsar` so the box answers on `pulsar.local`
- Creates `/var/lib/pulsar-home/` with subdirs for Postgres / Redis / MinIO / shards
- Generates `.env` with random JWT/DB/Redis/MinIO secrets — kept at mode 600
- Builds the images (Prisma's `binaryTargets: ["native", ...]` picks up ARM64 at build time)
- Brings up the stack, runs `prisma migrate deploy`
- Smoke-checks the proxy at `http://localhost/_pulsar_home_alive`

When it finishes, open `http://pulsar.local` from any device on the same Wi-Fi.

## What's running

```
pulsar.local (Caddy :80)
├── /api/*       → pulsar-server:3001  (Fastify REST + Socket.IO)
├── /socket.io/* → pulsar-server:3001
├── /media/*     → pulsar-minio:9000
├── /node/*      → pulsar-node-agent:4000 (status JSON)
└── /            → pulsar-web:80         (React app)

Internal only:
- pulsar-postgres:5432
- pulsar-redis:6379
- pulsar-minio:9000  (S3 API)
```

Disk usage lives under `/var/lib/pulsar-home/`. Back it up with `tar` /
`restic` / `rsync` — that one directory plus `.env` is the entire state.

## What the node-agent does

Every `HEARTBEAT_INTERVAL_SEC` (default 30s) it:
1. Signs a payload `{instanceId, timestamp, shardCount, publicKey}` with the
   node keypair.
2. POSTs to `${COORDINATOR_URL}/api/v1/nodes/heartbeat`.

You can inspect status from any LAN device: `curl http://pulsar.local/node/status`.

In v1, signing is **mock** — an Ed25519 key is generated on first start and
persisted to `/var/lib/pulsar-home/shards/node-key.bin`. Phase 2 swaps the
key generation/signing path for the ATECC608B over I²C — the coordinator's
heartbeat endpoint will then verify against a hardware-attested public key
to block sybil farms (see Open Question #1 in the plan).

The coordinator endpoint (`POST /api/v1/nodes/heartbeat`) doesn't exist yet —
that's the next slice. v1 node-agents will log `coordinator returned 404`
until it's wired up.

## Troubleshooting

```bash
# Tail everything
docker compose -f docker-compose.home.yml logs -f

# Just the server
docker compose -f docker-compose.home.yml logs -f server

# Restart after editing .env
docker compose -f docker-compose.home.yml --env-file .env up -d

# Nuke and restart (KEEPS DATA in /var/lib/pulsar-home)
docker compose -f docker-compose.home.yml down
docker compose -f docker-compose.home.yml up -d --build

# Full reset (DELETES DATA)
docker compose -f docker-compose.home.yml down -v
rm -rf /var/lib/pulsar-home
rm .env
sudo bash install.sh
```

mDNS not resolving `pulsar.local`?
- Windows clients need [Bonjour Print Services](https://support.apple.com/kb/dl999) or iTunes installed.
- Android by itself doesn't speak mDNS — use the device's IP, or install nip.io-style hostname later.
- On Linux: `sudo apt install libnss-mdns` if missing.

## Phase roadmap (recap)

| Phase | What ships |
|---|---|
| **1 (this)** | Single-machine compose, mock signer, manual install |
| 2 | First-boot AP + captive portal wizard, mDNS detection in web client, real ATECC608B signing |
| 3 | Federation between Home servers via the coordinator, offline-store fallback |
| 4 | PCB + custom case, batch of 100 |

See [the full plan](../../../C:/Users/smool/.claude/plans/quiet-prancing-dove.md) for context.
