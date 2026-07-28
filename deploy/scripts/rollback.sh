#!/usr/bin/env bash
# Rueckkehr auf eine vorherige Image-Version.
#
# Aufruf:
#   ./rollback.sh <stage|production> [image-referenz]
#
# Ohne Angabe einer Referenz wird die zuletzt von deploy.sh protokollierte
# Vorgaengerversion aus deploy/state/previous-image.<umgebung> verwendet.
#
# Wichtig: Ein Rollback betrifft ausschliesslich die ANWENDUNG. Die Datenbank
# wird nicht zurueckgesetzt. Die Migrationen des Projekts sind additiv, ein
# Rueckwaertsschritt des Schemas ist nicht vorgesehen (Forward-Fix bevorzugt).

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly STATE_DIR="${DEPLOY_DIR}/state"
readonly LOG_FILE="${STATE_DIR}/deploy.log"

log() { printf '%s  %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "ROLLBACK $*" | tee -a "${LOG_FILE}"; }
die() { log "FEHLER: $*"; exit 1; }

[[ $# -ge 1 ]] || { echo "Aufruf: rollback.sh <stage|production> [image-referenz]" >&2; exit 64; }
readonly ENVIRONMENT="$1"
case "${ENVIRONMENT}" in stage|production) ;; *) die "Unbekannte Umgebung: ${ENVIRONMENT}" ;; esac

mkdir -p "${STATE_DIR}"

TARGET="${2:-}"
if [[ -z "${TARGET}" ]]; then
  [[ -s "${STATE_DIR}/previous-image.${ENVIRONMENT}" ]] \
    || die "Keine Vorgaengerversion protokolliert. Referenz bitte angeben."
  TARGET="$(cat "${STATE_DIR}/previous-image.${ENVIRONMENT}")"
fi

readonly COMPOSE_FILES=(-f "${DEPLOY_DIR}/compose.yml" -f "${DEPLOY_DIR}/compose.${ENVIRONMENT}.yml")

log "Ziel: ${TARGET}"

export APP_IMAGE_REF="${TARGET}"

docker compose "${COMPOSE_FILES[@]}" config >/dev/null || die "Compose-Konfiguration ungueltig."
docker compose "${COMPOSE_FILES[@]}" pull app || die "Image ${TARGET} nicht verfuegbar."
docker compose "${COMPOSE_FILES[@]}" up -d --wait --wait-timeout 120 \
  || die "Rollback gestartet, aber nicht gesund. Manueller Eingriff notwendig."

"${SCRIPT_DIR}/healthcheck.sh" "${ENVIRONMENT}" || die "Healthcheck nach Rollback nicht erfolgreich."

log "Erfolgreich auf ${TARGET} zurueckgestellt."
