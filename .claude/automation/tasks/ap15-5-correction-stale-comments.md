# AP15-5 Korrektur: zwei durch die Fünf-Suiten-Reihenfolge veraltete Kommentare

## Ziel

Korrigiere ausschließlich zwei vom abgeschlossenen AP15-5-Evidence-Lauf selbst belegte, nun falsche Kommentare. Keine Verhaltensänderung und keine weitere Textbereinigung.

## Positivliste

- `app/test/integration/module-hooks-app.mjs`: nur der Kommentar, der derzeit eine ausschließliche Nutzung durch `ap14b-masterdata-inventory.int.mjs` behauptet
- `app/test/integration/ap14b-admin-users.int.mjs`: nur der Kommentar, der die Suite als „LETZTER der vier" bezeichnet
- ignorierte operative Fortschrittsdatei, falls vom Starter verlangt

## Negativliste

- Alle anderen Dateien; insbesondere die fünf bereits geänderten AP15-5-Dateien dürfen weder umformatiert noch verändert werden
- Kein Produktverhalten, Testfall, Import, Hook, Runner, Workflow, Dokument, Paket, Lockfile oder Migration ändern
- Die drei fremden unversionierten IT-/Anfragedateien weder lesen noch verändern
- Kein Add/Commit/Push/Merge/Tag/Release, kein RC1/V1

## Auftrag

1. Formuliere in `module-hooks-app.mjs` quellentreu, dass der Hook im Linux-CI-Runner für `ap14b-masterdata-inventory`, `ap14b-images` und `ap15-dashboard-metrics` eingesetzt wird; er darf keine exklusive Nutzung mehr behaupten. Lokale/sonstige Nutzung nicht erfinden.
2. Formuliere in `ap14b-admin-users.int.mjs` quellentreu, dass diese Suite im AP15-5-Linux-Runner die vierte von fünf ist und vor `ap15-dashboard-metrics` läuft. Keine Zeilennummern aufnehmen.
3. Prüfe byte-/hashbasiert, dass gegenüber dem Laufbeginn ausschließlich diese zwei Kommentarstellen neu geändert wurden; der bestehende AP15-5-Diff in den anderen fünf Dateien muss unverändert bleiben.

## Definition of Done

- Genau zwei zusätzliche Dateien geändert, nur Kommentare.
- `node --check` für beide Dateien Exit 0.
- Bestehende fünf AP15-5-Dateihashes gegen Laufbeginn unverändert.
- `git diff --check` Exit 0.

## Evidence je Agent und Stopppunkt

Jeder Agent nennt Scope, Dateien, Befehle und echte Exitcodes. Genau ein Schreiber. Stoppe nach Kommentaränderung und Nachweis; nicht committen/pushen und keinen Folgeauftrag beginnen.
