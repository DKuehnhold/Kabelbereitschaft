# Dokumentationsauftrag: AP14B Bilder/MinIO grün nachziehen

## Verifizierter Ausgangsstand

- `main` = `origin/main` = `cbe17b3c1bf9118ae3b36ef85353cce46aa7d8c9`.
- Technik-Commit `edfafb482f6d4d95e69bd99e9b28c54ef7d92a87`, CI-Korrektur `cbe17b3c1bf9118ae3b36ef85353cce46aa7d8c9`.
- Pull Request #5 ist geschlossen und gemergt.
- PR-CI-Lauf `30691249168`: `verify`, `database`, `container`, `objectstore` jeweils `completed/success`; `objectstore` ist der echte MinIO-Container-Nachweis.
- Abschließende main-Läufe: CI `30692250157` vollständig `completed/success` (alle vier Jobs) und Container-Image `30692250154` `completed/success`.
- Lokale unabhängige Nachweise durch Codex: TypeScript, ESLint, 67 Unit-Tests, Produktions-Build, 21 `@public` Browser-/a11y-Tests; PostgreSQL 18 mit Migrationen 0001–0016, 103 Smokes, 0 Fehler, Integrationssuiten 30/30, 31/31, 37/37; temporäres Cluster vollständig entfernt.
- Arbeitsbaum sauber. Kein Tag, kein Release. V1 bleibt Produktionssperre.

## Positivliste

1. `PROJEKT_WISSEN.md`, `PROJEKTSTATUS.md` und `00-Projektsteuerung/ROADMAP_AP12_AP15_ENTWURF.md` knapp und widerspruchsfrei auf diesen Stand bringen.
2. Aktuelle Aussagen wie „nicht committet", „echter MinIO-Lauf steht aus" oder „Bilder/Uploads noch offen" korrigieren. Historische Versionszeilen nicht still umschreiben; neue Roadmap-Version 1.19 anfügen.
3. AP14B-Datenpfade einschließlich Bilder/MinIO als technisch abgeschlossen und gemergt kennzeichnen. AP14 insgesamt bleibt offen: echte IT-Adressen/Same-Origin-Reverse-Proxy, produktiver Betrieb/Deployment, vollständige `@app`-/Offline-Abnahme, CSP-Auswertung und V1 sind nicht erbracht.
4. Nächstes nicht-visuelles Paket benennen: administrative Benutzerverwaltung nach ADR-011 (Reset mit temporärem Passwort und `must_change_password`, Deaktivierung, Rollenwechsel, jeweils Sitzungswiderruf und Audit). Keine Implementierung in diesem Auftrag.
5. Dashboardstatus nach bestehendem Schema pflegen.

## Negativliste

- Keine Code-, SQL-, CI-, GUI- oder Deploy-Änderung.
- Keine erfundenen Nachweise, kein RC1-Abschluss, kein Tag/Release.
- Keine Historie löschen oder umdeuten.
- Kein Commit oder Push.

## Definition of Done / Stopppunkt

Genau die drei genannten versionierten Dokumente plus ignorierter Dashboardstatus. Konsistenz- und Diff-Prüfung, dann mit `result.json`, leerem/ausgewertetem `stderr.log` und Git-Status an Codex übergeben. Nichts committen oder pushen.
