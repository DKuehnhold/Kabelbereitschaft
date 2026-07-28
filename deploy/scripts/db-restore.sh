#!/usr/bin/env bash
# Wiederherstellung einer Datenbanksicherung.
#
# Aufruf: ./db-restore.sh <stage|production> <dumpdatei>
#
# Kein automatischer Aufruf. Das Skript ist ausdruecklich destruktiv und
# verlangt eine ausgeschriebene Bestaetigung. In Produktion ist zusaetzlich
# die Freigabe durch Dennis erforderlich.
#
# Grenze: stellt ausschliesslich PostgreSQL wieder her. Die zugehoerigen
# Bildobjekte (ab Arbeitspaket B, MinIO) muessen aus derselben Sicherungsrunde
# getrennt wiederhergestellt werden, sonst entstehen Datenbankzeilen ohne
# Objekt (siehe ADR-011, 2.8).

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

[[ $# -eq 2 ]] || { echo "Aufruf: db-restore.sh <stage|production> <dumpdatei>" >&2; exit 64; }
readonly ENVIRONMENT="$1"
readonly DUMP="$2"
case "${ENVIRONMENT}" in stage|production) ;; *) echo "Unbekannte Umgebung" >&2; exit 64 ;; esac
[[ -s "${DUMP}" ]] || { echo "Dumpdatei nicht gefunden oder leer: ${DUMP}" >&2; exit 66; }

if [[ -f "${DUMP}.sha256" ]]; then
  echo "Pruefe Pruefsumme."
  sha256sum -c "${DUMP}.sha256"
fi

readonly COMPOSE_FILES=(-f "${DEPLOY_DIR}/compose.yml" -f "${DEPLOY_DIR}/compose.${ENVIRONMENT}.yml")

cat <<TXT

ACHTUNG: Die Wiederherstellung ueberschreibt den aktuellen Datenbestand der
Umgebung "${ENVIRONMENT}" unwiderruflich.

Quelle: ${DUMP}

TXT
read -r -p 'Zum Fortfahren "WIEDERHERSTELLEN" eingeben: ' answer
[[ "${answer}" == "WIEDERHERSTELLEN" ]] || { echo "Abgebrochen."; exit 1; }

echo "Stoppe Anwendung, damit keine Schreibzugriffe erfolgen."
docker compose "${COMPOSE_FILES[@]}" stop app

echo "Stelle Datenbank wieder her."
docker compose "${COMPOSE_FILES[@]}" exec -T postgres \
  sh -c 'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "${DUMP}"

echo "Starte Anwendung."
docker compose "${COMPOSE_FILES[@]}" up -d --wait --wait-timeout 120

"${SCRIPT_DIR}/healthcheck.sh" "${ENVIRONMENT}"
echo "Wiederherstellung abgeschlossen. Bildobjekte separat pruefen."
