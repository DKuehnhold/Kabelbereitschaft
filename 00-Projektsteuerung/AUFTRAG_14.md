# AUFTRAG 14: Dispo-Board — Wochen-/Monatsansicht, Qualifikationen, Drag & Drop, Dispo-Zeile

> Stand: 2026-08-17. Grundlage: `01-Anforderungen/ANFORDERUNG_GUI_RUNDE_2.md` Abschnitt D
> (Punkte 11–15) und das Excel-Blatt „Einsatzplanung". Baut auf Migration 0021
> (`on_call_plan`, AUFTRAG_10) auf. Größter Block der GUI-Runde 2.

## Ziel

Aus der bestehenden Wochenmatrix ein bedienbares Dispo-Board machen:

1. **Wochen- und Monatsansicht** mit Umschalter (Woche = Mo–So mit Datum; Monat = Kalendermatrix
   des Monats). Navigation vor/zurück je Einheit, „Heute"-Sprung. Alles Europe/Berlin über die
   Helfer in `date-local.ts`.
2. **Rechte Monteurliste** (aus `technicians`, nur aktive): jeder Monteur als Karte/Chip mit
   **Hintergrundfarbe seiner höchsten Qualifikation**.
3. **Qualifikationen** als neues Stammdatum:
   - Katalog `qualifications` (`label`, `rank` integer, `color` aus fester Palette,
     `is_active`) — pflegbar wie die Kataloge aus 0019.
   - Zuordnung `technician_qualifications` (n:m, `technician_id`, `qualification_id`,
     unique-Paar).
   - Die **höchste** Qualifikation (größter `rank`) bestimmt die Farbe; ohne Qualifikation
     eine neutrale Standardfarbe.
   - Startwerte NICHT erfinden: leerer Katalog, Dennis pflegt sie beim Formular-Durchgang.
     Farbpalette: 6–8 token-basierte Werte, in einer Konstante zentral definiert (nicht in der
     DB als Hex frei eingebbar — `color` speichert den Palettenschlüssel).
4. **Zuweisen so einfach wie möglich:**
   - **Drag & Drop** über die HTML5-Drag-API (keine neue Abhängigkeit): Monteur aus der Liste
     auf eine Zelle ziehen; bestehende Zuweisung zwischen Zellen verschieben; Ziehen auf einen
     „Entfernen"-Bereich (oder zurück in die Liste) löscht.
   - **Klick-Rückfallebene ist Pflicht** (Touch/Barrierefreiheit): Monteur antippen = auswählen,
     Zelle antippen = zuweisen; bestehende Zuweisung hat ein „×". Ohne diese Ebene ist die
     Funktion auf dem Handy unbenutzbar.
   - Mehrere Tage in Folge: Zuweisung auf eine Zelle ziehen und optional per Umschalt-/
     Mehrfachauswahl auf mehrere Tage anwenden — **nur wenn ohne Umbau möglich**, sonst
     entfallen lassen und in der Meldung begründen.
5. **Eigene Zeile „Dispo / Bereitschaftstelefon"** oberhalb der Bauabschnittszeilen: wer die
   Koordination besetzt. Umsetzung über eine **Zuweisungsart** an `on_call_plan`:
   Migration 0022 ergänzt `assignment_kind text not null default 'bereitschaft'` mit
   Check-Constraint auf `('bereitschaft','dispo')`; für `dispo` ist
   `construction_stage_id` **nullable** (die Dispo-Zeile gehört zu keinem Bauabschnitt) —
   bestehende `not null`-Bedingung entsprechend anpassen und den Unique-Index so umbauen, dass
   er für beide Arten trägt (z. B. partieller Unique-Index je Art). Idempotent und additiv,
   Muster 0018/0019/0021.

## Umfang

- **Migration `0022_hlk_dispo_board.sql`**: `qualifications`, `technician_qualifications`,
  `on_call_plan.assignment_kind` + Nullable-Anpassung + Unique-Umbau; RLS/Grants/Prüfblöcke
  streng nach Muster 0019/0021 (Kataloge: select alle, write Staff, kein delete außer bei
  `technician_qualifications` und `on_call_plan`).
- **SQL-Smoke `29_hlk_dispo_board.sql`** (Fallkennung AA): Idempotenz, Rollenmatrix,
  Unique-Verhalten je Zuweisungsart, Check-Constraint, FKs, Rang-/Farblogik-Datenlage.
- **Läufer + CI**: 0022/29 einketten (beide Runner), CI-Schrittname „0001-0022, Smokes 15-29".
  **Wichtig:** der Wächtertest, der den CI-Schrittnamen wörtlich prüft, ist tolerant zu machen
  (Regex auf „0001-00\d\d, Smokes 15-\d\d") statt bei jeder Migration nachgezogen zu werden.
- **Lib/Actions**: `qualifications` in `masterdata.ts`/`-actions.ts` (Muster 0019-Kataloge),
  Technikerzuordnung, `on-call-plan.ts` um `assignment_kind`, Monats-Abfrage und
  Verschiebe-Operation erweitern (Verschieben = eine Transaktion: delete + insert oder update).
- **Pflegeseite** `stammdaten/qualifikationen` (Muster der 0019-Seiten) + Qualifikations-Zuordnung
  auf der Monteure-Seite (Mehrfachauswahl).
- **Board** `app/src/app/(app)/bereitschaftsplan/`: Umschalter Woche/Monat, rechte Monteurliste,
  DnD + Klick-Ebene, Dispo-Zeile, Entfernen. Staff bedient, Monteure sehen read-only.
  Mobil: Tageskarten mit Klick-Ebene (kein DnD-Zwang), Touchziele ≥44px.
- **Tests**: Rang-/Farbauswahl (höchste Qualifikation), Monats-/Wochenbereichsberechnung
  inkl. DST, Allowlist-Wächter, tolerant gemachter CI-Namenstest. Neue Gesamtzahl deklarieren
  (Baseline 162).

## Negativliste

- Keine neue npm-Abhängigkeit (kein dnd-kit o. ä.).
- Keine Änderung an Meldungs-/Erfassungs-/Listenpfaden, keine Farbtoken-Änderung
  (Palette additiv als neue Tokens erlaubt, bestehende nicht verändern).
- Keine Startwerte für Qualifikationen erfinden.
- Kein `.claude/**`, kein PROJEKT_WISSEN/PROJEKTSTATUS/CHAT_STATUS. Kein Commit/Push.

## DoD

- tsc Exit 0; ESLint auf geänderten Dateien (ein Versuch; Zeitlimit dokumentieren, falls es
  wieder auftritt); `node --test test/*.test.mjs` kein roter Eintrag; LF-normalisiertes
  `bash -n` auf `run_db_tests.sh` Exit 0; SQL-Nachweis an CI-Job `database` delegiert.
- In der Meldung: Bedienablauf in Worten (DnD **und** Klick-Ebene), Farbpalette,
  Unique-Index-Logik je Zuweisungsart, was von Punkt 4 „mehrere Tage" umgesetzt wurde.

## Stopppunkt

Anhalten und BLOCKER melden, wenn: der Unique-Umbau bestehende Daten gefährden würde; die
Dispo-Zeile ohne Nullable-Änderung nicht abbildbar ist und diese Änderung Bestandsdaten
verletzt; DnD ohne neue Abhängigkeit nicht funktionsfähig wird (dann Klick-Ebene liefern und
DnD als Befund melden); oder derselbe Fehler dreimal auftritt.
