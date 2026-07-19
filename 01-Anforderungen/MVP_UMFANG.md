# MVP-Umfang

> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1

## Im MVP enthalten

| Bereich | Funktion |
| --- | --- |
| Zugang | Login; Rollen `admin`, `disponent`, `monteur`; geschützte Routen |
| UI | Responsive Oberfläche; Firmenlogo auf Login + Header (Desktop und mobil) |
| Disposition | Vorgang anlegen; Monteur zuweisen; Vorgangsübersicht; Vorgangsdetail mit Chronik |
| Monteur | Nur zugewiesene Vorgänge sichtbar; Einsatz annehmen; Statusänderungen; Zustandsbewertung |
| Dokumentation | Textdokumentation (Feststellungen/Maßnahmen); Bild-Upload; serverseitige EXIF-Auswertung |
| Material/Lager | Materialstammdaten; Lagerorte; Lagerbestände; Materialentnahmen; Materialrückgaben |
| Auswertung | CSV-Export Vorgangsübersicht; Filter nach Status, Baustufe, Monteur, Zeitraum |
| Qualität | Technische Tests |

## Nicht im MVP (bewusste Nicht-Ziele)

- Navigation / Routenführung
- Live-GPS-Tracking
- Offlinebetrieb
- Push-Benachrichtigungen
- E-Mail-Automatisierung
- PDF-Berichte
- QR-/Barcode-Erfassung
- ERP-/DB-Schnittstellen
- Komplexe Statistik / BI
- Mandantenfähigkeit
- Externe Auftraggeberansicht

## Hinweis zum Lieferstand Arbeitspaket 1

AP1 liefert: Projektgerüst, Dokumentation, vollständige DB-Migration inkl. Row Level Security, Loginseite und rollenbasierte Grundnavigation. Die fachlichen CRUD-Funktionen (Vorgangserfassung, Bild-Upload, Materialbewegungen, CSV-Export) folgen in späteren Arbeitspaketen und sind in dieser Doku als *geplant* gekennzeichnet.
