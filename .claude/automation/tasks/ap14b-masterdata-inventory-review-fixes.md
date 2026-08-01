# AP14B Stammdaten/Inventar – begrenzte Reviewkorrekturen

## Ausgangslage

Arbeite auf dem vorhandenen, nicht committeten Branch
`feat/ap14b-data-masterdata-inventory`. Der Arbeitsbaum ist absichtlich nicht
sauber und enthält den geprüften Fachdiff des Vorlaufs. Verändere oder
verwerfe keinen anderen Bestandteil dieses Diffs. Lies vor Beginn vollständig
`AGENTS.md`, `CLAUDE.md`, `PROJEKT_WISSEN.md`, den ursprünglichen Auftrag, die
rekonstruierte Abschlussübergabe und diese Datei.

Claude bleibt alleiniger ausführender Orchestrator. Schreibende Agenten laufen
streng sequenziell. Kein Commit, Push, Merge, Tag oder Release.

## Positivliste

- `app/src/lib/inventory-actions.ts`
- `app/test/integration/ap14b-masterdata-inventory.int.mjs`
- `app/supabase/test/21_ap14b_masterdata_inventory.sql`, nur falls für einen
  belastbaren Regressionsnachweis erforderlich
- `app/supabase/migrations/0015_ap14b_masterdata_inventory_grants.sql`, nur wenn
  eine zwingende Datenbankabsicherung nicht ohne additive/idempotente Anpassung
  möglich ist
- `PROJEKT_WISSEN.md`, nur zur Korrektur der unten genannten Widersprüche und
  zur Aktualisierung tatsächlich neu erhobener Nachweise
- `.claude/automation/status/fortschritt.json`

Alle anderen versionierten Dateien sind Negativliste. Die beiden
Auftragsdateien bleiben unverändert. Keine Bilder, Uploads, MinIO, GUI, CSP,
Pakete oder Workflows anfassen.

## Blockierende Reviewbefunde

### F1 – Rollenprüfung als Verbotsliste

`createMovement()` erlaubt derzeit jede künftige Rolle außer `monteur`:

```ts
if (!s || s.role === "monteur") ...
```

Korrigiere fail-closed auf eine ausdrückliche Allowlist ausschließlich für
`admin` und `disponent`. Ergänze einen Integrationstest, der eine unbekannte
bzw. nicht freigegebene Rolle ablehnt und keinen SQL-Schreibzugriff ausführt.

### F2 – unbekanntes Material fällt auf `Stk` zurück

`materialUnit()` und `createMovement()` verwenden bei fehlender Materialzeile
`"Stk"`. Das ist nicht fail-closed und verschleiert einen ungültigen Verweis,
auch wenn der Fremdschlüssel den Insert heute noch abfängt.

Korrigiere alle vier Buchungswege so, dass eine fehlende Materialzeile vor dem
Insert eindeutig und neutral abgelehnt wird; keine erfundene Einheit, keine
rohe Datenbankmeldung. Inaktives Material und fehlendes Material müssen
unterscheidbare, fachlich korrekte Ergebnisse liefern. Ergänze Tests für beide
Fälle und belege, dass kein Insert erfolgt.

### F3 – parallele Rückgaben können die Restmenge überschreiten

Der aktuelle Kommentar dokumentiert selbst, dass zwei gleichzeitige
Rückgaben unter READ COMMITTED beide dieselbe Restmenge sehen und zusammen
mehr zurückgeben können als entnommen wurde. Das ist ein Integritätsfehler und
kein akzeptierter Altbestand.

Serialisiere die vorgangsbezogenen Bewegungen `takeoutMaterial`,
`returnMaterial` und `consumeMaterial` innerhalb ihrer bestehenden
`withUserTransaction`-Transaktionen auf einer stabilen, fachlich passenden
Sperrgranularität. Bevorzuge eine vorhandene, RLS-sichtbare Datenbankzeile und
`SELECT ... FOR UPDATE`; kein globaler Lock, kein Superuser, kein
SECURITY-DEFINER-Umweg. Fehlende oder nicht sichtbare Vorgänge müssen
fail-closed abbrechen. Entferne den Kommentar, der die Race Condition als
bewusst unverändert akzeptiert.

Ergänze einen echten PostgreSQL-Integrationstest mit zwei konkurrierenden
Transaktionen: Bei begrenzter Restmenge darf höchstens eine der kollidierenden
Rückgaben erfolgreich sein; die Summe darf die entnommene Menge nie
überschreiten. Belege außerdem, dass Entnahme/Verbrauch/Rückgabe weiterhin
für berechtigte Rollen funktionieren und fremde Monteure scheitern.

## Dokumentationskorrekturen

Korrigiere in `PROJEKT_WISSEN.md` ausschließlich:

1. Die Rechtematrixbeschreibung der Zuordnungstabellen: tatsächlich besitzen
   `construction_stage_contacts` und `team_members` zusätzlich `select`; die
   Formulierung darf nicht pauschal nur `insert/delete` behaupten.
2. Den widersprüchlichen Kopftext, der zuerst `main = origin/main = cb8bb88`
   nennt, später aber behauptet, der bestätigte `main`-Stand bleibe `6b9d8dd`.
   Der aktuelle bestätigte Ausgangsstand ist `cb8bb888280b5509ae2c273789183767e3b7b4db`;
   `6b9d8dd` ist nur der letzte fachliche Vorfahr.
3. Falls die falsche Mengenangabe „genau zehn Dateien“ aus der Abschlusslage
   in eine dauerhafte Dokumentation gelangt ist, auf die tatsächliche Zahl 13
   korrigieren; keine neue Berichtdatei anlegen.

## Nicht blockierende Punkte

Die nicht atomare Dublettenprüfung des Monteurimports und die fehlende
Ausführung des neuen Node-Integrationstests im Linux-CI-Skript sind in diesem
Korrekturauftrag keine Freigabeblocker. Melde sie in der Abschlussübergabe als
Restpunkte; erweitere dafür den Scope nicht.

## Definition of Done

- F1–F3 sind im Code und durch gezielte Tests belegt.
- Null Supabase-Importe und null `supabase.`-Zugriffe bleiben in allen vier
  Zieldateien bestehen.
- TypeScript, ESLint, alle Einheitentests, Produktions-Build und
  `git diff --check` laufen mit Exit 0.
- Vollständiger lokaler PostgreSQL-18-Lauf mit Migrationen 0001–0015, allen
  Smokes 15–21 sowie beiden Node-Integrationssuiten läuft erneut erfolgreich.
- Temporärer Cluster, Datenbank, Rolle, Server, Port und Protokolle sind am
  Laufende nachweislich entfernt; der vorhandene PostgreSQL-Dienst bleibt
  unverändert.
- Sicherheitsreview durch `kb-sicherheit-rls` bestätigt Allowlist,
  Fail-closed-Verhalten, RLS, Sperrwirkung und fehlende Datenleckage.
- Abschlussübergabe nennt exakte geänderte Dateien, Tests/Exit-Codes, Risiken,
  vollständigen Git-Status sowie ausdrücklich kein Commit/Push.

Stoppe bei erforderlicher Scope-Erweiterung, zweitem Schreiber, GUI-/V1-/IT-
Entscheidung, Sicherheitsblocker oder dreimal demselben Fehler.
