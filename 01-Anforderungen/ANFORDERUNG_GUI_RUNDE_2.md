# Anforderungen GUI-Runde 2 (Dennis, 2026-08-17)

> Aufgenommen von Claude (Orchestrator/Review) aus Dennis' Sammelmeldung vom 2026-08-17
> nach der ersten lokalen Sichtung. Reihenfolge unten = geplante Abarbeitung.
> Diese Notiz ist die fachliche Grundlage für AUFTRAG_11 ff.

## A. Erscheinungsbild (höchste Priorität, wirkt überall)

1. **Farbkonzept auf Rottöne + Schwarz** umstellen. Umsetzung ausschließlich über die
   AP8-Tokens in `globals.css` (eine Quelle) — Rot als Akzent-/Primärfarbe, Schwarz/Anthrazit
   als Basis, Dark Mode muss weiter funktionieren. Signalfarben für Fehler/Warnung/Erfolg
   bleiben unterscheidbar (Fehler-Rot darf nicht mit dem Marken-Rot verschmelzen).
2. **Navigation umbauen:** wichtigste Funktionen **oben in einer horizontalen Leiste mit
   Icons**; die rechte Seitenleiste entfällt als Dauerelement und wird zum
   **Burger-Menü zum Ausklappen** (Rest der Navigation, Stammdaten, Abmelden).
3. **Logo ersetzen** — Dennis' Datei (Stand 2026-08-17 noch nicht im Vault angekommen;
   Nachlieferung abwarten, dann `app/public/branding/logo.svg` bzw. passendes Format
   ersetzen).

## B. Stammdaten

4. **Reihenfolge/Gliederung:** erst **Streckennummern**, dann **Bereiche/Bauabschnitte**,
   dann **Kontakte**, danach die übrigen.
5. **Ausklappbare Darstellung** (Akkordeon) statt langer flacher Listen.
6. **CSV-Import je Stammdatenart** inkl. **Vorlagendateien** (Semikolon + UTF-8-BOM wie beim
   Export, Formel-Injektionsschutz, Kopfzeile mit Feldnamen). Import mit Vorschau und
   Fehlerbericht je Zeile; keine stillen Teilimporte (eine Transaktion, fail-closed).
   Vorlagen liegen unter `99-Anlagen/CSV-Vorlagen/`.
7. **Wizard für Kontakte** (Anlage in geführten Schritten) — „schön, wenn nicht zu viel
   Arbeit": nur umsetzen, wenn ohne Umbau der bestehenden Kontaktlogik möglich.
8. **Qualifikationen** als neues Stammdatum am Monteur (mehrere je Person möglich, mit
   Rangfolge/Höchste). Die **höchste Qualifikation bestimmt die Hintergrundfarbe** des
   Monteurs in der Dispo-Ansicht.

## C. Erfassung

9. **Bereitschaftsnummer** bleibt Stammdatum, wird aber **nicht mehr in der Erfassung
   ausgewählt** (Feld dort entfernen; Zuordnung ergibt sich über den Bauabschnitt bzw.
   später/anderswo).
10. **Formular-Durchgang:** Dennis geht anschließend alle Formulare gemeinsam durch —
    Änderungen werden dann als eigene Scheiben aufgenommen.

## D. Disposition der Monteure (großer Block, ersetzt/erweitert den Bereitschaftsplan)

11. **Wochen- und Monatsübersicht** mit Umschalter.
12. **Rechte Liste** der verfügbaren Monteure (aus den Stammdaten), farbig nach höchster
    Qualifikation.
13. **Zuweisung so einfach wie möglich:** Monteur aus der Liste auf Tag(e) ziehen
    (**Drag & Drop**, wenn nicht zu aufwendig — sonst Klick-Variante als Rückfallebene),
    auf mehrere Tage verteilen, wieder entfernen, zwischen Tagen verschieben.
14. **Eigene Zeile „Dispo / Bereitschaftstelefon"** — wer die Koordination besetzt.
15. Bestehende Migration `0021` (`on_call_plan`) bleibt die Datengrundlage und wird
    erweitert (Rollenart der Zuweisung: Bereitschaft vs. Dispo/Telefon).

## Offene Punkte / Entscheidungen

- **Logo-Datei** fehlt noch (siehe A3).
- **Qualifikationskatalog:** welche Werte, welche Rangfolge, welche Farben? Vorschlag:
  pflegbarer Katalog `qualifications` mit `label`, `rank` (Zahl) und `color` (Auswahl aus
  einer festen Palette) — Dennis bestätigt Werte beim Formular-Durchgang.
- **Drag & Drop:** Umsetzung ohne neue Abhängigkeit über die HTML5-Drag-API (Desktop) plus
  Klick-/Auswahl-Rückfallebene für Touch (mobil ist HTML5-DnD unzuverlässig). Bewertung
  „Aufwand" damit vertretbar; Alternative (dnd-kit) wäre eine neue Abhängigkeit und ist
  vorerst nicht vorgesehen.
