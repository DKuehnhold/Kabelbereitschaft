#!/usr/bin/env bash
# Datenbanksicherung des Compose-Stacks.
#
# Aufruf: ./db-backup.sh <stage|production> [zielverzeichnis]
#
# Erzeugt einen konsistenten Dump im Custom-Format (pg_dump -Fc) im Container
# und legt ihn im Zielverzeichnis auf dem Host ab. Zugangsdaten kommen aus
# deploy/env/postgres.env - NICHT als Kommandozeilenargument.
#
# Grenzen, die dokumentiert bleiben muessen:
#   - Dies sichert ausschliesslich PostgreSQL. Bilder liegen ab Arbeitspaket B
#     in MinIO und benoetigen eine EIGENE, zeitlich abgestimmte Sicherung.
#     Ein Dump ohne die zugehoerigen Objekte ist keine vollstaendige
#     Wiederherstellungsgrundlage (siehe ADR-011, 2.8).
#   - Aufbewahrungsdauer, Verschluesselung und Auslagerung des Backupziels
#     sind offene Infrastrukturentscheidungen (deploy/README.md).

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

[[ $# -ge 1 ]] || { echo "Aufruf: db-backup.sh <stage|production> [zielverzeichnis]" >&2; exit 64; }
readonly ENVIRONMENT="$1"
case "${ENVIRONMENT}" in stage|production) ;; *) echo "Unbekannte Umgebung" >&2; exit 64 ;; esac

readonly TARGET_DIR="${2:-${DEPLOY_DIR}/backups/${ENVIRONMENT}}"
readonly COMPOSE_FILES=(-f "${DEPLOY_DIR}/compose.yml" -f "${DEPLOY_DIR}/compose.${ENVIRONMENT}.yml")
readonly STAMP="$(date -u '+%Y%m%dT%H%M%SZ')"
readonly OUT="${TARGET_DIR}/kabelbereitschaft_${ENVIRONMENT}_${STAMP}.dump"

mkdir -p "${TARGET_DIR}"

echo "Sichere Datenbank (${ENVIRONMENT}) nach ${OUT}"

docker compose "${COMPOSE_FILES[@]}" exec -T postgres \
  sh -c 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "${OUT}"

if [[ ! -s "${OUT}" ]]; then
  echo "FEHLER: Dump ist leer." >&2
  exit 1
fi

sha256sum "${OUT}" > "${OUT}.sha256"
echo "Fertig: $(stat -c%s "${OUT}") Bytes, Pruefsumme in ${OUT}.sha256"
echo "HINWEIS: Bildobjekte (ab Arbeitspaket B, MinIO) sind hierin NICHT enthalten."
