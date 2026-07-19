# Storage – Bilder (AP4)
> Stand: 2026-07-19

## Bucket
- Privater Supabase-Storage-Bucket **`incident-images`** (angelegt in Migration 0002, `public=false`).
- Härtung (Migration 0005, additiv): `file_size_limit = 15 MB` (15728640 Byte),
  `allowed_mime_types = {image/jpeg, image/png}`. (In der lokalen Test-DB werden diese
  Spalten im Stub nachgebildet; die Anweisung ist über Spaltenexistenz abgesichert.)

## Pfadkonvention
```
incidents/{incident_id}/{image_id}/{bereinigter_dateiname}
```
Stabil und kollisionsfrei (Bild-ID im Pfad). Dateinamen werden bereinigt (nur `A–Z a–z 0–9 . _ -`,
Länge begrenzt); die interne Speicherung hängt nicht allein vom ursprünglichen Namen ab.

## Zugriff – ausschließlich signierte URLs
- Keine Public URLs. Der Server erzeugt bei Bedarf **signierte URLs** (TTL 3600 s) für die
  gelisteten bzw. angezeigten Bilder (`createSignedUrl(s)`).
- Direkter Objektzugriff ohne gültige signierte URL ist nicht möglich (privater Bucket + Storage-RLS).

## Storage-RLS (Migration 0002, wiederverwendet)
- **Lesen/Hochladen**: Disposition/Admin (`is_staff()`) oder der dem Vorgang zugewiesene Monteur
  (`is_assigned_to_incident()`), abgeleitet aus dem Pfad-Segment `incidents/{incident_id}`.
- **Löschen (Storage-Objekt)**: nur Administrator.
- Die Pfadkonvention aus AP4 (`incidents/{incident_id}/…`) ist mit diesen Policies kompatibel;
  es waren keine neuen Storage-Policies nötig.

## Soft-Delete vs. physische Löschung
AP4 löscht nur logisch (Tabellenfeld `deleted_at`). Das Storage-Objekt bleibt zunächst erhalten.
Ein administrativer Bereinigungsprozess (physisches Entfernen inkl. Aufbewahrungsfrist) ist als
Folgeaufgabe (AP5) vorgesehen.

## Tabelle vs. Storage
Metadaten liegen in `public.incident_images` (RLS), die Binärdaten im Bucket. Bestandsanzeigen und
Berechtigungen stützen sich auf die Tabelle; die Datei wird ausschließlich über signierte URLs geliefert.
