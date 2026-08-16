# Hinweis an den Orchestrator: Cowork-Session führt jetzt eigene AP15-b-Verifikation durch

> Stand: 2026-08-12. Verfasst von Claude (Cowork-Sitzung, Gerätebrücke, PID/Prozesskontext
> außerhalb dieses Orchestrators) — **kein Auftrag, keine Änderung an bestehenden Task-Dateien.**
> Reine Koordinationsnotiz nach demselben Muster wie `00-Projektsteuerung/CODEX_ANFRAGE_*.md`.
>
> Liegt bewusst hier und NICHT unter `.claude/automation/tasks/`: der Schreibzugriff der
> Cowork-Gerätebrücke auf `.claude/` ist technisch gesperrt ("Writing to .claude is not permitted
> via remote tools").

## Worum es geht

Dennis hat mich (Claude, Cowork) parallel zum KB-Orchestrator an AP15-b arbeiten lassen. Ich habe
den aktuellen Stand von `kb-ap15b-rc1-nonvisual-completion-mini` (Korrektur F1/F2/F5, UI-Verdrahtung
von `setIncidentFalseAlarm`/`exportIncidentListFull`, Migration 0018 idempotent + INSERT-Abdeckung)
bereits read-only geprüft — sieht stichprobenartig korrekt aus.

Ich führe jetzt, sobald die Gerätebrücke (`device_bash`) wieder erreichbar ist, eine eigene,
unabhängige Verifikation durch:

- `npm run typecheck` (`tsc --noEmit`)
- `npm run lint`
- `npm run test:unit` (`node --test test/*.test.mjs`)

gegen den aktuellen Arbeitsbaum unter `app/`.

## Bitte während dieses Fensters beachten

- Ich ändere dabei **keine Dateien** — ausschließlich lesende Prüfläufe.
- Falls parallel ein weiterer Orchestrator-Lauf (`run.lock`) aktiv ist und Dateien unter `app/src`,
  `app/supabase` oder `app/test` schreibt: bitte KEINE Koordination meinerseits erwarten, ich lese
  einfach den jeweils aktuellen Stand zum Zeitpunkt meines Laufs. Ein zeitgleicher Schreibzugriff
  von meiner Seite ist für dieses Fenster nicht vorgesehen.
- Ergebnis melde ich Dennis direkt im Cowork-Chat; falls es einen Widerspruch zum bereits in
  `PROJEKT_WISSEN.md` dokumentierten Stand ergibt, trage ich das dort als Ergänzung nach (nicht als
  Überschreibung bestehender Befunde).

Kein Commit, kein Push, keine Änderung an `.claude/agents` oder `run-*.ps1` durch mich.
