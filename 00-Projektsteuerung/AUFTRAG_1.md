# AUFTRAG 1 an den Worker-Chat: Testinfrastruktur für `ap15b-incident-list-url.test.mjs`

> Stand: 2026-08-16. Verfasst von Claude (Rolle Orchestrator/Review, Cowork-Chat 1).
> Konvention wie `CODEX_ANFRAGE_*.md`: schriftliche Notiz, kein Chat-Kanal. Der Worker-Chat
> (Cowork-Chat 2) liest diese Notiz und arbeitet ausschließlich den hier umrissenen Scope ab.
> **Vor Beginn gilt:** Dennis hat bestätigt, dass der alte PowerShell-Orchestrator gestoppt ist
> (die vorhandene `.claude/automation/runtime/run.lock` vom 2026-08-12, pid 30912, ist nach
> aktueller Prüfung Altstand). Einzelschreiberregel aus `AGENTS.md` beachten: während dieses
> Auftrags schreibt nur der Worker im Vault.

## Ziel

`app/test/ap15b-incident-list-url.test.mjs` unter `node --test` lauffähig machen. Der Test
schlägt heute mit `ERR_MODULE_NOT_FOUND` fehl, weil er `../src/lib/incident-list-url.ts`
importiert und diese Datei intern `@/lib/status`, `@/lib/priority` und `@/lib/incident-list`
lädt — der `@/`-Alias ist ohne Test-Harness nicht auflösbar. Das ist **kein Produktivfehler**,
nur fehlende Testinfrastruktur in der Testdatei selbst.

## Umsetzungsweg (verbindliches Vorbild)

`registerHooks()` aus `node:module` in der Testdatei ergänzen, nach dem Muster von
`app/test/ap15-incident-metrics.test.mjs` (dort Zeilen ~96–117: `resolve`-Hook, der
`@/…`-Spezifizierer auf `../src/` abbildet; die dortige `resolveFile`-Hilfe übernimmt die
Endungsauflösung). Für diesen Test sind — anders als im Vorbild — **keine Stubs** nötig:
`status.ts` und `priority.ts` haben keine Importe, `incident-list.ts` nur Typ-Importe; weder
`server-only` noch `@/lib/db` werden transitiv geladen. Es genügt der generische
`@/`-Zweig des Hooks. Kopfkommentar der Testdatei entsprechend ergänzen (warum eigene Datei:
`registerHooks()` wirkt prozessweit; `node --test` startet je Testdatei einen eigenen Prozess —
gleiche Begründung wie im Vorbild).

## Positivliste (einzige erlaubte Datei)

- `app/test/ap15b-incident-list-url.test.mjs`

## Negativliste (ausdrücklich verboten)

- Keine Änderung an `app/src/**` (kein Produktivcode, auch nicht „zur Vereinfachung des Tests“).
- Keine Änderung an anderen Testdateien, Läufern (`run_db_tests.sh`, `run_ap14b_local.ps1`),
  `package.json`, CI-Workflows, Migrationen.
- Keine Änderung an `.claude/agents/**`, `run-*.ps1`, `PROJEKT_WISSEN.md`, `PROJEKTSTATUS.md`.
- Kein `git commit`, kein `git push`, kein Merge/Tag/Release.
- Keine neuen Dateien außer dieser Meldungsnotiz (siehe Meldeweg).

## Abnahmekriterium (DoD)

- `node --test app/test/ap15b-incident-list-url.test.mjs` (aus `app/` heraus:
  `node --test test/ap15b-incident-list-url.test.mjs`): **grün, Exit 0**, alle Fälle bestanden.
- Gesamtlauf `node --test test/*.test.mjs` (aus `app/`): **62 Top-Level-Einträge, 61 pass**,
  einzig verbleibender roter Eintrag ist die bekannte umgebungsbedingte Altlast
  `ap14b-auth.test.mjs` (Baseline vom 2026-08-16, von Claude selbst erhoben: 62 Einträge,
  60 pass, 2 fail — `ap14b-auth` und `ap15b-incident-list-url`). Läuft `ap14b-auth` in der
  Worker-Umgebung grün, ist 62/62 das Kriterium.
- Die bestehenden Testfälle der Datei bleiben inhaltlich unverändert (nur Infrastruktur ergänzt).
- Tatsächlich erhobene Ausgaben (Exit-Code, pass/fail-Zeilen) in der Meldung nennen — keine
  behaupteten Werte.

## Stopppunkt

Sofort anhalten und melden (statt weiterarbeiten), wenn: die Auflösung wider Erwarten Stubs
oder Änderungen außerhalb der Positivliste erfordert; derselbe Fehler dreimal auftritt
(Circuit Breaker); oder ein anderer Schreibzugriff im Vault bemerkt wird.

## Meldeweg

Nach Abschluss eine kurze Notiz `00-Projektsteuerung/MELDUNG_1.md` ablegen: geänderte Datei,
Diff-Kurzbeschreibung, exakte Prüfergebnisse mit Exit-Codes, `git status --porcelain`-Auszug
zum eigenen Änderungsumfang, ausdrückliche Aussage „kein Commit, kein Push“. Alternativ meldet
Dennis „fertig“ im Chat 1; das Review (Diff-Prüfung gegen `PROJEKT_WISSEN.md`/`AGENTS.md`)
erfolgt danach durch Chat 1 als `REVIEW_1.md`.
