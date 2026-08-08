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
# 0015 vorher, wuerde D18 scheitern. Es folgen die Bildrechte (0016) mit Smoke
# 22 und die administrative Benutzerverwaltung (0017) mit Smoke 23; die Kette
# reicht damit von 0001 bis 0017. run_ap12_local.ps1 bleibt als historischer
# lokaler AP12/AP13-Nachweis unveraendert; run_ap14b_local.ps1 ist das Windows-
# Gegenstueck zu dieser Datei.
#
# Neu aus AP15-1: als LETZTER Eintrag der SQL-Kette laeuft
# 24_ap15_dashboard_metrics.sql (Statuskennzahlen des Dashboards, Fallkennung K).
# Er steht bewusst ganz am Ende, weil seine fuenf Kennzahlen ABSOLUT ueber die
# gesamte public.incident_list_view zaehlen: er darf die Fixtures der
# Vorgaengerdateien nicht voraussetzen und nimmt seine eigene Wirkung am Ende
# vollstaendig per rollback zurueck. Eine neue Migration braucht er nicht - die
# Migrationskette endet unveraendert bei 0017.
#
# Seit AP14/B laufen hier NICHT mehr ausschliesslich SQL-Dateien: nach der
# SQL-Kette koennen optional Node-Suiten mit echtem Anwendungscode gegen
# dieselbe temporaere Datenbank ausgefuehrt werden.
#
# Seit AP15-5 sind es FUENF Node-Suiten. Sie laufen in genau dieser Reihenfolge:
#   1. test/integration/ap14b-platform.int.mjs               (src/lib/db,
#      src/lib/auth-service, scripts/bootstrap-admin.mjs)
#   2. test/integration/ap14b-masterdata-inventory.int.mjs   (src/lib/masterdata*,
#      src/lib/inventory*)
#   3. test/integration/ap14b-images.int.mjs                 (src/lib/image-*,
#      src/lib/images-server, src/lib/minio-storage gegen den prozessinternen
#      synthetischen S3-Testendpunkt - ausdruecklich KEIN MinIO)
#   4. test/integration/ap14b-admin-users.int.mjs            (src/lib/admin-users)
#   5. test/integration/ap15-dashboard-metrics.int.mjs       (src/lib/incident-metrics)
#
# Die Reihenfolge 1 vor 4 ist ZWINGEND: Fall I13 der Plattformsuite sichert
# `usableAdminCount() == 0` als Ausgangslage zu; gezaehlt werden dort
# anmeldefaehige Administratoren mit Argon2id-Hash. Die Konten der Suite der
# administrativen Benutzerverwaltung entstehen zur Laufzeit mit einem echten
# Argon2id-Hash; ihre beiden aktiven, nicht gesperrten Admin-Fixtures wuerden
# dort mitgezaehlt. Die Benutzerverwaltung raeumt ihre Konten selbst ab; die
# Reihenfolge ist trotzdem einzuhalten.
#
# Alle fuenf Suiten haengen an derselben Steuerung AP14B_INTEGRATION und laufen
# gegen dieselbe temporaere Datenbank.
#
# Aufruf:
#   PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=... ./run_db_tests.sh
#
# Steuerung der Integrationsphase:
#   AP14B_INTEGRATION=require   Alle fuenf Integrationssuiten MUESSEN laufen und
#                               MUESSEN gelingen. Jede fehlende Voraussetzung
#                               (node, app/node_modules, Testdateien,
#                               Zufallsquelle fuer das Rollenkennwort) beendet
#                               den Lauf fail-closed mit einem Exitcode ungleich
#                               0.
#   sonst / nicht gesetzt       Keine der fuenf Integrationssuiten laeuft. Der
#                               Verzicht wird ausdruecklich gemeldet - es gibt
#                               keinen stillen Verzicht.
#
# Verhalten:
#   - legt eine temporaere Datenbank an und entfernt sie am Ende immer
#   - ON_ERROR_STOP=1 je Datei
#   - massgeblich ist der Exitcode von psql; NOTICE-Ausgaben auf stderr sind
#     kein Fehler (gleiche Begruendung wie in der PowerShell-Fassung)
#   - jede Zeile der Form "SMOKE ... FAIL" laesst den Lauf fehlschlagen
#   - im Modus "require" laesst zusaetzlich jeder Exitcode ungleich 0 einer der
#     fuenf Node-Suiten den gesamten Lauf fehlschlagen; die jeweils folgenden
#     Suiten laufen dann nicht mehr

set -euo pipefail

readonly TEST_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SUPABASE_ROOT="$(cd "${TEST_ROOT}/.." && pwd)"
readonly MIGRATIONS="${SUPABASE_ROOT}/migrations"
# Wurzel der Anwendung (app/). Bewusst aus den vorhandenen Pfadvariablen
# abgeleitet und nicht fest verdrahtet - hier liegen node_modules und test/.
readonly APP_ROOT="$(cd "${SUPABASE_ROOT}/.." && pwd)"
readonly DB="kabelbereitschaft_test_$(date -u '+%Y%m%d_%H%M%S')_$$"
# Anmelderolle der Integrationsphase. Sie traegt denselben Zeitstempel und
# dieselbe Prozesskennung wie die Datenbank, damit parallele Laeufe sich weder
# die Datenbank noch die Rolle streitig machen.
readonly APP_ROLE="kb_ci_test_${DB#kabelbereitschaft_test_}"

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
  # 0016 und 22 stehen aus demselben Grund HINTER 20_ap14b_data.sql: dessen Fall
  # D14 prueft ausdruecklich negativ, dass app_user kein delete auf
  # public.sync_actions besitzt (20_ap14b_data.sql:699). 0016 erteilt dieses
  # Recht nicht - die Negativpruefung bleibt also gueltig. Die Reihenfolge wird
  # trotzdem eingehalten: jede Rechtematrix steht unmittelbar vor ihrem Smoke,
  # die Kette bleibt lesbar, und ein spaeter ergaenztes Recht kann keine
  # bestehende Negativprobe still entwerten.
  "${MIGRATIONS}/0016_ap14b_image_grants.sql"
  "${TEST_ROOT}/22_ap14b_images.sql"
  # 0017 und 23 schliessen die Kette ab. Die Reihenfolge ist zwingend: die
  # Migration erteilt das spaltenbezogene update auf public.profiles.role, und
  # erst danach kann ihr Smoke es unter app_user nachweisen. Beide stehen
  # ausserdem HINTER 19a_ap14b_grant_reset.sql: dessen pauschales
  # `revoke all on all tables in schema public` soll den Spaltengrant aus 0017
  # gar nicht erst erreichen koennen.
  "${MIGRATIONS}/0017_ap14b_admin_user_management.sql"
  "${TEST_ROOT}/23_ap14b_admin_users.sql"
  # 24 steht GANZ AM ENDE der Kette und braucht keine eigene Migration. Grund:
  # seine fuenf Kennzahlen zaehlen ABSOLUT ueber die gesamte
  # public.incident_list_view und nicht relativ ueber eigene Kennungen. Er darf
  # deshalb weder die Fixtures der Vorgaengerdateien voraussetzen noch ihre
  # Zaehlungen stoeren: seine Sollwerte sind Differenzen (Staffsicht)
  # beziehungsweise Absolutwerte auf einer nachweislich leeren Ausgangslage
  # (neu angelegte Monteure), und die gesamte Wirkungsphase wird am Ende per
  # rollback zurueckgenommen. Ein Aufraeumen per DELETE ist wegen der
  # unbedingten Loeschsperre trg_incident_tasks_no_delete (0011:113-123) nicht
  # moeglich; der Smoke begruendet das in seinem Kopf.
  "${TEST_ROOT}/24_ap15_dashboard_metrics.sql"
)

for f in "${FILES[@]}"; do
  [[ -f "${f}" ]] || { echo "Testdatei fehlt: ${f}" >&2; exit 66; }
done

command -v psql >/dev/null 2>&1 || { echo "psql nicht gefunden." >&2; exit 69; }
command -v createdb >/dev/null 2>&1 || { echo "createdb nicht gefunden." >&2; exit 69; }

# ---------------------------------------------------------------------------
# Wertebereich von AP14B_INTEGRATION - fail-closed und BEWUSST GANZ AM ANFANG.
#
#   require - die Integrationsphase MUSS laufen und MUSS gelingen
#   skip    - sie laeuft ausdruecklich nicht (reiner SQL-Lauf)
#   leer/nicht gesetzt - wie skip, der Vorgabefall
#
# JEDER ANDERE WERT WIRD ABGEWIESEN. Ohne diese Pruefung entschiede ein einziger
# Zeichenvergleich still zugunsten des Verzichts: ein Tippfehler, eine andere
# Gross-/Kleinschreibung ("Require") oder ein Wert wie "required" fiele in den
# Verzichtszweig, der Lauf endete mit Exitcode 0 und der CI-Job waere GRUEN,
# ohne dass eine Zeile Anwendungscode gelaufen ist. Ein Nachweiswunsch, der sich
# vertippt, darf nicht als Nachweisverzicht durchgehen.
#
# WARUM HIER UND NICHT ERST BEI DER INTEGRATIONSPHASE: stuende die Pruefung
# unten, liefe zuerst die vollstaendige SQL-Kette samt angelegter Datenbank, und
# der Fehlwert faellt erst nach mehreren Minuten auf. Schlimmer: auf einer
# Umgebung ohne erreichbaren Server bricht schon `createdb` ab, der Lauf endet
# mit einem nichtssagenden Exitcode 1, und die eigentliche Ursache - der
# Tippfehler - wird von diesem Fehlschlag vollstaendig verdeckt. Eine
# Eingabepruefung gehoert vor die erste Nebenwirkung, nicht dahinter.
#
# Nach diesem Block ist der Wert bekannt gut; der Rest des Skripts liest ihn
# ohne ${...:-}-Vorgabe.
# ---------------------------------------------------------------------------
AP14B_INTEGRATION="${AP14B_INTEGRATION:-skip}"
case "${AP14B_INTEGRATION}" in
  require | skip) ;;
  *)
    echo "FEHLER: AP14B_INTEGRATION hat den unzulaessigen Wert \"${AP14B_INTEGRATION}\". Zulaessig sind ausschliesslich \"require\" und \"skip\"." >&2
    exit 64
    ;;
esac

cleanup() {
  local code=$?
  echo "Entferne temporaere Testdatenbank ${DB} ..."
  dropdb --if-exists --force "${DB}" || echo "WARNUNG: ${DB} konnte nicht entfernt werden." >&2
  # Die Rolle ERST NACH der Datenbank entfernen: solange die Datenbank besteht,
  # haengt an ihr das "grant connect ... to <rolle>" und "drop role" scheitert an
  # dieser Abhaengigkeit. Mit der Datenbank verschwindet ihre Zugriffsliste, die
  # Rolle laesst sich danach loeschen. ${ROLE_CREATED:-0} wegen set -u: das trap
  # steht bereits, bevor die Integrationsphase erreicht ist.
  if [[ "${ROLE_CREATED:-0}" == "1" ]]; then
    echo "Entferne temporaere Anmelderolle ${APP_ROLE} ..."
    # Wie beim dropdb oben: ein Fehlschlag warnt nur und verfaelscht den
    # Exitcode des eigentlichen Laufs nicht.
    psql -X -q -d postgres -v ON_ERROR_STOP=1 \
      -c "drop role if exists \"${APP_ROLE}\"" >/dev/null 2>&1 ||
      echo "WARNUNG: Rolle ${APP_ROLE} konnte nicht entfernt werden." >&2
  fi
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

# ---------------------------------------------------------------------------
# Sammelauszug ALLER bestandenen Smoke-Faelle.
#
# WARUM DIESER BLOCK NOETIG IST: die Schleife oben zeigt je Kettendatei nur
# `tail -n 40 "${LOG}"`, und ${LOG} waechst kumulativ. Von einer Datei mit vielen
# Faellen erscheinen deshalb ausschliesslich die LETZTEN gut vierzig Zeilen; die
# frueheren Faelle fallen aus der Anzeige. Bei 23_ap14b_admin_users.sql waren das
# nachweislich SMOKE U-FIXTURES sowie U1 bis U16 - also unter anderem die
# Fixture-Ausgangslage und die gesamte Rechtematrix. Wer nur das CI-Protokoll
# liest, saehe diese Nachweise nicht und muesste ihr Bestehen unterstellen.
#
# Die FEHLERERKENNUNG war davon nie betroffen: sie laeuft direkt ueber ${LOG}
# und nicht ueber die Anzeige. Es ging also ausschliesslich um die SICHTBARKEIT
# des erbrachten Nachweises - und ein Nachweis, den niemand sehen kann, ist im
# Protokoll so viel wert wie keiner.
#
# `sed` schneidet das psql-Praefix "NOTICE:  " ab, damit die Zeilen genauso
# lesbar sind wie im PowerShell-Gegenstueck run_ap14b_local.ps1.
# ---------------------------------------------------------------------------
echo
echo "--- Bestandene Smoke-Faelle der gesamten Kette ---"
grep -E 'SMOKE[[:space:]]+[^[:space:]]+[[:space:]]+OK' "${LOG}" | sed -E 's/^.*NOTICE:[[:space:]]+//'
echo "--- Ende des Sammelauszugs ---"

# ---------------------------------------------------------------------------
# Integrationsphase (AP14/B und AP15, fuenf Node-Suiten in fester Reihenfolge)
#
# Sie steht bewusst HINTER der FAIL-Auswertung der SQL-Kette: erst wenn die
# Datenbankseite nachweislich in Ordnung ist, hat ein Lauf des Anwendungscodes
# gegen dieselbe Datenbank Aussagekraft. Die Ausgabe JEDES der fuenf Node-Laeufe
# geht ausdruecklich direkt auf die Konsole und NICHT in ${LOG}; ${LOG} bleibt
# damit die reine Sammeldatei der SQL-Kette und die obige FAIL-Suche
# unveraendert wirksam.
#
# Der zulaessige Wertebereich von AP14B_INTEGRATION wird bereits ganz oben
# geprueft, bevor eine Datenbank entsteht.
# ---------------------------------------------------------------------------
if [[ "${AP14B_INTEGRATION}" == "require" ]]; then
  echo
  echo "Integrationssuiten (fuenf, Modus: require) ..."

  # Fail-closed, Schritt fuer Schritt: jede fehlende Voraussetzung beendet den
  # Lauf mit einem Exitcode ungleich 0 und benennt die Ursache. Ein stilles
  # Ueberspringen waere im Modus "require" ein vorgetaeuschter Nachweis.
  #
  # Node muss mindestens 22.18 sein (Typentfernung fuer die ueber
  # module-hooks.mjs geladenen .ts-Module). Eine aeltere Fassung faellt beim
  # Laden mit einem Exitcode ungleich 0 auf und wird unten erfasst.
  command -v node >/dev/null 2>&1 || {
    echo "FEHLER: node nicht gefunden - die fuenf Integrationssuiten koennen nicht laufen." >&2
    exit 69
  }
  # Konkret das Paketverzeichnis von pg: fehlt es, ist "npm ci" nicht gelaufen.
  # Der Test braucht zusaetzlich das native @node-rs/argon2, das aus derselben
  # Installation stammt.
  [[ -d "${APP_ROOT}/node_modules/pg" ]] || {
    echo "FEHLER: ${APP_ROOT}/node_modules/pg fehlt - 'npm ci' ist nicht gelaufen." >&2
    exit 69
  }
  readonly INT_HOOKS="${APP_ROOT}/test/integration/module-hooks.mjs"
  readonly INT_TEST="${APP_ROOT}/test/integration/ap14b-admin-users.int.mjs"
  # Suite der Dashboard-Statuskennzahlen (AP15-1); sie laeuft als FUENFTE. Sie
  # braucht eine ANDERE Hooks-Datei als die
  # Benutzerverwaltung: module-hooks-app.mjs stellt den Ersatz fuer `next/cache`
  # und `@/lib/auth` bereit, den die Anwendungsmodule ausserhalb von Next
  # verlangen. Beide Konstanten tragen deshalb eigene Namen - `readonly` laesst
  # eine Wiederverwendung ohnehin nicht zu.
  readonly INT_HOOKS_APP="${APP_ROOT}/test/integration/module-hooks-app.mjs"
  readonly INT_TEST_AP15="${APP_ROOT}/test/integration/ap15-dashboard-metrics.int.mjs"
  # Die drei seit AP15-5 zusaetzlich hier laufenden Suiten. Auch sie tragen
  # EIGENE Namen: die Konstanten oben sind `readonly` und nicht wiederverwendbar.
  readonly INT_TEST_PLATFORM="${APP_ROOT}/test/integration/ap14b-platform.int.mjs"
  readonly INT_TEST_MASTERDATA="${APP_ROOT}/test/integration/ap14b-masterdata-inventory.int.mjs"
  readonly INT_TEST_IMAGES="${APP_ROOT}/test/integration/ap14b-images.int.mjs"
  # Keine Suite, sondern eine Voraussetzung der Bildsuite: ap14b-images.int.mjs
  # importiert diese Datei STATISCH (dort Zeile 68). Fehlt sie, waere die Ursache
  # ohne diese Pruefung nur eine "Cannot find module"-Meldung aus dem Ladevorgang
  # und der Grund muesste erst gesucht werden.
  readonly INT_S3_ENDPOINT="${APP_ROOT}/test/integration/s3-test-endpoint.mjs"
  for f in "${INT_HOOKS}" "${INT_TEST}" "${INT_HOOKS_APP}" "${INT_TEST_AP15}" \
    "${INT_TEST_PLATFORM}" "${INT_TEST_MASTERDATA}" "${INT_TEST_IMAGES}" \
    "${INT_S3_ENDPOINT}"; do
    [[ -f "${f}" ]] || { echo "FEHLER: Testdatei fehlt: ${f}" >&2; exit 66; }
  done

  # Zufaelliges Kennwort der Anmelderolle. Es steht bewusst NICHT im Quelltext.
  # Ausschliesslich Hexziffern: der Wert geht unveraendert in eine
  # Verbindungszeichenfolge und braucht so keine Prozentkodierung.
  if command -v openssl >/dev/null 2>&1; then
    APP_ROLE_PASSWORD="$(openssl rand -hex 24)"
  elif [[ -r /dev/urandom ]] && command -v od >/dev/null 2>&1; then
    # Gleichwertiger Weg ohne openssl. od liest genau 24 Zufallsbytes und gibt
    # sie hexadezimal aus; tr entfernt Trenn- und Zeilenumbruchzeichen.
    APP_ROLE_PASSWORD="$(od -An -tx1 -N24 /dev/urandom | tr -d ' \n')"
  else
    echo "FEHLER: weder openssl noch /dev/urandom mit od verfuegbar - es laesst sich kein Zufallskennwort erzeugen." >&2
    exit 69
  fi
  [[ ${#APP_ROLE_PASSWORD} -ge 32 ]] || {
    echo "FEHLER: das erzeugte Rollenkennwort ist zu kurz." >&2
    exit 69
  }

  echo "Lege temporaere Anmelderolle ${APP_ROLE} an ..."
  # Das Merkmal wird VOR dem Versuch gesetzt: bricht die Anweisungsfolge nach
  # dem "create role" ab, existiert die Rolle bereits und muss trotzdem
  # aufgeraeumt werden.
  ROLE_CREATED=1
  # AUSDRUECKLICH KEINE Mitgliedschaft in der Eigentuemerrolle und kein
  # SUPERUSER: die beiden Waechter aus 0017 kennen eine Ausnahme fuer den
  # Eigentuemer. Waere die Anwendungsrolle Mitglied der Eigentuemerrolle, liefen
  # die Negativfaelle des Integrationstests wirkungslos durch und wuerden einen
  # Schutz belegen, der gar nicht gemessen wurde. Die Rechte kommen
  # ausschliesslich aus der NOLOGIN-Gruppenrolle app_user
  # (supabase/bootstrap/01_roles.sql).
  #
  # Das SQL kommt ueber die Standardeingabe und NICHT ueber "psql -c": ein
  # Argument stuende in der Prozessliste und damit das Kennwort. Die Ausgabe
  # wird verworfen, weil psql im Fehlerfall die beanstandete Anweisung im
  # Klartext zurueckmeldet - darin staende das Kennwort.
  if ! psql -X -q -d "${DB}" -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<SQL
create role "${APP_ROLE}" login password '${APP_ROLE_PASSWORD}'
  inherit nosuperuser nocreatedb nocreaterole nobypassrls;
grant app_user to "${APP_ROLE}";
grant connect on database "${DB}" to "${APP_ROLE}";
SQL
  then
    echo "FEHLER: die temporaere Anmelderolle ${APP_ROLE} konnte nicht angelegt werden. Die psql-Ausgabe wird bewusst unterdrueckt, weil sie das Kennwort enthalten kann." >&2
    exit 1
  fi

  echo
  echo "Fuehre Integrationstest der Plattform aus ..."
  # ERSTER der fuenf Aufrufe, und diese Stellung ist ZWINGEND: sein Fall I13
  # sichert `usableAdminCount() == 0` als Ausgangslage zu; die Zaehlfunktion
  # `usableAdminCount()` steht in derselben Suite und zaehlt anmeldefaehige
  # Administratoren mit Argon2id-Hash. Die Konten der Suite der administrativen
  # Benutzerverwaltung entstehen zur Laufzeit mit echten Argon2id-Hashes; ihre
  # beiden aktiven, nicht gesperrten Admin-Fixtures wuerden dort mitgezaehlt.
  # Er muss deshalb VOR ap14b-admin-users laufen.
  #
  # Wie bei allen fuenf Aufrufen: alle Werte gehen als Umgebungsvariablen
  # (Zuweisungspraefix) an node und NICHT als Argumente - in der Prozessliste
  # steht damit kein Kennwort. Die Verbindungszeichenfolge der EIGENTUEMERROLLE
  # traegt bewusst KEIN eingebettetes Kennwort (Begruendung beim Aufruf der
  # administrativen Benutzerverwaltung weiter unten). Er benutzt
  # module-hooks.mjs: geprueft wird die echte Sitzungsauswertung, kein
  # Sitzungsstub.
  if ! (
    cd "${APP_ROOT}" &&
      AP14B_REQUIRE_INTEGRATION=1 \
      AP14B_APP_DATABASE_URL="postgresql://${APP_ROLE}:${APP_ROLE_PASSWORD}@${PGHOST}:${PGPORT}/${DB}" \
      AP14B_ADMIN_DATABASE_URL="postgresql://${PGUSER}@${PGHOST}:${PGPORT}/${DB}" \
      node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
      --import ./test/integration/module-hooks.mjs \
      test/integration/ap14b-platform.int.mjs
  ); then
    echo "FEHLER: der Integrationstest der Plattform ist fehlgeschlagen." >&2
    exit 1
  fi

  echo
  echo "Fuehre Integrationstest der Stammdaten- und Inventarmodule aus ..."
  # Zweiter, gleich gebauter Aufruf. Er braucht eine ANDERE Hooks-Datei als der
  # Plattformlauf: module-hooks-app.mjs stellt den Ersatz fuer `next/cache` und
  # `@/lib/auth` bereit, den die Fachmodule ausserhalb von Next verlangen.
  if ! (
    cd "${APP_ROOT}" &&
      AP14B_REQUIRE_INTEGRATION=1 \
      AP14B_APP_DATABASE_URL="postgresql://${APP_ROLE}:${APP_ROLE_PASSWORD}@${PGHOST}:${PGPORT}/${DB}" \
      AP14B_ADMIN_DATABASE_URL="postgresql://${PGUSER}@${PGHOST}:${PGPORT}/${DB}" \
      node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
      --import ./test/integration/module-hooks-app.mjs \
      test/integration/ap14b-masterdata-inventory.int.mjs
  ); then
    echo "FEHLER: der Integrationstest der Stammdaten- und Inventarmodule ist fehlgeschlagen." >&2
    exit 1
  fi

  echo
  echo "Fuehre Integrationstest des Bildpfades aus ..."
  # Dritter, gleich gebauter Aufruf mit derselben Hooks-Datei wie der
  # Stammdatenlauf.
  #
  # SEIN GEGENUEBER IST AUSDRUECKLICH KEIN MinIO: die Suite startet ueber
  # `startS3TestEndpoint()` den prozessinternen synthetischen S3-kompatiblen
  # Testendpunkt aus test/integration/s3-test-endpoint.mjs; ihren eigenen
  # Abgrenzungsblock dazu traegt die Suite im Dateikopf. Der gepruefte
  # ANWENDUNGSCODE ist der echte, ersetzt ist ausschliesslich der
  # Objektspeicher als Gegenueber. Der echte MinIO-Nachweis bleibt der
  # getrennte CI-Job `objectstore`; dieser Block ersetzt ihn nicht.
  if ! (
    cd "${APP_ROOT}" &&
      AP14B_REQUIRE_INTEGRATION=1 \
      AP14B_APP_DATABASE_URL="postgresql://${APP_ROLE}:${APP_ROLE_PASSWORD}@${PGHOST}:${PGPORT}/${DB}" \
      AP14B_ADMIN_DATABASE_URL="postgresql://${PGUSER}@${PGHOST}:${PGPORT}/${DB}" \
      node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
      --import ./test/integration/module-hooks-app.mjs \
      test/integration/ap14b-images.int.mjs
  ); then
    echo "FEHLER: der Integrationstest des Bildpfades ist fehlgeschlagen." >&2
    exit 1
  fi

  echo
  echo "Fuehre Integrationstest der administrativen Benutzerverwaltung aus ..."
  # Die Verbindungszeichenfolge der EIGENTUEMERROLLE traegt bewusst KEIN
  # eingebettetes Kennwort: der Node-Treiber pg faellt fuer eine Verbindung ohne
  # Kennwort auf die Umgebungsvariable PGPASSWORD zurueck, die dieses Skript
  # ohnehin schon geerbt hat. So steht das Kennwort der Eigentuemerrolle in
  # keiner Zeichenkette, die versehentlich in einem Protokoll landen koennte.
  #
  # AP14B_REQUIRE_INTEGRATION=1 ist die zweite Sicherung: ein leerer oder
  # falscher Verbindungswert fuehrt im Test nicht zu einem stillen Skip,
  # sondern zu einem Abbruch beim Laden des Moduls.
  #
  # Alle Werte gehen als Umgebungsvariablen (Zuweisungspraefix) an node und
  # NICHT als Argumente - in der Prozessliste steht damit kein Kennwort.
  if ! (
    cd "${APP_ROOT}" &&
      AP14B_REQUIRE_INTEGRATION=1 \
      AP14B_APP_DATABASE_URL="postgresql://${APP_ROLE}:${APP_ROLE_PASSWORD}@${PGHOST}:${PGPORT}/${DB}" \
      AP14B_ADMIN_DATABASE_URL="postgresql://${PGUSER}@${PGHOST}:${PGPORT}/${DB}" \
      node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
      --import ./test/integration/module-hooks.mjs \
      test/integration/ap14b-admin-users.int.mjs
  ); then
    echo "FEHLER: der Integrationstest der administrativen Benutzerverwaltung ist fehlgeschlagen." >&2
    exit 1
  fi

  echo
  echo "Fuehre Integrationstest der Dashboard-Statuskennzahlen aus (AP15-1) ..."
  # Fuenfter und letzter, gleich gebauter Aufruf: dieselben beiden
  # Verbindungszeichenfolgen, derselbe Zuweisungspraefix (kein Kennwort in der
  # Prozessliste), derselbe Pflichtmodus AP14B_REQUIRE_INTEGRATION=1. Einziger
  # Unterschied zum Aufruf der Benutzerverwaltung ist die Hooks-Datei: diese
  # Suite laedt die Anwendungsmodule und braucht deshalb module-hooks-app.mjs.
  if ! (
    cd "${APP_ROOT}" &&
      AP14B_REQUIRE_INTEGRATION=1 \
      AP14B_APP_DATABASE_URL="postgresql://${APP_ROLE}:${APP_ROLE_PASSWORD}@${PGHOST}:${PGPORT}/${DB}" \
      AP14B_ADMIN_DATABASE_URL="postgresql://${PGUSER}@${PGHOST}:${PGPORT}/${DB}" \
      node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
      --import ./test/integration/module-hooks-app.mjs \
      test/integration/ap15-dashboard-metrics.int.mjs
  ); then
    echo "FEHLER: der Integrationstest der Dashboard-Statuskennzahlen ist fehlgeschlagen." >&2
    exit 1
  fi

  # Alle fuenf Suiten sind gelaufen und alle fuenf haben mit 0 geendet - genau
  # das, und nichts darueber hinaus, sagt diese Zeile aus.
  INTEGRATION_RESULT="alle fuenf Suiten ausgefuehrt (Plattform, Stammdaten und Inventar, Bildpfad, administrative Benutzerverwaltung, Dashboard-Statuskennzahlen; AP14B_INTEGRATION=require)"
else
  echo
  echo "=================================================================="
  echo "HINWEIS: Keine der fuenf Integrationssuiten wurde ausgefuehrt"
  echo "         (AP14B_INTEGRATION=\"${AP14B_INTEGRATION}\"). Ausgelassen sind:"
  echo "         1. Plattform (ap14b-platform.int.mjs)"
  echo "         2. Stammdaten und Inventar (ap14b-masterdata-inventory.int.mjs)"
  echo "         3. Bildpfad (ap14b-images.int.mjs)"
  echo "         4. administrative Benutzerverwaltung (ap14b-admin-users.int.mjs)"
  echo "         5. Dashboard-Statuskennzahlen (ap15-dashboard-metrics.int.mjs)"
  echo "         Dieser Lauf belegt ausschliesslich die SQL-Kette. Fuer den"
  echo "         vollstaendigen Nachweis ist AP14B_INTEGRATION=require noetig."
  echo "=================================================================="
  INTEGRATION_RESULT="NICHT ausgefuehrt (AP14B_INTEGRATION ungleich require)"
fi

echo
echo "ERGEBNIS: AP10/AP11/AP12/AP13/AP14B/AP15 DATENBANKTESTS ERFOLGREICH."
echo "ERGEBNIS: Integrationsphase (Plattform, Stammdaten und Inventar, Bildpfad, administrative Benutzerverwaltung, Dashboard-Statuskennzahlen): ${INTEGRATION_RESULT}"
