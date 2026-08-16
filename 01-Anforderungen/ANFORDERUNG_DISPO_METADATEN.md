# Anforderungsaufnahme: Dispo-Metadaten und Meldungsfelder aus der Bereitschafts-Excel

> Stand: 2026-08-16. Verfasst von Claude (Orchestrator/Review) aus
> `99-Anlagen/Bereitschaftsuebersicht_Rechert_Rhein_BA_1-3_v15.xlsx` (von Dennis geliefert,
> „in der Excel ist das schon gut umgesetzt"). Die Excel ist das reale Arbeitsmittel, das die
> App ablöst — sie ist damit fachliche Referenz für Felder und Pflegedaten.

## Was die Excel enthält (7 Blätter)

1. **BA1/BA2/BA3** — Meldungslisten je Bauabschnitt, zweigeteilt:
   - Block „Meldung": Lfd. Nr., Datum, Tag, Uhrzeit, **Anrufender**, **Funktion des
     Anrufenden** (BÜW/LBÜW/örtl. LST), **Telefonnummer**, Streckennummer, **Ortschaft**,
     **Anlage (optional)** — z. B. „BÜ 94", „LSW" (LST-Objekte!), Streckenkilometer,
     **Anzahl Kabel**, Meldung (Freitext).
   - Block „Bearbeitung": **Annahme Datum/Uhrzeit**, **Mitarbeiter**, **Gewerk**, Kabeltyp,
     Sachstand, Notwendige Maßnahmen, **Erledigt (Ja/Nein)**, **In Klärung (✔)**.
2. **Ansprechpartner** — Name, Vorname, Telefonnummer, **BA-Zuständigkeit**, Anzeigename
   (automatisch), **Funktion** (BÜW, LBÜW, örtl. LST).
3. **Streckennummern** — je BA: Nummer + Verlauf (von – nach).
4. **Gewerke & Kabeltypen** — Gewerke-Katalog: **50 Hz, LST, TK, OSE, LWL-LST, LWL-TK,
   Unbekannt** (inkl. Kombinationen laut Blattkommentar); die Kabeltyp-Spalte ist leer
   (nur Überschrift).
5. **Einsatzplanung** („WUS-BST-2132") — **Bereitschaftsplan**: Matrix BA × Kalendertag mit
   Mitarbeiter-Kürzeln, dazu Namensliste. Das ist die „Zuständigkeit über die Zeit".

## Abgleich mit der App (Stand heute)

**Bereits vorhanden (Stammdaten-Bereich existiert mit 9 Pflegeseiten):**

| Excel | App | Lücke |
| --- | --- | --- |
| Ansprechpartner (Name, Telefon, BA) | `contacts` + Telefonnummern + Bauabschnitt-Zuordnung | Feld **Funktion** (BÜW/LBÜW/örtl. LST) fehlt |
| Streckennummern je BA | `vzg_lines` | Verlauf (von–nach) und BA-Bindung prüfen |
| Kabeltypen | `cable_types` (Pflegeseite „Kabelarten") | keine — Excel-Spalte ist selbst leer |
| Bauabschnitte | `construction_stages` | keine |
| Meldung: Ort/km/Objekt | Erfassung (Betriebsstelle, km von/bis, Objektart/-bezeichnung) | „Anlage" heute Freitext |
| Anzahl Kabel + Kabeltyp je Meldung | Kabelpositionen (AP12) — strukturierter als die Excel | keine |
| Sachstand / Maßnahmen / Erledigt | Notizen, Aufgaben, Statusmodell | Mapping „In Klärung" offen |

**Neu (in der App bisher nicht abgebildet):**

1. **Gewerk** als Katalog (7 Werte) + Pflichtangabe/Feld an der Meldung.
2. **Anrufdaten an der Meldung**: Anrufzeitpunkt (Datum+Uhrzeit) getrennt vom Anlagezeitpunkt,
   Anrufender als Auswahl aus Ansprechpartnern (Funktion+Telefon werden mitgeführt),
   **Annahme-Zeitpunkt** und annehmender Mitarbeiter.
3. **Funktion** am Ansprechpartner (Werteliste BÜW, LBÜW, örtl. LST — pflegbar?).
4. **Bereitschaftsplan** (Einsatzplanung): wer hat wann je BA Bereitschaft — eigenes Modul
   (Kalender-/Wochenmatrix), größtes neues Stück.

## Offene Entscheidungen für Dennis (vor Auftragsschnitt)

- **Gewerk-Katalog:** fest im Code (7 Werte) oder pflegbare Stammdatenliste?
- **Anlage/Objektarten:** Freitext wie heute oder pflegbarer Katalog (BÜ, LSW, …)?
- **„In Klärung":** eigener Status im Statusmodell oder Kennzeichen an der Meldung?
- **Bereitschaftsplan:** jetzt in der GUI-Phase mitbauen oder nach Erfassung/Liste/
  Disponentenansicht einreihen?
- **Funktion-Werteliste:** fest (BÜW/LBÜW/örtl. LST) oder pflegbar?

## Vorgeschlagene Auftragsreihenfolge (nach Entscheidung)

1. AUFTRAG_4: Erfassung nach Variante A inkl. Anrufdaten-Block, Kabeltyp optional, Begriff
   „Meldung" (nur diese Seite) — sichtbare Scheibe, gegen shadcn-Fundament.
2. AUFTRAG_5: Stammdaten-Erweiterung (Funktion am Ansprechpartner, Gewerk-Katalog,
   ggf. Objektarten) inkl. Migration.
3. AUFTRAG_6: Meldungsliste (Reihenfolge Dennis: nach Erfassung), inkl. Erledigt/In-Klärung-
   Sicht wie in der Excel (grün = erledigt).
4. Bereitschaftsplan als eigenes Paket nach Dennis' Priorisierung.
