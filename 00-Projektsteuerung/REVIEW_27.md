# REVIEW_27 — Feldliste `ContactRow` in der Stammdaten-Integrationssuite

> Verfasst vom Orchestrator/Review-Chat, 2026-08-19. Grundlage: `AUFTRAG_27.md`,
> `MELDUNG_27.md`, **Dennis' dritter Datenbanklauf** und eigene Messungen.

## Ergebnis: **grün** — mit einer Zusage, die ausdrücklich **noch nicht** geprüft ist

## Der wichtigste Satz zuerst

**Die gesamte SQL-Kette ist durch.** Der Lauf hat Bootstrap, Migrationen 0001–0022 und die
Smokes 15–**29** hinter sich und ist erst in der Node-Phase gescheitert. Damit sind die
Korrekturen aus AUFTRAG_15 (Z7), AUFTRAG_25 (Z12) und AUFTRAG_26 (Fixture-Sollzahl) **gegen eine
echte PostgreSQL-18-Instanz belegt**, und Smoke 29 ist erstmals vollständig gelaufen. Auch
`ap14b-platform.int.mjs` lief durch.

## Zwei rote Tests, **eine** Ursache

**IM6** scheiterte an der exakt verglichenen Feldliste `ContactRow`: die Zeile trägt zusätzlich
`function_id` und `function_label`. Beide stammen aus AUFTRAG_6 / Migration `0019` und sind
**gewollt** — vom Agenten belegt und von mir nachgelesen: `0019`, Abschnitt 4, legt
`contacts.function_id` als Fremdschlüssel auf den neuen Katalog `contact_functions` an, und der
Spaltenkommentar hält ausdrücklich fest, dass das alte Freitextfeld `function` **unverändert
daneben** bestehen bleibt; `masterdata.ts` führt alle drei Felder nebeneinander; `REVIEW_6.md`
hatte 0019 grün, ohne Beanstandung einer Doppelprojektion. **Richtig war die Projektion,
veraltet war der Test.** Die Erwartung ist ergänzt, die Prüfung bleibt exakt
(`deepEqual` über die sortierten Schlüssel, Zeile 366) — bewusst nicht auf „enthält" gelockert,
denn genau diese Strenge hat den Fehler ja aufgedeckt.

**IM7 war ein Folgefehler, kein Transaktionsproblem.** Die Meldung `2 !== 1` steht in Zeile
**1014** — das ist die **Vorbedingung** `assert.equal(before.phones.length, 1)`, nicht die
Atomaritätszusicherung. IM6 bricht an der Feldliste ab, **bevor** sein zweiter
`saveContact`-Aufruf die Telefonnummern von zwei auf eine reduziert; IM7 findet den Kontakt
deshalb mit zwei Nummern vor. Kein Eingriff an IM7 war nötig oder zulässig.

**Das ist ausdrücklich festzuhalten:** die Zusage „`saveContact` hinterlässt bei einem Fehler im
zweiten Schritt keinen Teilstand" wurde in diesem Lauf **gar nicht geprüft**. Sie ist weder
belegt noch widerlegt. Wenn IM7 beim nächsten Lauf grün ist, ist sie zum **ersten Mal** geprüft
— sie darf nicht rückwirkend als „war ja schon in Ordnung" verbucht werden.

## Eigene Messwerte

| Prüfung | Ergebnis | Exit |
| --- | --- | --- |
| Umfang (Dateizeitstempel) | genau `test/integration/ap14b-masterdata-inventory.int.mjs` | 0 |
| `assertKeys`-Aufrufe unverändert | **21** | 0 |
| exakte Vergleichsform erhalten | `assert.deepEqual(Object.keys(row).sort(), …)`, Zeile 366 | 0 |
| `node --check` auf der geänderten Datei | fehlerfrei | **0** |
| `node --test test/*.test.mjs` | `# tests 227 / # pass 227 / # fail 0` | **0** |

Die übrigen 19 Feldlisten wurden gegen die heutigen Projektionen in `masterdata.ts` und
`inventory.ts` geprüft — **keine weitere Abweichung**. Der Herkunftskommentar an der geänderten
Liste nennt AUFTRAG_6/0019 und den Hinweis, dass ein künftiges Katalogfeld hier ebenso
nachzuziehen ist.

## Auflage (offen)

**Dennis lässt den Lauf erneut laufen.** Die Suite ist in dieser Umgebung **nicht ausführbar**
(kein PostgreSQL); die Korrektur ist statisch geprüft. Nach der Stammdaten-Suite stehen noch
`ap14b-images`, `ap14b-admin-users`, `ap15-dashboard-metrics` und `ap15b-incident-list` aus —
alle vier sind seit den Migrationen 0019–0022 **nicht** gelaufen. Dort sind weitere Befunde
derselben Art möglich (Projektionen, die um Spalten gewachsen sind). Der Trost: es ist die
letzte Etappe, und `assertKeys` gibt es nur in der Stammdaten-Suite.

## Einordnung

Das ist jetzt der vierte Befund in Folge, bei dem **der Prüfcode** hinterherhinkte und nicht die
Anwendung: Z7, Z12, die Fixture-Sollzahl, jetzt die Feldliste. Alle vier stammen aus Scheiben,
deren Migrationen längst gegen eine echte Datenbank liefen, deren Prüfcode aber nie. Das
bestätigt die in `PROJEKT_WISSEN.md` festgehaltene Lehre — und es heißt umgekehrt: die
Anwendung selbst hat sich in dieser Prüfrunde bisher **nicht** als fehlerhaft erwiesen.
