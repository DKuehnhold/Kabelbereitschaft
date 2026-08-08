# AP15-5 letzte Korrektur: spröde Zeilenverweise und Hook-Zweckbeschreibung

## Ziel und Positivliste

Korrigiere ausschließlich Kommentarprovenienz, ohne Verhalten:

- `app/supabase/test/run_db_tests.sh`: nur die drei Kommentarstellen zur Reihenfolgekopplung/Begründung, die numerische Zeilenverweise auf `ap14b-platform.int.mjs`, `ap14b-admin-users.int.mjs` oder `ap14b-images.int.mjs` enthalten
- `app/test/integration/module-hooks-app.mjs`: nur Kopf/Zweckbeschreibung, die aktuell auf Stammdaten/Inventar verengt ist, sowie den Absatz „Geprüft werden ...", der nur vier Masterdata-/Inventory-Module nennt
- ignorierte operative Fortschrittsdatei, falls verlangt

## Negativliste

- Alle anderen Dateien und alle Nicht-Kommentarzeilen der beiden Positivdateien
- Keine Änderung an Testverhalten, Imports, Hooks, Runneraufrufen, Workflow, Produktcode, Migrationen, Paketen, Lockfiles oder Dokumentation
- Keine fremden unversionierten Dateien lesen oder verändern
- Kein Commit/Push/Merge/Tag/Release, kein RC1/V1

## Auftrag

1. Ersetze die numerischen Zeilenverweise im Runner durch wartungsfeste symbolische Aussagen: Fall I13 bzw. `usableAdminCount()` in der Plattform-Suite; zur Laufzeit erzeugte echte Argon2id-Hashes und aktive Admin-Fixtures in der Admin-Suite; `startS3TestEndpoint()` und die MinIO-Abgrenzung in der Bildsuite. Keine neuen Zeilennummern.
2. Beschreibe `module-hooks-app.mjs` quellentreu als Hook für Fachmodule außerhalb Next, der im Linux-CI-Runner von `ap14b-masterdata-inventory`, `ap14b-images` und `ap15-dashboard-metrics` benutzt wird. Die Zweckbeschreibung darf nicht nur Masterdata/Inventory nennen.
3. Ersetze den engen Absatz „Geprüft werden ..." durch eine quellentreue generische Aussage: Die jeweiligen Suiten importieren echten Anwendungscode einschließlich DB-Schicht; nur Next-Kontext/Sitzungsidentität werden über dokumentierte Stubs eingespeist; kein SQL oder Fachverhalten wird nachgebaut. Keine zusätzlichen Behauptungen.
4. Prüfe, dass ausschließlich Kommentare geändert wurden. Hashes der anderen fünf AP15-5-Dateien und von `ap14b-admin-users.int.mjs` bleiben gegen Laufbeginn identisch.

## Definition of Done und Evidence

- Genau zwei zusätzliche Kommentar-Diffs; keine numerischen `ap14b-*.int.mjs:<Zahl>`-Verweise mehr in `run_db_tests.sh`.
- `bash -n run_db_tests.sh` und `node --check module-hooks-app.mjs` Exit 0.
- Hashgleichheit der sechs geschützten AP15-5-Dateien belegt; `git diff --check` Exit 0.
- Jeder Agent nennt Scope, Dateien, Befehle und echte Exitcodes. Genau ein Schreiber.

## Stopppunkt

Stoppe nach minimaler Kommentarkorrektur und Evidence. Nicht committen/pushen und keinen Folgeauftrag beginnen.
