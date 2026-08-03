# Backup und Recovery – Konzept (AP7)

> **FÜHRENDES DOKUMENT (Backup/Recovery).** Kennzeichnung vom 2026-07-26 gemäß Auflage vor AP12
> (`00-Projektsteuerung/ROADMAP_AP12_AP15_ENTWURF.md`, B.1/B.8). Abgelöste Dublette:
> `07-Betrieb/BACKUP.md` (als historisch markiert, nicht gelöscht).
> Endgültige Konsolidierung und Archivierung erfolgen in AP15.
> Stand: 2026-07-19 · Technisches Konzept. Es wird KEINE Backup-Funktion behauptet, die nicht
> tatsächlich eingerichtet/getestet wurde. In dieser Umgebung ohne Zielinfrastruktur nicht getestet.
>
> Plattformrichtigstellung vom 2026-08-03: Zielplattform ist die interne Eigenplattform
> (PostgreSQL 18 im Volume `postgres-data`, MinIO im Volume `minio-data`); die vorher hier
> genannten Supabase-Verfahren (PITR, Storage-Backup) sind **nicht** die Grundlage.

Die Angaben sind durchgehend gekennzeichnet als **KONZEPT**, **OFFENER BETREIBERENTSCHEID**
oder **FEHLENDER NACHWEIS**.

## Sicherungsumfang
`deploy/compose.yml` definiert die drei Dienste `app`, `postgres` und `minio` (keine
veröffentlichten Ports); zustandstragend sind davon `postgres` und `minio`.

| Objekt | Quelle | Verantwortung | Häufigkeit (Empfehlung) | Aufbewahrung | Verschlüsselung |
|---|---|---|---|---|---|
| PostgreSQL-DB | PostgreSQL 18, Volume `postgres-data`; `deploy/scripts/db-backup.sh` (`pg_dump -Fc` + SHA256-Prüfsumme) | Betreiber | offener Betreiberentscheid | offen (Betreiberentscheid) | offen (nicht belegt) |
| Bilddateien | MinIO, Volume `minio-data` | Betreiber | Sicherungsverfahren **existiert nicht** (fehlender Nachweis) | offen (Betreiberentscheid) | offen (nicht belegt) |
| Migrationen | Git-Repo (`app/supabase/migrations/`, Bestand 0001–0017) | Team | pro Commit | solange das Repository besteht | offen (nicht belegt) |
| Anwendungscode | Git-Repo | Team | pro Commit | solange das Repository besteht | offen (nicht belegt) |
| Umgebungsvariablen | Secret-Store des Betreibers | Betreiber | bei Änderung | offen (Betreiberentscheid) | offen (nicht belegt) |
| Auditdaten (`audit_events`) | PostgreSQL, mit DB-Sicherung | mit DB | mit DB | offen (Betreiberentscheid) | offen (nicht belegt) |

Startbedingung der Umgebungsvariablen: die acht Pflichtnamen `DATABASE_URL`, `AUTH_SECRET`,
`AUTH_URL`, `S3_ENDPOINT`, `S3_PUBLIC_BASE_URL`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`,
`S3_SECRET_ACCESS_KEY` müssen gesetzt sein; die drei Namen `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` sind **verboten**. Eine fehlende
oder eine verbotene Variable bricht den Start mit **Exit-Code 78** ab. Eine wiederhergestellte
Konfiguration ist damit erst dann betriebsfähig, wenn sie diese Bedingung erfüllt.

Es ist **kein PITR und keine WAL-Archivierung belegt**; belegt ist ausschließlich das
Dumpverfahren.

## Gemeinsame Konsistenzgrenze
Datenbank- und Objektstand sind **gemeinsam** zu sichern. `public.incident_images.storage_path`
(`app/supabase/migrations/0001_init.sql:253`, `text not null`) trägt den Objektschlüssel im
Bucket und wird unverändert signiert; die Schlüsselstruktur lautet
`incidents/{incident_id}/{image_id}/{filename}`. Es gibt keine zweite Auflösungsstufe: fällt der
eine Stand auf einen anderen Zeitpunkt als der andere, entsteht eines der beiden Fehlerbilder.

- **Tote Referenz:** Datenbankzeile ohne zugehöriges Objekt. Die signierte URL entsteht **ohne
  Existenzprüfung**; der Fehler fällt erst beim Abruf auf.
- **Verwaistes Objekt:** Objekt ohne Datenbankzeile – über die Anwendung sieht und löscht es
  niemand mehr.

Verschärfend: die Anwendungsidentität ist mit nur `s3:GetObject`, `s3:PutObject` und
`s3:DeleteObject` und **ohne Listing-Recht** vorgesehen (belegt durch die versionierte
Policy-Datei `deploy/minio/incident-images-app.policy.json` und den CI-Job `objectstore`; eine so
berechtigte Identität ist in keiner betriebenen Umgebung provisioniert). Mit dieser Identität ist
ein Abgleichlauf zwischen Datenbank und Objektspeicher **nicht möglich** — ein Recovery-Konzept
muss den Abgleich also mit einer anderen, noch festzulegenden Identität einplanen.

**Offener Betreiberentscheid:** Reihenfolge der Sicherung, zulässige Abweichung zwischen den
beiden Ständen und der Umgang mit verwaisten Objekten sind **nicht entschieden**
(`deploy/README.md`, Abschnitt 10; die offene Entscheidung ist dort auf Abschnitt 13 verwiesen).

## Wiederherstellung
- **Einzeldatensatz:** über eine Datenbanksicherung bzw. Soft-Delete-Wiederherstellung
  (Bilder: `deleted_at`=NULL). KONZEPT.
- **Datenbank:** `deploy/scripts/db-restore.sh` ist ausdrücklich **destruktiv** und stellt
  **ausschließlich PostgreSQL** wieder her.
- **Objektdaten:** für die Bilddateien in MinIO **existiert kein Wiederherstellungsverfahren**,
  weil es kein Sicherungsverfahren gibt (fehlender Nachweis). Ein Datenbank-Dump allein ist
  keine vollständige Wiederherstellungsgrundlage.
- **Reihenfolge (KONZEPT):** Konfiguration → Datenbank → Objektspeicher → Anwendung →
  Verifikation. Die Verifikation ist bisher nicht ausgearbeitet, weil der Abgleichlauf am
  fehlenden Listing-Recht scheitert.

## Kennzahlen (RPO/RTO)
**OFFENER BETREIBERENTSCHEID, unbelegt.** Die folgenden Zahlen sind Vorschläge aus dem
AP7-Konzept und **nicht bestätigt und nicht durch ein Verfahren gedeckt**:

- **RPO** (max. Datenverlust): Vorschlag ≤ 24 h.
- **RTO** (max. Ausfalldauer): Vorschlag ≤ 4 h.

Belegt ist ausschließlich ein Dumpverfahren für PostgreSQL; PITR und WAL-Archivierung sind
**nicht belegt**, und für die Objektdaten fehlt jedes Verfahren. Beide Werte sind daher ohne
Betreiberentscheid und ohne technischen Nachweis nicht als Ziel führbar. Aufbewahrungsfristen
entscheidet Dennis; die V1-Produktionssperre bleibt bestehen.

## Recovery-Test
**FEHLENDER NACHWEIS.** Ein reproduzierbarer Recovery-Test mit **neutralen Testdaten** ist
vorgesehen, hat aber **nicht stattgefunden – weder für die Datenbank noch für die Objektdaten**
(`deploy/README.md:386`) → offen, nicht als bestanden gewertet. Ebenso hat **kein Containerlauf**
stattgefunden; `deploy/README.md` ist selbst als Entwurf markiert.
