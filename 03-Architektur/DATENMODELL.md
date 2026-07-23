# Datenmodell
> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1

Umgesetzt als Migration `app/supabase/migrations/0001_init.sql` (+ `0002_storage.sql`).
Alle Primärschlüssel sind **UUID**. Referenzielle Integrität, Indizes und Constraints sind gesetzt.

## Enums
- `user_role`: admin, disponent, monteur
- `incident_status`: 16 Werte (neu … abgeschlossen, storniert, fehlalarm)
- `condition_rating`: 7 Werte (Zustandsbewertung, getrennt vom Status)
- `image_category`: 9 Bildkategorien (AP1) → **15 mit AP4** (siehe AP4-Abschnitt)
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

## AP2-Erweiterung (Migration 0003, additiv)
Datenerhaltend und idempotent ergänzt:

- Enum `incident_priority`: niedrig, normal, hoch, kritisch.
- `incidents.priority` (`incident_priority`, NOT NULL, Default `normal`) + Index.
- `incidents.closing_note` (Abschlussbemerkung) und `incidents.internal_note` (interne Bemerkung).

Wiederverwendet statt neu angelegt (keine Duplikate): `caller_name` = DB-Ansprechpartner,
`caller_contact` = Telefon, `closed_by` = „Abgeschlossen durch", `closed_at` = Abschlussdatum.
Die in AP2 als Pflicht gesetzten Maskenfelder bleiben in der DB nullable; die Pflicht wird
in der Eingabemaske und der Server-Action erzwungen (km bis bleibt optional).

## AP3-Erweiterung (Migration 0004, additiv)
Kein Struktur-Umbau. Ergänzt ausschließlich eine RLS-INSERT-Policy
`movements_insert_monteur_verbrauch`, damit Monteure den Bewegungstyp `verbrauch`
(mit Vorgangs- und Quelllagerbezug, nur für zugewiesene Vorgänge) buchen dürfen.
Alle bestehenden Tabellen, Trigger, Constraints und die View `material_stock` bleiben unverändert.
Material-/Lager-/Bestands- und Bewegungslogik nutzt die in AP1 angelegten Strukturen
(`materials`, `storage_locations`, `inventory_movements`, `material_stock`).

## AP4 – Bilddokumentation (Migration `0005_ap4_images.sql`, additiv)
- **Enum `image_category`**: additiv um 6 Werte erweitert → **15 gesamt**
  (`schaden, detail, reparatur, abschluss, material, sonstiges`; AP1-Werte unverändert).
- **`incident_images`** additiv ergänzt: `width`, `height` (jeweils `>0`-Constraint),
  `deleted_at`, `deleted_by` (Soft-Delete). GPS-Wertebereiche werden weiterhin per Constraint
  aus 0001 geprüft. Neuer Teilindex `idx_images_incident_active` (WHERE `deleted_at IS NULL`).
- **`incident_notes`** additiv ergänzt: `image_id` (Bildbezug für die Chronik).
- **Funktion `image_category_label(text)`**: deutsche Labels (auch für Trigger/Chronik).
- **Trigger `trg_incident_image_event`** (AFTER INSERT/UPDATE auf `incident_images`): schreibt
  Bild-Ereignisse (Upload, Kategorie-/Beschreibungsänderung, Soft-Delete) in die bestehende
  Chronik `incident_notes`. **Keine** parallele Ereignistabelle. Audit läuft unverändert über
  `trg_audit_images` → `audit_events`.
- **RLS**: Die bestehenden `incident_images`-Policies (select/insert/update/delete) werden
  wiederverwendet; Soft-Delete nutzt die UPDATE-Policy (Staff oder Uploader).
- **Storage**: privater Bucket `incident-images` additiv gehärtet (`file_size_limit` 15 MB,
  `allowed_mime_types` JPG/PNG); Storage-RLS aus 0002 unverändert. Details siehe `STORAGE.md`.
- Kein Datenverlust; alle Änderungen idempotent (`ADD VALUE/COLUMN IF NOT EXISTS`, Guards).

## Nachtrag AP9 – Stammdaten (Migration 0007, additiv)
Neue Tabellen: `customers`, `vzg_lines` (VzG 4-stellig, unique je Bauabschnitt),
`contacts` + `contact_phone_numbers` (typisiert, mehrere je Kontakt) + M:N
`construction_stage_contacts`, `technicians` (optional `profile_id`), `teams` + M:N
`team_members` (Mehrfachmitgliedschaft), `cable_types` (Referenz, geseedet), `app_settings`
(Singleton `CHECK id=1`). Neues Enum `phone_type`. `construction_stages` additiv erweitert:
`wus_bst`, `default_on_call_number_id` (FK → `on_call_numbers`). M:N-Tabellen mit eigener
`id` (UUID) + Unique-Paar (audittauglich).
RLS: lesen alle Angemeldeten, schreiben `is_staff()` (admin+disponent); `construction_stages`
von `is_admin()` auf `is_staff()` erweitert. Löschen fachlich nur über `is_active`.
Audit: `tg_audit` feldgenau erweitert (`detail.op` bleibt; UPDATE→`changes{feld:{old,new}}`,
INSERT→`new`, DELETE→`old`); Trigger an allen neuen Tabellen + `construction_stages`.

## Nachtrag AP10 – Stammdaten in Vorgängen (Migration 0008, additiv)
`incidents` erhält `customer_id` (FK `customers`) und `vzg_line_id` (FK `vzg_lines`), beide nullable;
NOT-NULL auf `km_from`/`vzg_line_number` gelöst (Legacy erhalten; `vzg_line_number` = serverseitiger
VzG-Snapshot). Neue Tabelle `incident_cable_positions(id, incident_id, cable_type_id, sort_order, audit)`
für die **positionsbezogene** Kabelart (kein `incidents.cable_type_id`), `UNIQUE(incident_id, sort_order)`,
Indizes auf beide FKs. Transaktionale RPCs `create_incident_ap10`/`update_incident_ap10`
(SECURITY INVOKER: RLS/Trigger bleiben maßgeblich) legen Incident + Pflicht-Kabelposition atomar an/um
und setzen den VzG-Snapshot aus der DB. RLS `incident_cable_positions`: Zugriff folgt dem Vorgang
(`is_staff()` oder `is_assigned_to_incident`). Audit über bestehendes `tg_audit`. Backfill: `vzg_line_id`
bei eindeutigem Treffer, `customer_id`=Standardkunde (falls gesetzt); Bestand ohne Treffer bleibt NULL.
