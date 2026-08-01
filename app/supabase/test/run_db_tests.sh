#!/usr/bin/env bash
# Plattformunabhaengiger Lauf der Datenbankpruefungen (AP14 / A10).
#
# Fuehrt zuerst die historische Kette samt AP10-AP13-Smokes aus und danach
# den endlichen AP14/B-Plattformwechsel (Migrationen 0012, 0013 und 0014 sowie
# die Smokes 19 und 20). Zusaetzlich laufen anschliessend die Rechtematrix der
# Stammdaten und des Inventars (Migration 0015) und ihr Smoke 21. Beide stehen
# bewusst HINTER 20_ap14b_data.sql: dessen Fall D18 prueft ausdruecklich
# negativ, dass app_user kein select auf public.inventory_movements und kein
# insert auf public.customers besitzt - genau diese Rechte erteilt 0015. Liefe
# 0015 vorher, wuerde D18 scheitern. run_ap12_local.ps1 bleibt als historischer
# lokaler AP12/AP13-Nachweis unveraendert; run_ap14b_local.ps1 ist das Windows-
# Gegenstueck zu dieser Datei.
#
# Aufruf:
#   PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=... ./run_db_tests.sh
#
# Verhalten:
#   - legt eine temporaere Datenbank an und entfernt sie am Ende immer
#   - ON_ERROR_STOP=1 je Datei
#   - massgeblich ist der Exitcode von psql; NOTICE-Ausgaben auf stderr sind
#     kein Fehler (gleiche Begruendung wie in der PowerShell-Fassung)
#   - jede Zeile der Form "SMOKE ... FAIL" laesst den Lauf fehlschlagen

set -euo pipefail

readonly TEST_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SUPABASE_ROOT="$(cd "${TEST_ROOT}/.." && pwd)"
readonly MIGRATIONS="${SUPABASE_ROOT}/migrations"
readonly DB="kabelbereitschaft_test_$(date -u '+%Y%m%d_%H%M%S')_$$"

export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-postgres}"

FILES=(
  "${SUPABASE_ROOT}/bootstrap/01_roles.sql"
  "${SUPABASE_ROOT}/bootstrap/02_compat_auth.sql"
  "${SUPABASE_ROOT}/bootstrap/03_compat_storage.sql"
  "${MIGRATIONS}/0001_init.sql"
  "${MIGRATIONS}/0002_storage.sql"
  "${MIGRATIONS}/0003_ap2_priority.sql"
  "${MIGRATIONS}/0004_ap3_inventory_rls.sql"
  "${MIGRATIONS}/0005_ap4_images.sql"
  "${MIGRATIONS}/0006_ap6_sync_idempotency.sql"
  "${MIGRATIONS}/0007_ap9_master_data.sql"
  "${MIGRATIONS}/0008_ap10_incident_master_data.sql"
  "${MIGRATIONS}/0009_ap11_incident_list_view.sql"
  "${MIGRATIONS}/0010_ap12_incident_details.sql"
  "${MIGRATIONS}/0011_ap13_tasks_bulk.sql"
  "${TEST_ROOT}/15_ap10_smoke.sql"
  "${TEST_ROOT}/16_ap11_list.sql"
  "${TEST_ROOT}/17_ap12_details.sql"
  "${TEST_ROOT}/18_ap13_tasks.sql"
  "${MIGRATIONS}/0012_ap14b_platform_auth.sql"
  "${MIGRATIONS}/0013_ap14b_drop_supabase_compat.sql"
  "${MIGRATIONS}/0014_ap14b_data_grants.sql"
  "${TEST_ROOT}/19_ap14b_platform.sql"
  "${TEST_ROOT}/19a_ap14b_grant_reset.sql"
  "${TEST_ROOT}/20_ap14b_data.sql"
  "${MIGRATIONS}/0015_ap14b_masterdata_inventory_grants.sql"
  "${TEST_ROOT}/21_ap14b_masterdata_inventory.sql"
)

for f in "${FILES[@]}"; do
  [[ -f "${f}" ]] || { echo "Testdatei fehlt: ${f}" >&2; exit 66; }
done

command -v psql >/dev/null 2>&1 || { echo "psql nicht gefunden." >&2; exit 69; }
command -v createdb >/dev/null 2>&1 || { echo "createdb nicht gefunden." >&2; exit 69; }

cleanup() {
  local code=$?
  echo "Entferne temporaere Testdatenbank ${DB} ..."
  dropdb --if-exists --force "${DB}" || echo "WARNUNG: ${DB} konnte nicht entfernt werden." >&2
  # Die ueber mktemp angelegte Sammeldatei ist eine Hilfsdatei des Laufs und
  # bleibt nicht zurueck. ${LOG:-} wegen set -u: das trap steht bereits, bevor
  # mktemp gelaufen ist.
  if [[ -n "${LOG:-}" ]]; then
    rm -f "${LOG}" || echo "WARNUNG: ${LOG} konnte nicht entfernt werden." >&2
  fi
  exit "${code}"
}

echo "Erzeuge temporaere Testdatenbank ${DB} ..."
createdb "${DB}"
trap cleanup EXIT

LOG="$(mktemp)"
for f in "${FILES[@]}"; do
  echo "Pruefe: $(basename "${f}")"
  set +e
  psql -X -d "${DB}" -v ON_ERROR_STOP=1 -f "${f}" >>"${LOG}" 2>&1
  code=$?
  set -e
  tail -n 40 "${LOG}"
  if [[ ${code} -ne 0 ]]; then
    echo "SQL-Lauf fehlgeschlagen: ${f}" >&2
    exit 1
  fi
done

if grep -Eq 'SMOKE[[:space:]]+[^[:space:]]+[[:space:]]+FAIL' "${LOG}"; then
  echo "Smoke-Tests enthalten FAIL-Meldungen:" >&2
  grep -E 'SMOKE[[:space:]]+[^[:space:]]+[[:space:]]+FAIL' "${LOG}" >&2
  exit 1
fi

echo
echo "ERGEBNIS: AP10/AP11/AP12/AP13/AP14B DATENBANKTESTS ERFOLGREICH."
