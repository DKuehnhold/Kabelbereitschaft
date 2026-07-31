# AP14B finalisieren nach verwaistem Datenbanktest

## Architekturentscheidung zum Circuit Breaker

Der bisherige Hintergrund-Testweg wird **nicht** erneut ausgeführt. Drei
Versuche endeten ohne belastbaren Abschluss; beim letzten blieb ein
PostgreSQL-Testserver zurück, während der Claude-Lauf bereits beendet war.
Dieser alte Versuchspfad ist durch den Circuit Breaker geschlossen.

Codex hat den eindeutig identifizierten temporären Cluster
`kb_ap14b_cluster_20260731_103437` kontrolliert bereinigt:

- PostgreSQL über `pg_ctl stop -m fast -w` angehalten;
- temporäres Clusterverzeichnis entfernt;
- 0 zugehörige Prozesse verblieben.

Das ist kein bestandener Datenbanktest.

## Ausgangszustand

- Branch `feat/ap14b-data-incidents-tasks-sync`.
- `HEAD = 6675240f1bf9d7317682db98eaac9082c80974b8`
  (`chore(automation): maintain dashboard progress handoff`).
- Dashboard-Konfiguration ist bereits separat als PR #4 gepusht.
- Vorhandener uncommitteter AP14B-Fachstand muss erhalten bleiben.
- Kein anderer Claude-Orchestratorlauf und keine Git-Sperre.

Lies zuerst vollständig:

- `AGENTS.md`
- `CLAUDE.md`
- `PROJEKT_WISSEN.md`
- `PROJEKTSTATUS.md`
- `.claude/automation/status/fortschritt.json`
- ursprünglichen Auftrag
  `.claude/automation/tasks/ap14b-data-incidents-tasks-sync.md`
- Wiederaufnahmeauftrag
  `.claude/automation/tasks/ap14b-data-incidents-tasks-sync-resume.md`
- den vollständigen aktuellen Git-Diff.

## Positivliste

Fachänderungen nur in den bereits betroffenen AP14B-Dateien:

- `app/src/app/api/incidents/[id]/meta/route.ts`
- `app/src/app/api/sync/route.ts`
- `app/src/lib/incident-actions.ts`
- `app/src/lib/incident-list-actions.ts`
- `app/src/lib/incidents.ts`
- `app/src/lib/task-actions.ts`
- `app/src/lib/tasks.ts`
- `app/src/lib/db/pg-errors.ts`
- `app/supabase/migrations/0014_ap14b_data_grants.sql`
- `app/supabase/test/20_ap14b_data.sql`
- `app/supabase/test/18_ap13_tasks.sql`
- `app/supabase/test/run_ap14b_local.ps1`
- `app/supabase/test/run_db_tests.sh`
- `PROJEKT_WISSEN.md` nur nach bestätigtem Abschlussnachweis
- `.claude/automation/status/fortschritt.json` für ehrlichen Fortschritt und
  Staffelstab.

Keine weitere Datei ändern. Kein Commit, Push, Merge, Tag oder Release.

## Phase 1: Ursachenanalyse read-only

Claude delegiert zwei unabhängige read-only Prüfungen:

1. **Implementierungs-/Diffanalyse:** Vollständigkeit der sieben Zielmodule,
   `pg-errors.ts`, Migration 0014 und Test 20.
2. **Testprozess-/Sicherheitsanalyse:** Warum der Testserver den
   Orchestratorlauf überlebte; Prozessstart, Timeout, Warten, Logpuffer,
   `finally`-Aufräumung, RLS/Least-Privilege und Secrets.

Beide Agenten erhalten Positivliste, Negativliste, DoD und Stopppunkt. Kein
Agent startet einen Prozess oder ändert Dateien in dieser Phase.

## Phase 2: begrenzte Korrektur

Bewerte die Befunde selbst. Erteile höchstens einem Schreibagenten gleichzeitig
einen präzisen Korrekturauftrag.

Verbindlich:

- keine Wiederholung des alten Background-/Fire-and-forget-Testwegs;
- Testskript wartet synchron auf jeden Kindprozess und dessen Exit-Code;
- kein `run_in_background`, kein unbeaufsichtigter `Start-Process` ohne
  vollständiges Warten;
- stdout/stderr dürfen in temporäre Dateien umgeleitet werden, aber der
  aufrufende Vordergrundprozess bleibt bis zum Abschluss aktiv;
- `finally` stoppt den exakten temporären Server und entfernt ausschließlich
  den validierten Clusterpfad;
- vor und nach dem Test werden Prozess- und Pfadbestand geprüft;
- kein bestehender PostgreSQL-Dienst wird verändert.

## Phase 3: Nachweise

Zuerst schnelle Prüfungen synchron:

- null Supabase-Importe/`supabase.`-Zugriffe in den sieben Zieldateien;
- TypeScript;
- ESLint;
- Einheitentests;
- Produktions-Build;
- `git diff --check`.

Danach **genau ein neuer Datenbankversuch mit dem korrigierten synchronen
Ausführungsweg**. Das ist ein neuer, architektonisch geänderter Nachweispfad,
nicht ein vierter Versuch des gesperrten Hintergrundwegs.

Vorgaben:

- nicht im Hintergrund starten;
- Claude/Tests-Agent wartet auf den endgültigen Exit-Code;
- keine Abschlussübergabe, solange der Test noch läuft oder Ausgaben puffern;
- vollständige relevante Ausgabe und Exit-Code sichern;
- nach Abschluss nachweisen:
  - alle Migrationen einschließlich 0014 angewendet,
  - alle bisherigen Smokes plus Test 20 gelaufen,
  - keine `FAIL`-/`ERROR`-/`FATAL`-Zeile,
  - RLS/Rollenfälle und Sync-Fälle bestanden,
  - temporärer Server gestoppt,
  - Clusterverzeichnis entfernt,
  - Port frei,
  - 0 zugehörige Prozesse.

Wenn der korrigierte synchrone Versuch fehlschlägt:

- nicht erneut starten;
- Circuit Breaker sofort;
- ersten echten Fehler, Rohlog, Exit-Code und Aufräumstatus an Codex übergeben.

## Dashboard-Pflege

Bei Laufstart und Teilfortschritt
`.claude/automation/status/fortschritt.json` wahrheitsgemäß pflegen:
`staffelstab = "Claude"`. Keine erfundenen Prozentwerte.

Vor Abschlussübergabe:

- bei vollständigem Nachweis den bestätigten Stand eintragen;
- bei Fehler den Blocker und Aufräumstatus eintragen;
- `staffelstab = "Codex"` setzen.

## Definition of Done

- vollständiger, selbst geprüfter Gesamtdiff;
- alle schnellen Prüfungen mit echten Exit-Codes;
- genau ein abgeschlossener synchroner PostgreSQL-Gesamtlauf oder eindeutiger
  Circuit-Breaker-Befund;
- keinerlei temporäre Ressourcen;
- `PROJEKT_WISSEN.md` nur bei bestätigtem Ergebnis;
- Fortschrittsdatei aktuell;
- vollständiger Git-Status;
- kein Commit/Push.

## Stopppunkt

Bei Datei außerhalb der Positivliste, Datenverlustgefahr, fehlendem zwingendem
Zugang oder fehlgeschlagener Aufräumung sofort stoppen. Keine Ersatzumgebung,
kein Supabase und kein weiterer Testversuch.
