# Backup und Recovery – Konzept (AP7)
> Stand: 2026-07-19 · Technisches Konzept. Es wird KEINE Backup-Funktion behauptet, die nicht
> tatsächlich eingerichtet/getestet wurde. In dieser Umgebung ohne Zielinfrastruktur nicht getestet.

## Sicherungsumfang
| Objekt | Quelle | Verantwortung | Häufigkeit (Empfehlung) | Aufbewahrung | Verschlüsselung |
|---|---|---|---|---|---|
| PostgreSQL-DB | Supabase (PITR/Backups) | Betreiber/Supabase | täglich + PITR | 30 Tage (offen) | at rest (Supabase) |
| Storage (Bilder) | Supabase Storage | Betreiber | täglich | 30 Tage (offen) | at rest |
| Migrationen | Git-Repo | Team | pro Commit | dauerhaft | Git-Host |
| Anwendungscode | Git-Repo | Team | pro Commit | dauerhaft | Git-Host |
| Umgebungsvariablen | Secret-Store/Hosting | Betreiber | bei Änderung | n/a | Secret-Store |
| Auditdaten (`audit_events`) | DB | mit DB-Backup | mit DB | ≥ gesetzl. Frist (offen) | at rest |

## Wiederherstellung
- **Einzeldatensatz:** über DB-Backup/PITR bzw. Soft-Delete-Wiederherstellung (Bilder: `deleted_at`=NULL).
- **Vollständig:** 1) DB-Restore, 2) Storage-Restore, 3) Umgebungsvariablen, 4) App-Deploy vom Tag,
  5) Migrationsstand prüfen, 6) Smoke-Test Produktion.
- **Reihenfolge Recovery:** Konfiguration → Datenbank → Storage → Anwendung → Verifikation.

## Kennzahlen (Zielwerte – vom Betreiber zu bestätigen)
- **RPO** (max. Datenverlust): Ziel ≤ 24 h (mit PITR geringer). Offen bis Plattformentscheidung.
- **RTO** (max. Ausfalldauer): Ziel ≤ 4 h. Offen bis Plattformentscheidung.

## Recovery-Test
Reproduzierbarer Recovery-Test mit **neutralen Testdaten** ist vorgesehen, in dieser Umgebung
mangels Zielinfrastruktur **nicht durchgeführt** → offen (nicht als bestanden gewertet).
