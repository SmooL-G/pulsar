#!/bin/bash
# Pulsar DB backup script — run on VPS 3 (data server) via cron
# Cron: 0 3 * * * /home/pulsar/app/infra/backup.sh >> /var/log/pulsar-backup.log 2>&1
set -e

BACKUP_DIR="/home/pulsar/backups"
DATE=$(date +%Y-%m-%d_%H-%M)
KEEP_DAILY=7
KEEP_WEEKLY=4

mkdir -p "$BACKUP_DIR"

# PostgreSQL dump
echo "[$(date)] Starting backup..."
docker exec pulsar-postgres pg_dump -U pulsar -Fc pulsar > "$BACKUP_DIR/pulsar_${DATE}.dump"
echo "[$(date)] Dump created: pulsar_${DATE}.dump ($(du -h "$BACKUP_DIR/pulsar_${DATE}.dump" | cut -f1))"

# Upload to S3-compatible storage (Cloudflare R2 / Backblaze B2)
# Configure rclone first: rclone config (create remote named "backup")
if command -v rclone &> /dev/null; then
  rclone copy "$BACKUP_DIR/pulsar_${DATE}.dump" backup:pulsar-backups/daily/
  echo "[$(date)] Uploaded to remote storage"

  # Weekly backup (every Sunday)
  if [ "$(date +%u)" = "7" ]; then
    rclone copy "$BACKUP_DIR/pulsar_${DATE}.dump" backup:pulsar-backups/weekly/
    echo "[$(date)] Weekly backup uploaded"
  fi
fi

# Cleanup old local backups
find "$BACKUP_DIR" -name "pulsar_*.dump" -mtime +${KEEP_DAILY} -delete
echo "[$(date)] Cleanup done. Remaining backups:"
ls -lh "$BACKUP_DIR"/pulsar_*.dump 2>/dev/null || echo "  (none)"

echo "[$(date)] Backup complete."
