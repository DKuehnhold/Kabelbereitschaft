# Akzeptanzkriterien

> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1

Prüfbare Kriterien für das MVP gesamt. Die auf Arbeitspaket 1 bezogenen Abnahmekriterien werden in `06-Tests/ABNAHME.md` als abhakbare Checkliste geführt.

## Zugang und Rollen

- AK-01: Nicht angemeldete Nutzer werden auf die Loginseite geleitet; geschützte Routen sind ohne gültige Sitzung nicht erreichbar.
- AK-02: Nach Login wird die Rolle aus `profiles.role` gelesen und bestimmt die sichtbare Navigation.
- AK-03: Ein Monteur sieht ausschließlich ihm zugewiesene Vorgänge; fremde Vorgänge sind weder les- noch schreibbar (durch RLS erzwungen).

## Vorgang (geplant, spätere APs)

- AK-04: Ein Disponent kann einen Vorgang mit Pflichtfeldern (Baustufe, VzG-Streckennummer, Streckenkilometer von) anlegen.
- AK-05: Ein Disponent kann einem Vorgang einen Monteur zuweisen; der Status wechselt auf „Monteur zugewiesen".
- AK-06: Jede Statusänderung erzeugt einen unveränderbaren Chronikeintrag.
- AK-07: Der Monteur kann eine Zustandsbewertung aus den 7 zulässigen Werten setzen.

## Bilder und EXIF (geplant, spätere APs)

- AK-08: Bild-Upload speichert alle Pflichtfelder je Bild inkl. Kategorie und Beschreibung.
- AK-09: EXIF wird serverseitig ausgewertet; fehlende GPS-/EXIF-Daten führen nicht zum Fehlschlag des Uploads.
- AK-10: Bilder liegen in einem privaten Bucket; Zugriff nur signiert/rollenbasiert.

## Material und Lager (geplant, spätere APs)

- AK-11: Bestände ergeben sich ausschließlich aus `inventory_movements`; kein direktes Überschreiben.
- AK-12: Negative Bestände werden verhindert.
- AK-13: Monteur-Entnahmen sind an Vorgang und Lagerort gebunden.

## Auswertung (geplant, spätere APs)

- AK-14: CSV-Export der Vorgangsübersicht ist UTF-8-kodiert und enthält die vereinbarten Spalten.
- AK-15: Filter nach Status, Baustufe, Monteur und Zeitraum wirken auf Übersicht und Export.

## Qualität

- AK-16: `npm run lint`, TypeScript-Prüfung und Produktions-Build laufen fehlerfrei.
- AK-17: Es liegen keine Secrets im Repository.
