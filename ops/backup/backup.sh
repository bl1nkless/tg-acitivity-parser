#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
BACKUP_DIR="${1:-./backups}"
mkdir -p "${BACKUP_DIR}"

CONTAINER_ID=$(docker compose -f ops/docker/docker-compose.yml ps -q postgres)
if [[ -z "${CONTAINER_ID}" ]]; then
  echo "Postgres container is not running." >&2
  exit 1
fi

FILENAME="${BACKUP_DIR}/postgres-${TIMESTAMP}.sql.gz"
docker exec "${CONTAINER_ID}" pg_dump -U postgres | gzip > "${FILENAME}"
echo "Backup stored at ${FILENAME}"
