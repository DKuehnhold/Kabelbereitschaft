#!/usr/bin/env bash
# Pruefung des Stackzustands nach Start, Update oder Rollback.
#
# Aufruf: ./healthcheck.sh <stage|production>
#
# Geprueft wird:
#   1. Containerzustand laut Docker (healthy)
#   2. /api/health im Container (ohne veroeffentlichten Port, deshalb per exec)
#
# Exit 0 = gesund, sonst 1.

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

[[ $# -eq 1 ]] || { echo "Aufruf: healthcheck.sh <stage|production>" >&2; exit 64; }
readonly ENVIRONMENT="$1"
case "${ENVIRONMENT}" in stage|production) ;; *) echo "Unbekannte Umgebung" >&2; exit 64 ;; esac

readonly COMPOSE_FILES=(-f "${DEPLOY_DIR}/compose.yml" -f "${DEPLOY_DIR}/compose.${ENVIRONMENT}.yml")
readonly ATTEMPTS="${HEALTHCHECK_ATTEMPTS:-12}"
readonly DELAY="${HEALTHCHECK_DELAY:-5}"

for attempt in $(seq 1 "${ATTEMPTS}"); do
  status="$(docker compose "${COMPOSE_FILES[@]}" ps --format '{{.Health}}' app 2>/dev/null | head -1 || true)"
  if [[ "${status}" == "healthy" ]]; then
    if docker compose "${COMPOSE_FILES[@]}" exec -T app node /app/docker/healthcheck.mjs >/dev/null 2>&1; then
      echo "Stack ${ENVIRONMENT}: gesund."
      exit 0
    fi
  fi
  echo "Versuch ${attempt}/${ATTEMPTS}: Zustand \"${status:-unbekannt}\" - warte ${DELAY}s."
  sleep "${DELAY}"
done

echo "Stack ${ENVIRONMENT}: NICHT gesund." >&2
docker compose "${COMPOSE_FILES[@]}" ps >&2 || true
docker compose "${COMPOSE_FILES[@]}" logs --tail 50 app >&2 || true
exit 1
