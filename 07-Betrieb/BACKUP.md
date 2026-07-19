# Backup und Wiederherstellung

> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1

## Was wird gesichert

| Objekt | Verfahren |
| --- | --- |
| Datenbank (PostgreSQL) | Supabase-Backups (automatisch je nach Plan) + bei Bedarf manueller Dump |
| Storage (Bilder) | Supabase Storage-Backup / periodische Sicherung des privaten Buckets |
| Schema / Migrationen | Versioniert in Git (`app/supabase/migrations`) |
| Stammdaten-Seed | Versioniert in Git (Seed-Skript) |

## Datenbank

- Supabase Cloud erstellt automatische DB-Backups (Umfang/Aufbewahrung abhängig vom gewählten Plan – prüfen und dokumentieren).
- Zusätzlich manueller Dump möglich (`pg_dump` bzw. Supabase-CLI) für Meilensteine/vor Migrationen.

## Storage

- Der private Bucket enthält die hochgeladenen Bilder. Regelmäßige Sicherung einplanen.
- In der DB gespeicherte Bild-Metadaten (`incident_images`) und Dateihash erlauben Konsistenzprüfung zwischen DB und Bucket.

## Migrationsversionierung

- Jede Schemaänderung ist eine nummerierte Migration im Git-Repo.
- Reihenfolge und Idempotenz beachten; keine manuellen Schemaänderungen direkt in der Produktions-DB.

## Wiederherstellung (Grundablauf)

1. Betroffenen Umfang bestimmen (DB, Storage oder beides).
2. DB aus Supabase-Backup zurückspielen bzw. Dump einspielen; anschließend fehlende Migrationen anwenden.
3. Storage-Objekte aus Sicherung wiederherstellen.
4. Konsistenz DB ↔ Bucket über Metadaten/Hash prüfen.
5. Funktionstest (Login, Rollen, Zugriff auf Bilder) durchführen.

Wiederherstellung zuerst in einer Test-/Staging-Umgebung erproben, bevor sie produktiv angewendet wird.
