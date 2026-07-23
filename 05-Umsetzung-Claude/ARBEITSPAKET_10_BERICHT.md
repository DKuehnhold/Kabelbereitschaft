# Arbeitspaket 10 – Vorgangserfassung (Umsetzungsbericht)

Status: umgesetzt und lokal verifiziert. Additiv, ohne Breaking Change gegenüber AP1–AP9.
Migration: `0008_ap10_incident_master_data.sql`. Commit: `feat: integrate master data into incident creation (AP10)`.

## 1. Aufgelöster Architekturwiderspruch (Kabelart)
Die frühere AP10-Formulierung mit einem einzelnen `incidents.cable_type_id` wurde zugunsten der
finalen Architekturplanung V1.0 verworfen. Die Kabelart wird **positionsbezogen** über die neue
Tabelle `incident_cable_positions` (Referenz auf `cable_types`) geführt. Es gibt **kein**
`incidents.cable_type_id`. Bei Neuanlage ist mindestens eine Kabelposition Pflicht; die UI zeigt
zunächst genau eine Position, das Datenmodell erlaubt spätere Mehrfachpositionen.

## 2. Erweiterte Incident-Struktur
`incidents` additiv: `customer_id` (FK `customers`), `vzg_line_id` (FK `vzg_lines`), beide nullable.
NOT-NULL gelöst auf `km_from` und `vzg_line_number` (Legacy erhalten). `vzg_line_number` dient als
serverseitig gesetzter Snapshot der gewählten `vzg_lines.line_number`. Bereits vorhandene Felder
(`operating_point`, `track`, `direction`, `object_type`, `object_designation`, `location_description`,
`external_reference`, `caller_name`, `caller_contact`, `internal_note`) bleiben als optionale
Bestands-/Snapshotfelder erhalten. Keine Spalte entfernt.

## 3. Kabelpositionsmodell
`incident_cable_positions(id, incident_id, cable_type_id, sort_order, audit)`; FKs auf `incidents`
(on delete cascade) und `cable_types`; `sort_order >= 0`; `UNIQUE(incident_id, sort_order)`; Indizes
auf `incident_id` und `cable_type_id`; Touch- und Audit-Trigger über die vorhandenen Mechanismen.

## 4. Migration 0008
Additiv/idempotent: neue Spalten + Indizes, NOT-NULL-Lockerung, Positionstabelle + RLS/Trigger,
transaktionale RPCs, Backfill. Getestet auf leerer DB (nach 0001–0007), auf Bestandsdaten und bei
erneuter Anwendung (idempotent, keine destruktiven Seiteneffekte). Keine Änderung an 0001–0007.

## 5. Datenmigration / Backfill
`vzg_line_id`: eindeutiger Treffer über `(construction_stage_id, line_number)` gegen `vzg_lines`
(dort per `UNIQUE(construction_stage_id, line_number)` eindeutig). Nicht eindeutig/nicht auffindbare
Datensätze bleiben unverändert (`vzg_line_id` NULL). `customer_id`: nur gesetzt, wenn
`app_settings.default_customer_id` hinterlegt ist; sonst NULL. Kabelart: Bestandsvorgänge erhalten
**keine** künstliche Position (kein automatisches „Unbekannt"). Verifikation (Testbestand):
Treffer → `vzg_line_id` gesetzt; „9999" ohne Match → NULL; Standardkunde gesetzt; 0 Positionen.

## 6. Transaktionale Server Actions & Validierung
`create_incident_ap10` / `update_incident_ap10` (PostgreSQL, SECURITY INVOKER → RLS/Trigger bleiben
maßgeblich, keine Service-Role-Umgehung) legen Incident **und** Pflicht-Kabelposition in einer
Transaktion an bzw. aktualisieren sie. Der VzG-Snapshot wird serverseitig aus `vzg_lines` gesetzt
(kein Vertrauen auf Client-Werte); VzG-Zugehörigkeit zum Bauabschnitt wird im RPC erzwungen.
`incident-actions.ts` (`createIncident`/`updateIncident`) prüfen Session/Staff, Pflichtfelder,
laden referenzierte Stammdaten erneut (Existenz, Aktivität bei Neuanlage, VzG↔Bauabschnitt) und
rufen die RPC auf. Deutsche Fehlermeldungen, keine DB-Rohfehler an den Nutzer, `revalidatePath` +
Redirect auf die Detailseite. Pflicht: Kunde, Bauabschnitt, VzG, Priorität, Beschreibung, Kabelart.

## 7. Erfassungs-/Bearbeitungsmaske
`NewIncidentForm` und `EditIncidentForm` neu auf AP8-Tokens (Light/Dark, responsive, kein
slate/blue/bg-white). Abhängige Auswahl: Bauabschnitt filtert VzG (nur aktive des Bauabschnitts),
ungültige VzG-Auswahl wird beim Wechsel zurückgesetzt; Bereitschaftsnummer vorbelegt aus
`construction_stages.default_on_call_number_id`, sonst `app_settings`; Standardkunde aus
`app_settings` (nur falls aktiv). Pflichtfelder markiert, Pending-Zustand, verständliche Fehler,
Eingabeerhalt bei Validierungsfehler. Hinweis auf zweiphasigen Bildablauf. Bearbeitung blendet
bereits referenzierte, aber inaktive Stammdaten mit Kennzeichnung „(inaktiv)" ein.

## 8. Darstellung Detail/Listen
Detailseite zeigt Kunde, Baustufe, VzG (Fallback `vzg_lines.line_number` → `vzg_line_number`),
Bereitschaftsnummer und Kabelart der Position(en). Listen (`EinsatzListe`, Dashboard-`IncidentsTable`)
zeigen Kunde + VzG-Fallback additiv. Keine vollständige AP11-Listen-/AP12-Detailüberarbeitung.

## 9. RLS
Incident-Zugriff unverändert (Staff alle, Monteur nur zugewiesen). `incident_cable_positions`:
SELECT/Schreiben folgen dem Zugriff auf den zugehörigen Vorgang (`is_staff()` oder
`is_assigned_to_incident(incident_id)`), keine pauschale Session-Freigabe. AP9-Stammdaten weiterhin
lesbar. Verifiziert: Admin/Disposition legen an; Monteur nicht; fremder Monteur sieht/schreibt keine
Kabelposition.

## 10. Audit
Feldgenaues `tg_audit` (AP9) unverändert wiederverwendet. Neue Incident-FK-Felder laufen über den
bestehenden Incident-Trigger; `incident_cable_positions` an denselben Trigger angeschlossen
(Insert/Update/Delete). Keine zweite Auditlösung, keine parallele Historientabelle.

## 11. Bilder
Zweiphasig: Vorgang speichern → Redirect auf die Detailseite → Bilder über die bestehende Logik
(`/api/images/upload`, `IncidentImages`). EXIF/GPS/Dedup/Offline-Queue/Storage unverändert. Bilder
sind keine Voraussetzung für das erstmalige Speichern.

## 12. Offline-Regressionssicherheit
`lib/offline/*` unverändert. Bestehende Offline-Notizen, -Statusänderungen und die Bild-Upload-Queue
inkl. Retry/Konflikterkennung bleiben funktionsfähig; nur additive Incident-Reads/Typen.
**Offline-Neuanlage vollständiger Vorgänge ist NICHT Bestandteil von AP10** (kein neuer Outbox-Typ,
keine temporären Incident-IDs). Regression bestätigt durch grüne Bestands-Smokes (13) und Build.

## 13. Testergebnisse (lokal)
- `npx tsc --noEmit`: 0 Fehler.
- `npx eslint`: 0 Fehler.
- `npx next build`: erfolgreich.
- Migration 0008: leer (nach 0001–0007), Bestand und Zweitanwendung – sauber/idempotent.
- AP10-Smoke (`supabase/test/15_ap10_smoke.sql`): 12/12 OK (Anlage+Snapshot+Position, Disposition,
  Monteur-Sperre, VzG-Zugehörigkeit, Kabel-Pflicht, km optional, Update-Snapshot/Kabelart,
  sort_order-Unique, Kabelpositions-RLS Monteur, feldgenaues Audit).
- Backfill: eindeutiger Treffer gesetzt, Nicht-Treffer NULL, Standardkunde gesetzt, 0 Positionen.
- Regression: Smokes 11 (16), 13 (5), 14 (26) – alle grün.
- Nicht ausführbar: Browser-E2E, Push (privates Repo, keine Zugangsdaten).

## 14. Offene Punkte
- Ansprechpartner-Kopplung (`contacts`) noch nicht mit Vorgängen verknüpft (Freitext-Snapshot bleibt).
- Mehrere Kabelpositionen (UI) sowie Menge/Zustand je Position → spätere Arbeitspakete.
- Bestandsvorgänge ohne eindeutigen VzG-Treffer bleiben ohne `vzg_line_id` (bewusst, Snapshot lesbar).
- Push AP10 (und AP4–AP9) durch den Nutzer.
