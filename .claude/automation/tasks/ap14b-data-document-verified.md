# AP14B Datenpfade – verifizierten Abschluss knapp dokumentieren

## Ziel

Ziehe ausschließlich den bestätigten AP14B-Datenstand in den führenden Projektstatusdokumenten und im Dashboard konsistent nach. Keine Fach- oder Codeänderung.

## Bestätigte Grundlage

- `main = origin/main = 6b9d8dd7b4b937b3a2cb055b509557ed17313430`
- Commit: `feat: migrate incident and task data paths to PostgreSQL`
- Lokaler PostgreSQL-18-Gesamtlauf: Exitcode 0; Bootstrap, Migrationen 0001–0014, Smokes 15–20 einschließlich 19a; 30/30 Node-Integrationstests; R1/R2/D13/D26/D27 grün; vollständige Bereinigung belegt.
- Unabhängige Codex-Wiederholung: TypeScript 0, ESLint 0, 41/41 Unit-Tests, Produktions-Build 0, `git diff --check` 0.
- GitHub Actions Push-Lauf für Commit `6b9d8dd`:
  - CI `30635566629`: completed/success
  - Container-Image `30635566645`: completed/success
- Kein Release, kein Tag, keine V1-Freigabe.

## Positivliste

1. Aktualisiere `PROJEKT_WISSEN.md` knapp: AP14B-Datenpfade für Vorgänge, Aufgaben und Offline-Sync sind auf PostgreSQL 18 migriert, lokal und in CI verifiziert. Nenne Commit und die beiden CI-Läufe sowie den Kern der Rechtematrix/Transaktionsabsicherung. Keine langen Testprotokolle duplizieren.
2. Aktualisiere `PROJEKTSTATUS.md` auf denselben bestätigten Stand und benenne klar den nächsten nicht-visuellen Arbeitsblock.
3. Aktualisiere `00-Projektsteuerung/ROADMAP_AP12_AP15_ENTWURF.md` konsistent: AP14B-Daten als technisch abgeschlossen markieren, ohne AP14 insgesamt oder RC1 voreilig abzuschließen. Version/Historie nach bestehendem Schema fortschreiben.
4. Aktualisiere `.claude/automation/status/fortschritt.json`: AP14B Daten = fertig, Staffelstab/Codex-Zustand wahrheitsgemäß; Gesamtfortschritt konservativ und als Einschätzung kennzeichnen. Nächster Block bleibt nicht-visuell.
5. Prüfe alle geänderten Dokumente auf Widersprüche, veraltete Aussagen zu AP14B-Daten, Supabase-Zielplattform und offenen Arbeitspaketen.

## Verbindliche Grenzen

- Nicht behaupten, dass Supabase bereits vollständig aus sämtlichen Modulen entfernt ist. Stammdaten/Inventar und weitere Restpfade sind separat zu migrieren.
- Zielplattform bleibt PostgreSQL 18 + Auth.js v5 + MinIO + Container hinter internem Reverse-Proxy; Supabase Cloud und selbst gehostetes Supabase ausgeschlossen.
- V1 bleibt Produktionssperre. Kein RC1-Tag, kein Release, keine endgültige Produktionsfreigabe.
- Branding bleibt separat, sofern die führenden Dokumente das weiterhin so führen.
- Keine GUI-/Designaussage erfinden.
- Keine Code-, SQL-, Workflow-, Runner- oder Testdatei ändern.
- Kein Commit, Push, Merge oder Tag.

## Definition of Done

- Genau drei versionierte Dokumente sind inhaltlich geändert: `PROJEKT_WISSEN.md`, `PROJEKTSTATUS.md`, `00-Projektsteuerung/ROADMAP_AP12_AP15_ENTWURF.md`.
- Dashboard ist aktualisiert, bleibt ignoriert und unversioniert.
- Commit, CI-Läufe, lokaler Nachweis und offene Grenzen stimmen in allen drei Dokumenten überein.
- `git diff --check` ist grün; Volltextsuche zeigt keine widersprüchliche AP14B-Statusaussage in den führenden Dokumenten.
- Handoff enthält vollständigen Diff-Umfang und Git-Status.

## Stopppunkt

Nach Übergabe an Codex anhalten. Nicht committen oder pushen.
