# AUFTRAG_27 — Integrationssuite Stammdaten: veraltete Feldliste `ContactRow` (IM6), IM7 als Folgefehler

> Erteilt vom Orchestrator/Review-Chat, 2026-08-19, aus **Dennis' drittem Datenbanklauf**.

## Fortschritt zuerst

**Alle SQL-Smokes sind durch — einschließlich 29.** Der Lauf hat die gesamte SQL-Kette
(Bootstrap, Migrationen 0001–0022, Smokes 15–29) hinter sich und ist erst in der **Node-Phase**
gescheitert. Damit ist Smoke 29 erstmals vollständig gelaufen; die Korrekturen aus AUFTRAG_15,
25 und 26 sind belegt. Auch die Suite `ap14b-platform.int.mjs` lief vorher durch.

## Befund: **ein** Defekt, nicht zwei

**IM6** (`test/integration/ap14b-masterdata-inventory.int.mjs:916`) scheitert an

```
AssertionError: ContactRow
  + actual - expected
  +   'function_id',
  +   'function_label',
```

Die erwartete Feldliste in `assertKeys(contact, [...], "ContactRow")` (etwa Zeile 939) nennt
`id, customer_id, customer_name, name, function, email, is_active, phones, stage_ids`. Die
tatsächliche Zeile trägt zusätzlich **`function_id`** und **`function_label`**. Diese beiden
Felder stammen aus **AUFTRAG_6 / Migration `0019_hlk_katalog_stammdaten.sql`** (Katalog
`contact_functions` + `contacts.function_id`, Entscheidung Dennis vom 2026-08-16, Block 2a) und
sind **gewollt**; die Projektion in `listContacts()` wurde erweitert, die Feldliste im Test
nicht. `assertKeys` vergleicht bewusst **exakt** — laut eigenem Kommentar ist „ein zusätzliches
oder fehlendes Feld genau der Formfehler, den dieser Test aufdecken soll". Die Prüfung ist also
richtig gebaut, nur ihre Erwartung ist veraltet.

**IM7 ist ein Folgefehler und kein Transaktionsproblem.** Die Meldung `2 !== 1` steht in
Zeile **1014**, und das ist die **Vorbedingung** `assert.equal(before.phones.length, 1)` — nicht
die Atomaritätszusicherung. Grund: IM6 bricht an der Feldliste ab, **bevor** sein zweiter
`saveContact`-Aufruf läuft, der die Telefonnummern von zwei auf eine reduziert. IM7 findet
deshalb den Kontakt mit **zwei** Nummern vor und scheitert an seiner Eingangsprüfung. **Die
Zusage „kein Teilstand bei einem Fehler im zweiten Schritt" wurde in diesem Lauf gar nicht
geprüft** — sie ist weder belegt noch widerlegt. Das ist ausdrücklich festzuhalten und **nicht**
als „auch erledigt" zu verbuchen, sobald IM7 wieder grün ist: erst der nächste Lauf prüft sie
wirklich.

## Ziel

Die Feldliste entspricht der tatsächlichen, gewollten Projektion. IM7 erreicht wieder seine
eigentliche Prüfung. Und: der nächste Lauf soll nicht an der nächsten veralteten Feldliste
derselben Datei scheitern.

## Positivliste (nur diese Datei)

- `app/test/integration/ap14b-masterdata-inventory.int.mjs`

## Umzusetzen

**1. Vorher belegen, dass die beiden Felder gewollt sind.** Lies `0019_hlk_katalog_stammdaten.sql`,
die Projektion `listContacts()` in `app/src/lib/masterdata.ts` und `REVIEW_6.md`. Bestätige in
`MELDUNG_27.md` mit Fundstelle, dass `function_id` und `function_label` beabsichtigt sind und
dass das **alte Freitextfeld `function` bewusst daneben bestehen bleibt**. Ergibt die Prüfung
etwas anderes — etwa eine versehentliche Doppelprojektion —, dann **stoppen und melden**, statt
die Erwartung anzupassen.

**2. Feldliste ergänzen:** `function_id` und `function_label` in die erwartete Liste für
`ContactRow` aufnehmen. Die Prüfung bleibt **exakt** (`deepEqual` über die sortierten Schlüssel);
sie darf **nicht** auf „enthält" gelockert werden. Ergänze einen kurzen Kommentar mit der
Herkunft (AUFTRAG_6 / Migration 0019), damit beim nächsten Katalogfeld klar ist, was zu pflegen
ist.

**3. Die übrigen 20 `assertKeys`-Aufrufe derselben Datei gegen die heutige Projektion prüfen.**
Für jede geprüfte Zeilenform (`PhoneRow`, `CustomerRow`, `StageRow`, `VzgRow`, `TechnicianRow`,
`TeamRow`, `MaterialRow`, `StorageRow`, `MovementRow`, `StockRow` o. ä.) die erwartete Liste mit
den Feldern vergleichen, die die zugehörige Lesefunktion in `app/src/lib/masterdata.ts` bzw.
`inventory.ts` heute tatsächlich liefert. Besonders zu beachten sind die Migrationen **0019
bis 0022** (neue Kataloge, `qualifications`, `technician_qualifications`,
`on_call_plan.assignment_kind`) — sie sind nach dem Entstehen dieser Suite dazugekommen.
Jede Abweichung wird korrigiert und in `MELDUNG_27.md` einzeln mit Zeile, altem und neuem Stand
und der Fundstelle der Projektion aufgeführt. Wo die Liste stimmt, genügt die Angabe „geprüft".

**4. Keine Aussage über IM7 hinaus.** Es ist **nicht** Gegenstand dieses Auftrags, die
Atomaritätszusage zu prüfen oder zu behaupten — dafür braucht es einen Datenbanklauf, den es
hier nicht gibt.

## Negativliste (ausdrücklich verboten)

- Jede Produktivdatei, insbesondere `masterdata.ts`, `masterdata-actions.ts`, `inventory.ts` —
  die Projektion ist **richtig**, veraltet ist der Test.
- Jede andere Testdatei, jede Migration, jeder Smoke.
- `assertKeys` selbst abschwächen (auf „enthält" umstellen, Felder ausblenden, den Aufruf
  entfernen) oder einen Testfall überspringen/auskommentieren.
- Die Vorbedingung in IM7 (`before.phones.length === 1`) ändern, um sie „passend" zu machen —
  sie ist korrekt und wird von selbst wieder erfüllt, sobald IM6 durchläuft.
- `git commit`, `push`, `merge`, `tag`, `release`.
- Behaupten, ein Datenbank- oder Integrationslauf sei erfolgt. Es gibt hier **kein** PostgreSQL;
  diese Suite ist in der Sandbox **nicht** ausführbar.

## DoD (prüfbar)

1. Geändert ist **genau** `app/test/integration/ap14b-masterdata-inventory.int.mjs`
   (Dateizeitstempel).
2. Die Datei enthält weiterhin **21** `assertKeys(`-Aufrufe und weiterhin die exakte
   `deepEqual`-Form in der Hilfsfunktion — Zahlen bzw. Zeile melden.
3. Aus `app/`: `node --test test/*.test.mjs` → **227/227, fail 0, Exit 0** (die Integrationssuite
   gehört nicht zu dieser Menge; der Lauf belegt nur, dass nichts anderes angefasst wurde).
4. `node --check` bzw. ein Syntaxnachweis auf der geänderten Datei → fehlerfrei. Kommando und
   Ergebnis melden.
5. `MELDUNG_27.md` nennt: den Beleg aus Punkt 1 der Umsetzung, die geänderte Feldliste, die
   Liste **aller 21** geprüften `assertKeys`-Stellen mit Urteil (stimmt / korrigiert /
   unsicher), die Messwerte und den ausdrücklichen Hinweis, dass die Suite hier nicht
   ausführbar ist und die Atomaritätszusage aus IM7 **weiterhin ungeprüft** bleibt.

## Stopppunkt

Anhalten und melden, wenn

- Punkt 1 ergibt, dass die beiden Felder **nicht** beabsichtigt sind;
- mehr als **fünf** Feldlisten korrigiert werden müssten — dann ist die Suite insgesamt
  gegenüber dem Code zurückgefallen und gehört als Ganzes nachgezogen;
- eine Korrektur eine Produktivdatei berühren würde.

## Meldeweg

`00-Projektsteuerung/MELDUNG_27.md`.
