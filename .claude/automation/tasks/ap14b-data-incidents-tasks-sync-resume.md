# AP14B fortsetzen: Vorgänge, Aufgaben und Offline-Sync

## Wiederaufnahme nach beendetem Orchestratorprozess

Der frühere Lauf `kb-ap14b-data-incidents-tasks-sync` ist nicht mehr aktiv;
`runtime/state.json` ist ein verwaister Laufstatus. Der vorhandene
Arbeitsstand ist zu erhalten und kontrolliert fortzuführen.

Verbindlicher Ausgangszustand:

- bestehender Vault, kein Ersatzordner oder Clone;
- Branch `feat/ap14b-data-incidents-tasks-sync`;
- `HEAD = origin/main = 7853fc89a8fdccaa822136c32dbdef1c8482377e`;
- keine `index.lock` und keine `HEAD.lock`;
- vorhandene Änderungen:
  - `app/src/app/api/incidents/[id]/meta/route.ts`
  - `app/src/app/api/sync/route.ts`
  - `app/src/lib/incident-actions.ts`
  - `app/src/lib/incident-list-actions.ts`
  - `app/src/lib/incidents.ts`
  - `app/src/lib/task-actions.ts`
  - `app/src/lib/tasks.ts`
  - `app/supabase/test/run_ap14b_local.ps1`
  - `app/supabase/test/run_db_tests.sh`
  - neu `app/src/lib/db/pg-errors.ts`
  - neu `app/supabase/migrations/0014_ap14b_data_grants.sql`

Bei einer anderen fachlichen Dateiliste anhalten und melden. Runtime-Dateien
unter `.claude/automation/runtime/` sind ignorierter Altstand und zählen nicht
zur fachlichen Dateiliste.

## Absolute Schutzregeln

- Bestehende Änderungen weder verwerfen noch pauschal überschreiben.
- Kein Reset, Restore, Checkout über Dateien, Stash, Clean oder Rebase.
- Zuerst jeden vorhandenen Diff vollständig lesen und gegen den ursprünglichen
  Auftrag `.claude/automation/tasks/ap14b-data-incidents-tasks-sync.md` prüfen.
- Kein Commit, Push, Merge, Tag oder Release.
- Keine sichtbare GUI-, Layout-, Styling-, Text- oder Navigationsänderung.
- Keine Supabase-Cloud, kein selbst gehostetes Supabase, kein Ersatzbackend.
- Nur PostgreSQL 18 + Auth.js v5; MinIO bleibt eigenes Folgepaket.
- Nur synthetische Testdaten; keine echten IT-Zugangsdaten verwenden.

## Auftrag

Führe den ursprünglichen Auftrag
`.claude/automation/tasks/ap14b-data-incidents-tasks-sync.md` ab seinem
vorhandenen Zwischenstand vollständig zu Ende. Sein fachlicher Scope,
Architekturregeln, Prüfungen und Stopppunkt bleiben verbindlich.

Insbesondere:

1. Prüfe, welche der sieben Zieldateien bereits vollständig auf
   `app/src/lib/db/index.ts` und `withUserTransaction` umgestellt sind.
2. Schließe nur fehlende oder fehlerhafte Teile ab.
3. Prüfe `pg-errors.ts` und Migration `0014_ap14b_data_grants.sql` auf
   Notwendigkeit, minimalen Umfang, Parametrisierung, RLS und Least Privilege.
4. Stelle sicher, dass `run_ap14b_local.ps1` und `run_db_tests.sh` den
   vollständigen lokalen PostgreSQL-Testlauf reproduzierbar abdecken.
5. In den sieben Zieldateien müssen Supabase-Importe und
   `supabase.`-Zugriffe vollständig entfallen.
6. Mehrschrittige Vorgangs-, Aufgaben- und Sync-Operationen bleiben atomar,
   idempotent und fail-closed.

## Orchestrierung

Claude ist alleiniger Orchestrator.

- Starte zuerst mindestens eine read-only Bestandsanalyse und eine unabhängige
  read-only Sicherheitsprüfung mit vollständigem Agentenvertrag.
- Danach höchstens einen Schreibagenten gleichzeitig und nur für einen
  abgegrenzten Teil-Scope.
- `kb-tests-evidence` bleibt gegenüber versionierten Projektdateien strikt
  read-only. Nötige Teständerungen gehen als getrennter sequenzieller
  Schreibauftrag an `kb-implementierung`.
- Prüfe jedes Agentenergebnis und anschließend den vollständigen Gesamtdiff
  selbst.

## Definition of Done

Erhebe echte Nachweise:

- null Supabase-Treffer in allen sieben Zieldateien;
- TypeScript Exit 0;
- ESLint Exit 0;
- Einheitentests Exit 0;
- Produktions-Build Exit 0;
- vollständiger lokaler PostgreSQL-18-Lauf einschließlich der bisherigen und
  neuen AP14B-Fälle Exit 0;
- öffentliche Browser-Tests, soweit ohne echte IT-Zugänge möglich;
- RLS-/Rollenfälle für Admin, Disposition, zugewiesenen und fremden Monteur;
- Sync-Idempotenz, Konflikt, unzulässige Aktion und Rollback;
- temporäre Datenbanken, Prozesse, Ports und Protokolle vollständig entfernt;
- `git diff --check` Exit 0;
- `PROJEKT_WISSEN.md` nur mit bestätigten Ergebnissen knapp aktualisiert;
- vollständiger Git-Status, kein Commit/Push.

## Stopppunkt

Bei Architekturkonflikt, fehlendem zwingendem Zugriff, unerwartetem
Dateiumfang, Datenverlustgefahr oder dreimal demselben Fehler stoppen und mit
Rohbefund an Codex übergeben. Keine Scope-Erweiterung und kein Ersatzweg.
