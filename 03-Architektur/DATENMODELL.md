# Datenmodell
> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1

Umgesetzt als Migration `app/supabase/migrations/0001_init.sql` (+ `0002_storage.sql`).
Alle Primärschlüssel sind **UUID**. Referenzielle Integrität, Indizes und Constraints sind gesetzt.

## Enums
- `user_role`: admin, disponent, monteur
- `incident_status`: 16 Werte (neu … abgeschlossen, storniert, fehlalarm)
- `condition_rating`: 7 Werte (Zustandsbewertung, getrennt vom Status)
- `image_category`: 9 Bildkategorien
- `storage_location_type`: 5 Lagerorttypen
- `movement_type`: 8 Bewegungstypen
- `location_correction_status`: vorgeschlagen, akzeptiert, abgelehnt

## Tabellen (Auszug der Kernfelder)
| Tabelle | Zweck | Besonderheiten |
|---|---|---|
| `profiles` | Benutzer + Rolle (1:1 zu `auth.users`) | `role`, `is_active`; Rolle/Aktivstatus nur durch Admin (Trigger) |
| `construction_stages` | Baustufen (Stammdaten) | `code` unique |
| `on_call_numbers` | Bereitschaftsnummern | `number` unique |
| `incidents` | Vorgänge | Pflicht: `construction_stage_id`, `vzg_line_number`, `km_from`; Status/Zustand getrennt |
| `incident_assignments` | Monteurzuweisung (n:m) | eindeutiger aktiver Eintrag je (Vorgang, Monteur) |
| `incident_status_history` | Status-Chronik | **unveränderbar**, nur per Trigger geschrieben |
| `incident_notes` | Textdokumentation | anhängbar, kein Update/Delete |
| `incident_images` | Bild-Metadaten + EXIF/GPS | Pflichtfelder + optional GPS/Aufnahmezeit/Kamera; `file_hash`, `exif_present` |
| `incident_location_corrections` | Standort-Korrekturvorschlag | Review durch Disposition |
| `materials` | Materialstammdaten | `material_no` unique |
| `storage_locations` | Lagerorte | Typ + optional GPS |
| `inventory_movements` | Materialbewegungen (Journal) | **unveränderbar**; Ziel=+, Quelle=−; Constraints je Bewegungstyp |
| `audit_events` | generisches Audit | per Trigger befüllt |

## Bestand
`inventory_movements` ist ein unveränderbares Journal. Der aktuelle Bestand ergibt sich als
**View** `material_stock` (Aggregat je Material und Lagerort: Zielbuchung +, Quellbuchung −).
Bestände werden **nie** überschrieben.

## Standortmodell (bahnfachlich)
Kern/Pflicht: Baustufe, VzG-Streckennummer, Streckenkilometer von.
Optional: km bis, Betriebsstelle, Gleis, Richtung, Objektart/-bezeichnung, Ortsbeschreibung,
externe/DB-Navi-Referenz. Keine Navigation, keine Routenberechnung.

## Audit-Felder
Stammtabellen führen `created_at/created_by/updated_at/updated_by`; `updated_*` per Trigger.
Journale/Chroniken führen Erstell-/Aktionsfelder und sind nicht änderbar.

## Verweise
Feld- und Constraint-Details: `app/supabase/migrations/0001_init.sql`.
TypeScript-Typen: `app/src/lib/database.types.ts`.
