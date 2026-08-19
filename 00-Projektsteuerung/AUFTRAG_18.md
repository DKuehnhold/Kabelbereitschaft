# AUFTRAG_18 — Dispo-Board: Zuweisung über mehrere Tage („von–bis"-Dialog)

> Erteilt vom Orchestrator/Review-Chat, 2026-08-18. Grundlage: **Entscheidung Dennis vom
> 2026-08-18** — Mehrfach-Tageszuweisung als **Dialog „von–bis"** (ausgewählt gegen „Auswahl
> bleibt haften" und „Zeitraum ziehen"). Schließt die letzte offene Lücke von D13 aus
> `ANFORDERUNG_GUI_RUNDE_2.md`.
> Die übrigen Bedienmängel des Boards (Drag-Feedback, Sperrzustand, Tastaturbedienung,
> Verschieben in der Monatsansicht, Leerzustände, Fehlerbox auf Tokens) sind **ausdrücklich
> nicht** Teil dieses Auftrags — Dennis hat sie auf die Scheibe danach gelegt.

## Ausgangslage (gemessen)

- Zuweisen geht heute **nur Tag für Tag**. Alle drei Schreibeinstiege (Drop, Klick Woche,
  Klickpfad Monat) laufen seit AUFTRAG_17 durch **einen** gemeinsamen Punkt
  `handleDropOrClickAssign()` in `OnCallPlanClient.tsx:290` — dort sitzt auch die
  Doppelbelegungs-Rückfrage. Das ist der Anknüpfungspunkt.
- Serverseitig gibt es je Zuweisung genau einen Aufruf: `assignOnCall()` bzw. `assignDispo()`
  in `on-call-plan-actions.ts`. Einen Bereichspfad gibt es nicht.
- Die Datenbank hat aus `0022_hlk_dispo_board.sql:243–254` **zwei partielle Unique-Indizes**
  (Bereitschaft je Bauabschnitt/Tag/Person, Dispo je Tag/Person). Eine exakt gleiche Zuweisung
  ist damit auf DB-Ebene ausgeschlossen — das ist die Grundlage für „vorhandene Tage
  überspringen" statt „Fehler".
- `app/src/components/ui/shadcn/dialog.tsx` liegt als Copy-in bereit und ist bisher nirgends
  benutzt.

## Ziel

Ein Monteur lässt sich in **einem** Vorgang auf einen zusammenhängenden Zeitraum einplanen.
Der Zeitraum wird in einem Dialog bestätigt, die Anlage läuft in **einer** Transaktion, und
das Ergebnis wird ehrlich berichtet (wie viele Tage angelegt, wie viele übersprungen).

## Verbindliches Verhalten

**1. Der Dialog erscheint vor dem Schreiben, nicht danach.** Löst der Nutzer eine
**Neuzuweisung** aus (Drop oder Klick, Woche oder Monat), öffnet sich der Dialog, **bevor**
etwas gespeichert wird. Es darf keinen Zwischenzustand geben, in dem ein Tag schon steht und
der Dialog noch offen ist.

**2. Inhalt des Dialogs.**
- Kopfzeile nennt **Monteur** und **Ziel** (Bauabschnitt bzw. „Dispo / Bereitschaftstelefon").
- **Von**: der angeklickte Tag, **festgesetzt und nicht änderbar** (er ist die Zielzelle).
  Sichtbar als Datum im Format TT.MM.JJJJ.
- **Bis**: Datumsfeld (`<input type="date">`), **vorbelegt mit dem Von-Datum**.
- Zwei Schaltflächen: **„Nur diesen Tag"** (schreibt genau einen Tag, entspricht dem heutigen
  Verhalten) und **„Zeitraum eintragen"** (schreibt Von bis Bis einschließlich beider Enden).
  Abbrechen bzw. Schließen schreibt **nichts**.
- „Nur diesen Tag" ist die **vorbelegte** Schaltfläche (Enter-Taste), damit die
  Einzeltagszuweisung genau einen zusätzlichen Tastendruck kostet.

**3. Ein Bis vor dem Von** ist unzulässig: sichtbare, sachliche Meldung im Dialog, kein
Schreibvorgang, Dialog bleibt offen.

**4. Obergrenze 92 Tage** (ein Quartal) als harter Fehler mit sichtbarer Meldung — Schutz
gegen einen Tippfehler im Jahr. Der Wert ist eine benannte Konstante mit Kommentar.

**5. Doppelbelegungsprüfung aus AUFTRAG_17 bleibt wirksam, jetzt über den Zeitraum.** Vor dem
Schreiben wird für **jeden** Tag des Zeitraums gegen die geladenen Einträge geprüft, ob der
Monteur an diesem Tag schon woanders steht (anderer Bauabschnitt oder Dispo). Treffer werden
**gesammelt** und in **einer** Rückfrage genannt (Anzahl und die betroffenen Tage, bei mehr
als fünf Tagen gekürzt mit „… und N weitere"). Bestätigt der Disponent → schreiben. Bricht er
ab → **kein** Schreibvorgang. Die bekannte Grenze bleibt und ist erneut zu kommentieren: es
wird nur gegen den **geladenen** Zeitraum geprüft; ein Zeitraum, der über die angezeigte Woche
bzw. den Monat hinausreicht, kann außerhalb liegende Dubletten nicht sehen. Diese Grenze ist
in `MELDUNG_18.md` ausdrücklich zu benennen.

**6. Verschieben bleibt einzeltägig.** Ein bestehender Zuweisungs-Chip, der auf eine andere
Zelle gezogen wird, geht **ohne** Dialog direkt durch wie heute. Ein Zeitraum beim Verschieben
ist fachlich nicht gefordert und ausdrücklich nicht umzusetzen.

**7. Neue Server-Action `assignOnCallRange`** in `app/src/lib/on-call-plan-actions.ts`, nach
dem Muster der bestehenden Actions:
- Signatur nimmt Ziel (Dispo oder Bauabschnitt), `fromIso`, `toIso` und `technicianId`.
- **Dieselbe** Rollen-Allowlist und dieselbe Eingabeprüfung wie `assignOnCall`/`assignDispo`
  (`getSessionProfile()`, `STAFF_ALLOWED_ROLES`, `isUuid`, `isIsoCalendarDate`) — **kein**
  eigener, abweichender Prüfpfad.
- Serverseitige Wiederholung der Grenzen aus 3 und 4: `toIso < fromIso` und Zeitraum > 92 Tage
  werden **auch hier** abgewiesen. Die Oberfläche ist keine Sicherung.
- **Eine** `withUserTransaction`, darin je Tag ein `insert … on conflict do nothing`, so dass
  ein bereits vorhandener Tag **übersprungen** wird statt die Transaktion zu sprengen. Die
  `on conflict`-Klausel muss auf die **partiellen** Indizes aus `0022` passen; welche
  Zielformulierung gewählt wurde, ist in `MELDUNG_18.md` zu belegen.
- Rückgabe erweitert das bestehende Ergebnisobjekt um die Zahl der **angelegten** und der
  **übersprungenen** Tage. Die bestehenden Actions und ihr Ergebnistyp dürfen dabei **nicht**
  in ihrem Verhalten geändert werden; eine Typerweiterung mit optionalen Feldern ist zulässig.
- `revalidatePlan()` wie in den Bestandsactions.

**8. Ergebnismeldung an den Nutzer.** Nach Erfolg eine sachliche, sichtbare Rückmeldung, z. B.
„5 Tage eingeplant, 2 Tage waren bereits vergeben." Wurden **null** Tage angelegt, muss das
erkennbar sein und nicht wie ein Erfolg aussehen. Die Meldung nutzt die bestehende
Meldungsfläche der Komponente; **keine** neue Farbklasse, **keine** harten Tailwind-Farben.

## Positivliste (nur diese Pfade)

- `app/src/components/on-call-plan/OnCallPlanClient.tsx`
- `app/src/lib/on-call-plan-actions.ts`
- `app/test/auftrag18-dispo-zeitraum.test.mjs` (**neu**)

## Umzusetzen — Tests

Wächtertest im Stil von `app/test/auftrag17-dispo-regeln.test.mjs`, statisch über die
Dateitexte, mindestens:
- `assignOnCallRange` existiert, verwendet `STAFF_ALLOWED_ROLES`, `withUserTransaction` und
  `on conflict`, und enthält **beide** serverseitigen Grenzprüfungen (Bis vor Von, Obergrenze);
- die Obergrenzen-Konstante trägt den Wert **92** und wird in Oberfläche **und** Action
  benutzt (kein zweiter, abweichender Zahlenwert);
- der Dialog wird ausschließlich im **Neuzuweisungspfad** geöffnet, nicht im Verschiebepfad;
- „Nur diesen Tag" und „Zeitraum eintragen" existieren als getrennte Pfade, und der
  Abbruchzweig ruft **keine** Server-Action;
- die Doppelbelegungsprüfung läuft über **alle** Tage des Zeitraums (nicht nur über den
  Starttag);
- keine harte Tailwind-Farbklasse (`bg-red-`, `text-red-`, `bg-green-`, `bg-yellow-`) in den
  neu hinzugefügten Stellen.

## Negativliste (ausdrücklich verboten)

- Migration oder SQL-Datei anlegen/ändern. Die vorhandenen partiellen Unique-Indizes aus
  `0022` genügen; es wird **kein** Constraint ergänzt oder gelockert.
- Verhalten oder Signatur von `assignOnCall`, `assignDispo`, `moveOnCallEntry` und
  `removeOnCall` ändern.
- Die Bedienmängel aus REVIEW_17 anfassen: Drag-Feedback, Busy-/Sperrzustand, Tastaturbedienung
  der Zellen, Verschieben in der Monatsansicht, Leerzustände, Umstellung der Fehlerbox auf
  Tokens. **Alles eigene Scheibe.**
- Die Soll-Besetzungsanzeige, die Doppelbelegungs-Rückfrage oder die Markierung aus AUFTRAG_17
  inhaltlich umbauen — die Doppelbelegungsprüfung wird **erweitert**, nicht ersetzt.
- `on-call-plan.ts`, `globals.css`, `roles.ts`, `qualifications.ts`, `masterdata.ts`,
  `app/supabase/**`, `.github/workflows/**`, `.claude/**`, `run-*.ps1`.
- Neue npm-Abhängigkeit; `package.json`/`package-lock.json`.
- Wochentagsfilter („nur Mo–Fr"), Serien- oder Wiederholungsmuster — nicht beauftragt.
- `git commit`, `push`, `merge`, `tag`, `release`.
- Erfundene Nachweise. `npm run build` und ESLint sind hier nicht ausführbar, PostgreSQL fehlt
  — **keine** Behauptung eines DB-Laufs.

## Zeilenenden

Neue Testdatei mit **LF**; die beiden Bestandsdateien behalten ihre Zeilenenden. Siehe
`BEFUND_CRLF_ARBEITSBAUM.md`.

## DoD (prüfbar)

1. Geändert/neu sind **genau** die drei Dateien der Positivliste — Nachweis über
   Dateizeitstempel, **nicht** über `git status` (der Arbeitsbaum trägt 200+ fremde
   Änderungen).
2. Aus `app/`: `npx tsc --noEmit` → **Exit 0**.
3. Aus `app/`: `node --test test/*.test.mjs` → die bisherigen **192** weiterhin grün plus die
   neuen Fälle, `fail 0`, **Exit 0**. Zahlen wörtlich melden.
4. `grep -c $'\r'` auf der neuen Testdatei → **0**.
5. `MELDUNG_18.md` nennt: die drei Dateien, das Verhalten je Punkt 1–8, den **Wortlaut** der
   Zeitraum-Rückfrage und der Ergebnismeldung, die gewählte `on conflict`-Formulierung mit
   Begründung, die erneut benannte Grenze der Doppelbelegungsprüfung, die Messwerte mit
   Exit-Codes und die offenen Risiken.

## Stopppunkt

Anhalten und melden, wenn

- die partiellen Unique-Indizes aus `0022` keine brauchbare `on conflict`-Zielformulierung
  hergeben (z. B. weil ein Index einen Ausdruck statt einer Spaltenliste trägt) — dann den
  Indexkopf wörtlich melden, **nicht** eine Migration anlegen;
- `dialog.tsx` ohne Änderung nicht nutzbar ist — dann den Grund melden, **nicht** die
  Copy-in-Komponente umbauen (sie steht nicht auf der Positivliste);
- der Zeitraum über die geladene Woche bzw. den Monat hinausreicht und dadurch die
  Doppelbelegungsprüfung erkennbar lückenhaft wird — dann als Befund melden (erwartet, siehe
  Punkt 5), aber nicht durch einen zusätzlichen Datenzugriff „lösen";
- `tsc` nicht Exit 0 ergibt oder ein Bestandstest rot wird;
- derselbe Fehler dreimal in derselben Teilaufgabe auftritt.

## Meldeweg

`00-Projektsteuerung/MELDUNG_18.md`. Danach messt der Orchestrator/Review-Chat selbst nach und
schreibt `REVIEW_18.md`.
