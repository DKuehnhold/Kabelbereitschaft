# Sicherheit
> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1

## Authentifizierung
Supabase Auth (E-Mail/Passwort), Session über sichere HTTP-Cookies (`@supabase/ssr`).
Middleware erneuert die Session und schützt nicht-öffentliche Routen.

## Autorisierung (rollenbasiert + RLS)
Rollen: **admin**, **disponent**, **monteur** (`profiles.role`). Durchsetzung primär in der
Datenbank über **Row Level Security**. Hilfsfunktionen (SECURITY DEFINER):
`is_admin()`, `is_staff()`, `is_assigned_to_incident()`.

Kernregeln:
- Vorgänge anlegen: nur Disposition/Admin (`incidents_insert WITH CHECK is_staff()`).
- Monteur sieht/bearbeitet **nur zugewiesene** Vorgänge (`is_assigned_to_incident`).
- Stammdaten (Material, Lager, Baustufen, Bereitschaftsnummern): Schreiben nur Admin, Lesen alle Angemeldeten.
- Status-Chronik & Materialbewegungen sind **unveränderbar** (kein UPDATE/DELETE-Policy;
  Chronik nur per Trigger geschrieben).
- Materialentnahme durch Monteur nur mit Vorgangs- und Lagerortbezug.
- Rolle/Aktivstatus ändert nur der Admin (zusätzlicher Trigger-Schutz).
- Monteur darf bestimmte Status (durch Disposition geprüft/abgeschlossen/storniert) und den
  administrativen Abschluss nicht setzen (Trigger `tg_incident_guard`).

## Bestandsschutz
Trigger `check_inventory_nonnegative()` (SECURITY DEFINER) verhindert negative Lagerbestände –
autoritativ über alle Bewegungen, unabhängig von RLS.

## Storage
Privater Bucket `incident-images` (nicht öffentlich). Zugriff nur über Policies auf
`storage.objects` analog zur Vorgangs-Sichtbarkeit. Pfadkonvention `incidents/<id>/<datei>`.
Zugriffe erfolgen über signierte/serverseitig geprüfte URLs (kein öffentlicher Bucket).

## Upload-Prüfungen (vorgesehen)
Datei-Typ- und Größenprüfung serverseitig; Dateihash; EXIF-Auswertung serverseitig,
fehlende EXIF/GPS führen nicht zum Fehler. GPS ausschließlich aus Bildmetadaten.

## Secrets & Daten
- Keine Secrets im Repository; `.env.example` als Vorlage, echte Werte in `.env.local`.
- Datenminimierung; kein permanentes Standorttracking.

## Validierung
RLS, Trigger und Bestandsschutz wurden gegen PostgreSQL 18 mit einem Smoke-Test geprüft
(`app/supabase/test/`): korrekte Sichtbarkeit, Blockade von Fremdanlage, Statusschutz,
Bestandsguard und unveränderbare Chronik.
