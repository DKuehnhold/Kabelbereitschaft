# Listenkonzept – Operative Vorgangsliste (AP11)

`/vorgaenge` ist die zentrale operative Arbeitsoberfläche für Admin und Disposition (staff-only).
Optik/Funktion orientieren sich an Microsoft Lists, umgesetzt ausschließlich im AP8-Designsystem
(Tokens, Light/Dark), ohne externe UI-Bibliothek.

## Zustandsquelle
Die URL ist verbindlich: Suche, Filter, Mehrfachsortierung, Seite und Seitengröße stehen als
Query-Parameter. Server Component liest sie, lädt die berechtigte Seite (RLS über
`incident_list_view`, `security_invoker`) und übergibt sie an die Client-Liste. Filter/Sortierung/
Pagination sind serverseitig – nicht nur auf der geladenen Seite.

## Filter (kombinierbar)
Status, Priorität, Kunde, Bauabschnitt, VzG, Bereitschaftsnummer, Monteur, Erstellt von,
Datum von/bis (lokal, inklusive), Bilder (Alle/Mit/Ohne), Aktivität (Alle/Aktiv/Abgeschlossen),
Freitextsuche. Aktive Filter als entfernbare Chips; „Alle Filter zurücksetzen". Jede
Filteränderung setzt die Seite auf 1. Konkreter Statusfilter hat Vorrang vor dem Aktivitäts-
Schnellfilter; „storniert" gezielt über den Statusfilter.

## Suche
Serverseitig über `search_text`: Vorgangsnummer, Kundenname, Bauabschnitt-Code/-Name,
VzG-Streckennummer, historische `vzg_line_number`, Betriebsstelle, Beschreibung, externe Referenz.
Term getrimmt, leere Suche ignoriert, Sonderzeichen escaped (kein Injektions-/Wildcardrisiko).

## Sortierung
Mehrfachsortierung (Vorgangsnummer, Priorität, Status, Kunde, Bauabschnitt, Erstellt, Geändert)
über `sort=feld:richtung,…`; Klickfolge auf → ab → entfernt; sichtbare Reihenfolge/Richtung;
stabile Standardsortierung `updated_at desc, incident_no desc`.

## Pagination
Serverseitig, Standard 50 (Optionen 50/100/250); Bereichs- und Gesamtanzeige; ungültige Seite wird
normalisiert; Seitengrößenwechsel setzt auf Seite 1.

## Darstellung
Desktop: große Tabelle, Sticky Header, horizontaler Scrollcontainer, Zeilenklick öffnet das Detail
(Checkbox/Link ohne Navigation). Mobile: Karten mit gleicher Datenbasis/Funktion. Kabelarten als
Badge-Chips (gleiche Art zusammengefasst; „Keine Kabelart" bei historischen Vorgängen); Monteure
kompakt; „Offene Hinweise" als Anzahl + Warn-Badges.

## Offene Hinweise (abgeleitet, kein Aufgabenmodell)
Kein Monteur zugewiesen · Keine Bilder vorhanden · Keine Kabelposition vorhanden · Historische
VzG-Zuordnung. Rein lesend, keine Mutation/Audit.

## Massenaktionen (nur vorbereitet)
Zeilenauswahl + „alle auf dieser Seite"; Aktionsleiste mit „Status ändern"/„Monteur zuweisen"
(deaktiviert) und „Auswahl exportieren". Keine Bulk-Mutation.

## CSV-Export
Vollständige gefilterte Treffermenge mit aktueller Sortierung (ohne Pagination) über `lib/csv.ts`
(UTF-8-BOM, Semikolon, Formel-Injektionsschutz), Obergrenze 5.000 mit Hinweis.
