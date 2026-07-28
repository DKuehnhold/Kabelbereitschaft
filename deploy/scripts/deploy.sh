#!/usr/bin/env bash
# Kontrolliertes Update des Kabelbereitschaft-Stacks auf dem Zielserver.
#
# Wird MANUELL auf dem Server ausgefuehrt. Arbeitspaket A enthaelt bewusst
# keine SSH-Automatisierung und kein Deployment aus der CI.
#
# Ablauf:
#   1. Zielversion pruefen und aktuelle Version protokollieren
#   2. Compose-Konfiguration validieren
#   3. neues Image ziehen
#   4. Container aktualisieren
#   5. Healthcheck abwarten
#   6. bei Fehler automatisch auf die vorherige Version zurueckrollen
#   7. Ergebnis protokollieren
#
# Aufruf:
#   ./deploy.sh stage      ghcr.io/dkuehnhold/kabelbereitschaft@sha256:...
#   ./deploy.sh production ghcr.io/dkuehnhold/kabelbereitschaft@sha256:...
#
# In Produktion ist ausschliesslich ein DIGEST zulaessig (nicht widerrufbarer
# Bezug auf ein geprueftes Image). Fuer Stage ist auch ein Commit-SHA-Tag
# erlaubt. Es wird nie auf dem Server gebaut.
#
# Keine Secrets als Kommandozeilenargument. Zugangsdaten stehen
# ausschliesslich in deploy/env/*.env auf dem Server.

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly STATE_DIR="${DEPLOY_DIR}/state"
readonly LOG_FILE="${STATE_DIR}/deploy.log"

log() { printf '%s  %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" | tee -a "${LOG_FILE}"; }
die() { log "FEHLER: $*"; exit 1; }

usage() {
  cat >&2 <<'TXT'
Aufruf: deploy.sh <stage|production> <image-referenz>

  <image-referenz>  vollstaendige Referenz, z. B.
                    ghcr.io/dkuehnhold/kabelbereitschaft@sha256:abc...
                    (Produktion: Digest zwingend)
TXT
  exit 64
}

[[ $# -eq 2 ]] || usage
readonly ENVIRONMENT="$1"
readonly IMAGE_REF="$2"

case "${ENVIRONMENT}" in
  stage|production) ;;
  *) usage ;;
esac

if [[ "${ENVIRONMENT}" == "production" && "${IMAGE_REF}" != *"@sha256:"* ]]; then
  die "Produktion erfordert einen Image-Digest (…@sha256:…), keinen beweglichen Tag."
fi

readonly COMPOSE_FILES=(-f "${DEPLOY_DIR}/compose.yml" -f "${DEPLOY_DIR}/compose.${ENVIRONMENT}.yml")

command -v docker >/dev/null 2>&1 || die "docker nicht gefunden."
docker compose version >/dev/null 2>&1 || die "docker compose (v2) nicht verfuegbar."

mkdir -p "${STATE_DIR}"

# --- 1. aktuelle Version protokollieren --------------------------------------
CURRENT_IMAGE="$(docker compose "${COMPOSE_FILES[@]}" ps --format '{{.Image}}' app 2>/dev/null | head -1 || true)"
if [[ -n "${CURRENT_IMAGE}" ]]; then
  log "Aktuelle Version: ${CURRENT_IMAGE}"
  printf '%s\n' "${CURRENT_IMAGE}" > "${STATE_DIR}/previous-image.${ENVIRONMENT}"
else
  log "Keine laufende Version gefunden (Erstinstallation)."
fi

log "Zielversion: ${IMAGE_REF} (Umgebung ${ENVIRONMENT})"

# Vollstaendige Referenz an compose uebergeben (Tag oder Digest, siehe
# Kommentar in compose.yml).
export APP_IMAGE_REF="${IMAGE_REF}"

# --- 2. Konfiguration validieren --------------------------------------------
log "Validiere Compose-Konfiguration."
docker compose "${COMPOSE_FILES[@]}" config >/dev/null || die "Compose-Konfiguration ungueltig."

# --- 3. Image ziehen ---------------------------------------------------------
log "Ziehe Image."
docker compose "${COMPOSE_FILES[@]}" pull app || die "Image konnte nicht geladen werden."

# --- 4./5. aktualisieren und Health abwarten --------------------------------
log "Aktualisiere Container."
if ! docker compose "${COMPOSE_FILES[@]}" up -d --wait --wait-timeout 120; then
  log "Start oder Healthcheck fehlgeschlagen."
  docker compose "${COMPOSE_FILES[@]}" logs --tail 100 app | tee -a "${LOG_FILE}" || true

  if [[ -s "${STATE_DIR}/previous-image.${ENVIRONMENT}" ]]; then
    PREV="$(cat "${STATE_DIR}/previous-image.${ENVIRONMENT}")"
    log "Rollback auf ${PREV}."
    "${SCRIPT_DIR}/rollback.sh" "${ENVIRONMENT}" "${PREV}" || log "Rollback ebenfalls fehlgeschlagen - manueller Eingriff notwendig."
  else
    log "Kein Rollbackziel vorhanden (Erstinstallation)."
  fi
  die "Deployment abgebrochen."
fi

# --- 6./7. Ergebnis ---------------------------------------------------------
"${SCRIPT_DIR}/healthcheck.sh" "${ENVIRONMENT}" || die "Healthcheck nach dem Update nicht erfolgreich."

log "Deployment erfolgreich: ${IMAGE_REF}"
log "Hinweis: Datenbankmigrationen werden NICHT automatisch ausgefuehrt."
