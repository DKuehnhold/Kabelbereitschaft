# Anfrage an Codex: Koordination und Übergabe AP15-b/RC1

> Stand: 2026-08-12. Verfasst von Claude (Cowork-Sitzung, Gerätebrücke) auf Wunsch von Dennis.
> Gleiche Konvention wie `00-Projektsteuerung/CODEX_ANFRAGE_BILDSPEICHER_DATEISYSTEM.md`: eine
> schriftliche Notiz, kein Chat-Kanal — Codex liest sie bei seinem nächsten Lauf. Keine Umsetzung,
> keine Änderung an bestehenden Task-Dateien durch dieses Dokument.

## 1. Zuständigkeiten (Klärungsbedarf)

Am 2026-08-12 haben unabhängig voneinander gearbeitet:
- **Claude/Cowork** (dieses Werkzeug, Gerätebrücke): AP15-b-Erstimplementierung (Migration 0018,
  Filteroptionen, Vollmengen-Export, Datumsgrenze).
- **Der KB-Orchestrator** (`.claude/agents/kb-*.md` + `run-*.ps1`, lokal von Dennis gestartet):
  mehrere Korrektur-/Verifikationsläufe auf demselben Stand (`kb-ap15b-postgres-docker-verification*`,
  `kb-ap15b-correction-f1-f2-f5-callers`, `kb-ap15b-rc1-nonvisual-completion*`), die zwei echte
  Fehler in der Erstimplementierung gefunden und behoben haben (siehe Abschnitt 2).
- **Codex**: laut `AGENTS.md` zuständig für Architekturgrenzen/-freigabe.

Das lief **ohne gegenseitige Abstimmung** und wurde erst bemerkt, als sich Dateien unter den
Füßen der Cowork-Sitzung veränderten. Es kam zu keinem Datenverlust (der Orchestrator hat
ausschließlich additiv korrigiert), aber es war Zufall, kein Entwurf. Vorschlag zur Vermeidung
künftiger Kollisionen: wer eine Datei aus dem AP15-b-Umfang bearbeitet, legt vorher eine kurze
Notiz nach diesem Muster unter `00-Projektsteuerung/` ab (NICHT unter `.claude/automation/tasks/`,
da die Cowork-Gerätebrücke dorthin technisch keinen Schreibzugriff hat — "Writing to .claude is
not permitted via remote tools"). Codex möge bewerten, ob das ausreicht oder ob eine verbindlichere
Regel (z. B. Sperrdatei-Konvention, die alle drei Akteure respektieren) in `AGENTS.md` ergänzt
werden sollte.

## 2. Aktueller Stand zur Prüfung

AP15-b (Fehlalarm-Semantik, Datumsherkunft/Tagesgrenze, Filteroptionen, Vollmengen-Export) ist
nach dem Korrekturlauf `kb-ap15b-rc1-nonvisual-completion-mini` fachlich und sicherheitsseitig wie
folgt:

- **Migration `app/supabase/migrations/0018_ap15b_incident_metrics.sql`**: Spalte
  `is_false_alarm boolean not null default false`, idempotent hergestellt (Reparaturpfad für
  bereits vorhandene, nullable/default-lose Spalte). Wächter `tg_incident_guard_false_alarm` als
  **BEFORE INSERT OR UPDATE** (SQLSTATE 42501, nur Rolle `disponent`) — die ursprüngliche Fassung
  deckte nur UPDATE ab und ließ die Kennzeichnung über den Anlageweg (INSERT durch `admin`)
  umgehen. `incident_list_view` um `is_false_alarm` ergänzt, dabei korrekt ans ENDE der
  Spaltenliste gehängt (die ursprüngliche Fassung hatte die Spalte mitten in die Liste eingefügt,
  was `CREATE OR REPLACE VIEW` gegen die bereits von 0011 bestehende View mit einem Fehler
  abgelehnt hätte, da bestehende Spalten ihre Position behalten müssen).
- **UI-Verdrahtung** (bewusst minimal, keine neue Designentscheidung): Fehlalarm-Umschalter in
  `app/src/components/incidents/IncidentControls.tsx` (sichtbar nur bei `role === "disponent"`,
  Server-Action `setFalseAlarm()` in `incident-actions.ts`); Fehlalarm-Filter und
  Vollmengen-Export-Button in `app/src/components/incidents/list/OperationalList.tsx`.
- **Tests**: `app/supabase/test/25_ap15b_incident_metrics.sql` (SQL-Smoke, Idempotenz/Wächter/View),
  `app/test/ap15b-callers.test.mjs`, `app/test/ap15b-date-local.test.mjs` (8 Fälle, inkl. echtem
  DST-Wechsel-Fall), `app/test/ap15b-incident-list-url.test.mjs`.
- **Security-Review durch `kb-sicherheit-rls`**: bestanden — keine SQL-Injection, RLS/
  `security_invoker` intakt, Wächter-Logik korrekt, beide Funktionen produktiv mit
  Rollenprüfung verdrahtet.
- Ich (Claude/Cowork) habe Migration 0018 und `IncidentControls.tsx`/`incident-actions.ts`
  stichprobenartig gegengelesen — unabhängig vom Orchestrator-Selbstbericht — und keine
  Einwände gefunden.

**Bitte um Codex' Architektur-Gate-Prüfung dieses Stands**, bevor irgendein Commit/Push erwogen
wird.

## 3. Offene Blocker

- **PostgreSQL/Docker-Verifikation unvollständig**: sowohl der KB-Orchestrator-Lauf
  (`kb-tests-evidence`-Profil) als auch meine eigene Sandbox stießen auf Berechtigungs-/
  Umgebungsblocker beim Ausführen von Shell-Kommandos gegen einen echten PostgreSQL-18-Container.
  Es gibt damit **keinen** grünen End-to-End-Nachweis gegen eine echte Datenbank für Migration
  0018 — nur Code-Review und (in meinem Fall, sobald die Gerätebrücke wieder verfügbar ist)
  `tsc`/`lint`/`test:unit` ohne Datenbankanbindung.
- **`PROJEKT_WISSEN.md`**: der Abschnitt AP15-b ist bereits mit den F1/F2/F5-Korrekturen aktuell
  (Überschrift trägt den Korrekturlauf-Vermerk). Ein weiterer Bearbeitungsversuch
  (`kb-ap15b-document-current-evidence-mini`) wurde jedoch mit einer Berechtigungsverweigerung
  abgebrochen (Edit-Tool, Genehmigung angefordert, nicht erteilt) — der beabsichtigte Zusatz zu
  einer unabhängigen Codex-Verifikation (tsc/ESLint/114 Unit-Tests, Docker offen) ist dadurch
  **nicht** im Dokument gelandet. Falls das noch relevant ist, bitte gesondert nachtragen.
- Meine eigene unabhängige `tsc`/`lint`/`test:unit`-Bestätigung steht noch aus (Gerätebrücke war
  zeitweise komplett getrennt, danach blieb die isolierte Shell "Workspace unavailable"). Ich hole
  das nach, sobald sie wieder läuft, und ergänze das Ergebnis hier bzw. in PROJEKT_WISSEN.md.

## 4. GitHub-Stand

- `origin/main` = `45dfcb3ef418fe728436fa41ed615750e8d9b990` ("docs: record AP15-5 green CI",
  2026-08-08) — identisch mit lokalem `HEAD`. Keine offenen Pull Requests im Repository
  `DKuehnhold/Kabelbereitschaft`. Seit AP15-5 wurde nichts weiter gepusht.
- Das gesamte AP15-b/RC1-Material (meins und das des Orchestrators) ist **ausschließlich lokal,
  uncommitted** — genau wie in allen zugehörigen Aufträgen verlangt ("nicht committen, pushen").
  GitHub Actions/CI hat diesen Stand folglich noch nicht gesehen; es gibt keinen automatisierten
  CI-Lauf gegen Migration 0018.
- Ein Commit/Push/PR ist eine Entscheidung von Dennis, keine automatische Folge dieser Notiz. Sollte
  er sich dafür entscheiden, würde der CI-Job `database` (echte PostgreSQL-18-Service-Container)
  genau die in Abschnitt 3 offene Docker-Verifikationslücke schließen können — das wäre ein
  naheliegender Weg, den lokalen Blocker zu umgehen, statt ihn in der lokalen Umgebung weiter zu
  jagen.

---

Kein Commit, kein Push, keine Änderung an `.claude/agents`, `run-*.ps1` oder bestehenden
Auftragsdateien durch dieses Dokument.
