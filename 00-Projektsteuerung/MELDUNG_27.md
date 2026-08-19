# MELDUNG_27 — Integrationssuite Stammdaten: veraltete Feldliste `ContactRow` (IM6), IM7 als Folgefehler

> Ausgeführt gemäss AUFTRAG_27. Umgebung ohne PostgreSQL — die Integrationssuite
> `ap14b-masterdata-inventory.int.mjs` wurde **nicht** ausgeführt und ist in dieser Sandbox
> **nicht ausführbar**. Alle Aussagen unten zu IM6/IM7 stammen aus Lesen des Codes und der
> Migration, nicht aus einem eigenen Lauf.

## 1. Beleg: `function_id`/`function_label` sind beabsichtigt

- `app/supabase/migrations/0019_hlk_katalog_stammdaten.sql`, Abschnitt 4 (Zeilen 211–242):
  legt `public.contact_functions` (Katalog) an und ergänzt
  `alter table public.contacts add column if not exists function_id uuid references
  public.contact_functions(id)` (Zeile 236–237). Der Spaltenkommentar (Zeile 239–242) sagt
  wörtlich: *„Ergaenzt das bestehende Freitextfeld 'function' und ersetzt es nicht."* Auch der
  Migrationskopf (Zeile 233–235) hält fest: *„Bestehendes Freitextfeld contacts.'function'
  (0007_ap9_master_data.sql:73) bleibt UNVERAENDERT bestehen - diese Migration ergaenzt eine
  zweite, unabhaengige Spalte und ersetzt die bestehende nicht."*
- `app/src/lib/masterdata.ts`:
  - `ContactRow`-Typ (Zeilen 67–79) führt **beide** Felder nebeneinander: `function` (Zeile 72)
    UND `function_id`/`function_label` (Zeilen 73–74).
  - `LIST_CONTACTS_SQL` (Zeilen 273–306) selektiert `c."function"` UND `c.function_id`, joint
    zusätzlich `public.contact_functions cf` für das Label (Zeile 276, 281).
  - Der Mapper in `listContacts()` (Zeilen 326–334) füllt alle drei Felder: `function`,
    `function_id`, `function_label`.
- `00-Projektsteuerung/REVIEW_6.md`: bestätigt Migration 0019 als grün geprüft
  („FK `contacts.function_id` nullable und nicht kaskadierend, per Prüfblock belegt"), keine
  Beanstandung einer Doppelprojektion.

**Ergebnis der Prüfung:** keine versehentliche Doppelprojektion, kein Widerspruch — die
Projektion in `listContacts()` ist wie vom Auftrag verlangt richtig; die Erwartung im Test war
veraltet. Kein Stopp nötig, Feldliste wie in Punkt 2 unten ergänzt.

## 2. Geänderte Feldliste (`ContactRow`, Zeile ~939 vor der Änderung)

`app/test/integration/ap14b-masterdata-inventory.int.mjs`, Test IM6, `assertKeys(contact, [...],
"ContactRow")`:

- Alt: `id, customer_id, customer_name, name, function, email, is_active, phones, stage_ids`
- Neu: `id, customer_id, customer_name, name, function, function_id, function_label, email,
  is_active, phones, stage_ids`

Ergänzt um einen Kommentar mit Herkunftsangabe (AUFTRAG_6 / Migration 0019,
`public.contact_functions`) direkt bei den beiden neuen Feldern, damit ein künftiges
Katalogfeld an derselben Stelle gepflegt wird. Die Prüfung bleibt exakt (`assert.deepEqual`
über sortierte Schlüssel, Hilfsfunktion `assertKeys` Zeile 365–367 unverändert).

## 3. Alle geprüften `assertKeys`-Stellen (20 Aufrufe + 1 Definition = 21 Fundstellen von
`assertKeys(` in der Datei, Definition Zeile 365)

| # | Zeile | Label | Urteil | Fundstelle Projektion |
|---|-------|-------|--------|------------------------|
| 1 | 695 | CustomerRow | stimmt | masterdata.ts:33-38, `LIST_CUSTOMERS_SQL` 150-153 |
| 2 | 704 | OnCallRow | stimmt | masterdata.ts:128-133, `LIST_ON_CALL_NUMBERS_SQL` 213-216 |
| 3 | 712 | CableTypeRow | stimmt | masterdata.ts:98-104, `LIST_CABLE_TYPES_SQL` 436-439 |
| 4 | 721 | StageOption | stimmt | masterdata.ts:135 (Typ), `listProfileOptions()` 530-540 |
| 5 | 725 | AppSettingsRow | stimmt | masterdata.ts:137-141, `APP_SETTINGS_SQL` 617-620 |
| 6 | 735 | TechnicianRow | stimmt | masterdata.ts:81-88, `listTechnicians()` 354-371 |
| 7 | 750 | StageRow | stimmt | masterdata.ts:40-49, `listStages()` 182-202 |
| 8 | 792 | VzgLineRow | stimmt | masterdata.ts:51-58, `listVzgLines()` 247-265 |
| 9 | 939 | **ContactRow** | **korrigiert** | masterdata.ts:67-79, `listContacts()` 308-342; Beleg Punkt 1 |
| 10 | 968 | PhoneRow | stimmt | masterdata.ts:60-65 |
| 11 | 1079 | TeamRow | stimmt | masterdata.ts:90-96, `listTeams()` 405-429 |
| 12 | 1349 | MaterialRow | stimmt | inventory.ts:44-55, `listMaterials()` 121-137 |
| 13 | 1375 | LocationRow | stimmt | inventory.ts:57-65, `listLocations()` 148-155 |
| 14 | 1386 | StockRow | stimmt | inventory.ts:67-79, `getStock()` 230-258 |
| 15 | 1409 | LowStockRow | stimmt | inventory.ts:96-103, `getLowStockMaterials()` 260-274 |
| 16 | 1423 | MovementRow | stimmt | inventory.ts:81-94, `mapMovements()` 349-367 |
| 17 | 1441 | MovementRow.material | stimmt | inventory.ts:88 (Embed-Typ), `MOVEMENT_SELECT` 285-288 |
| 18 | 1442 | MovementRow.source | stimmt | inventory.ts:89, `MOVEMENT_SELECT` 289-292 |
| 19 | 1443 | MovementRow.target | stimmt | inventory.ts:90, `MOVEMENT_SELECT` 293-296 |
| 20 | 1458 | MovementRow.incident | stimmt | inventory.ts:91, `MOVEMENT_SELECT` 297-300 |

Ergebnis: **1 von 20** Feldlisten war veraltet (ContactRow, IM6) und wurde korrigiert; die
übrigen 19 stimmen mit der heutigen Projektion in `masterdata.ts`/`inventory.ts` überein
(Migrationen 0019–0022 haben dort keine weiteren, in dieser Testdatei geprüften Zeilenformen
verändert — Kataloge `trades`/`contact_functions`/`object_types`/`qualifications` und die
Qualifikations-Verknüpfung werden in dieser Datei nicht über `assertKeys` geprüft). Damit
liegt die Zahl der Korrekturen (1) deutlich unter dem Stoppwert „mehr als fünf".

## 4. IM7 — ausdrücklich offen, nicht als erledigt verbucht

IM7 (`test/integration/ap14b-masterdata-inventory.int.mjs`, ab Zeile 1009) scheitert laut
Dennis' Lauf an Zeile 1023 (`assert.equal(before.phones.length, 1)`, umgesetzte Datei — die
Vorbedingung, nicht die Atomaritätszusage). Das ist ein Folgefehler von IM6: solange IM6 an der
veralteten `ContactRow`-Feldliste abbricht, läuft der zweite `saveContact`-Aufruf aus IM6 (der
die Telefonnummern von zwei auf eine reduziert) nie, und IM7 findet den Kontakt mit zwei statt
einer Nummer vor.

Mit der Korrektur aus Punkt 2 sollte IM6 in einem echten Lauf durchlaufen und IM7 seine
Vorbedingung erreichen. **Das wurde hier nicht geprüft und wird nicht behauptet** — es gibt in
dieser Sandbox kein PostgreSQL, die Suite ist nicht ausführbar. Die eigentliche
Atomaritätszusage von IM7 („kein Teilstand bei einem Fehler im zweiten Schritt", Zeilen
1054–1065) bleibt **ungeprüft**, weder belegt noch widerlegt, bis der nächste echte
Datenbanklauf sie tatsächlich erreicht.

## 5. Messwerte

- `node --check app/test/integration/ap14b-masterdata-inventory.int.mjs` → **Exit 0**, keine
  Ausgabe (Syntaxnachweis der geänderten Datei).
- Aus `app/`: `node --test test/*.test.mjs` → **227/227, fail 0, Exit 0** (Baseline erfüllt;
  Integrationssuite ist darin nicht enthalten und wurde nicht ausgeführt).
- Geänderte Datei laut Zeitstempel: ausschließlich
  `app/test/integration/ap14b-masterdata-inventory.int.mjs` (10:23). `app/tsconfig.tsbuildinfo`
  ist ein Build-Cache-Artefakt des Testlaufs (10:12), keine inhaltliche Änderung, keine
  Produktivdatei.
- `assertKeys(`-Fundstellen in der Datei: **21** (1 Definition Zeile 365 + 20 Aufrufe),
  unverändert gegenüber vorher — die Zahl entspricht dem DoD-Punkt 2.

## 6. Ausdrücklicher Hinweis

- Die Integrationssuite `ap14b-masterdata-inventory.int.mjs` wurde in dieser Sandbox **nicht**
  ausgeführt und ist hier **nicht ausführbar** (kein PostgreSQL). Kein Datenbank- oder
  Integrationslauf wird behauptet.
- Die Atomaritätszusage aus IM7 ist **weiterhin ungeprüft** — dieser Auftrag deckt sie
  ausdrücklich nicht ab (Punkt 4 des Auftrags).
- Keine Produktivdatei wurde angefasst (`masterdata.ts`, `masterdata-actions.ts`, `inventory.ts`
  unverändert). Keine andere Testdatei, Migration oder Smoke wurde berührt. Kein `git commit`,
  `push`, `merge`, `tag`, `release`.

## Stopppunkte

Kein Stopppunkt eingetreten:

- Punkt 1 hat bestätigt, dass `function_id`/`function_label` beabsichtigt sind (kein Stopp).
- Es musste **eine** Feldliste korrigiert werden, nicht mehr als fünf (kein Stopp).
- Keine Korrektur berührt eine Produktivdatei (kein Stopp).
