# Korrekturauftrag: AP14B MinIO-CI – anonymer Zustand

## Befund

Pull Request #5, CI-Lauf 30689463269: `verify`, `container` und `database` sind grün. Nur `objectstore` ist rot. Der erste Fehler liegt im Schritt `MinIO provisionieren`: Nach erfolgreichem `mc anonymous set none` meldet die gepinnte mc-Version den Zustand als `private`. Die Prüfung erwartet fälschlich die Zeichenfolge `none` und bricht mit `Anonyme Freigabe ... steht NICHT auf none` ab. Bucketanlage und private Schaltung waren laut Log erfolgreich.

## Positivliste

1. Korrigiere ausschließlich die Zustandsprüfung in `.github/workflows/ci.yml`, sodass der tatsächliche fail-closed Zustand `private` exakt akzeptiert wird. Kein lockerer Erfolgsfilter und kein Skip.
2. Formuliere Kommentar und Meldung entsprechend wahrheitsgemäß.
3. Prüfe YAML-Struktur, `git diff --check` und den eng begrenzten Diff. Falls lokal ohne Container kein echter MinIO-Lauf möglich ist, melde das; der verbindliche Nachweis erfolgt im erneut ausgelösten GitHub-CI-Lauf.
4. Pflege den Dashboardstatus nach bestehendem Schema.

## Negativliste

- Keine Produktcode-, SQL-, GUI-, Deploy- oder Dokumentationsänderung außer den unmittelbar betroffenen CI-Kommentaren/Meldungen.
- Kein Abschwächen, `|| true`, Skip oder `continue-on-error`.
- Kein Commit, Push, Merge, Tag oder Release.
- Keine zweite schreibende Orchestrierung.

## Definition of Done / Stopppunkt

Der Diff betrifft nur `.github/workflows/ci.yml` sowie den vom Orchestrator gepflegten, ignorierten Dashboardstatus. Ergebnis und echte Exitcodes in `result.json`, `stderr.log` ausgewertet, dann an Codex übergeben. Nichts committen oder pushen.
