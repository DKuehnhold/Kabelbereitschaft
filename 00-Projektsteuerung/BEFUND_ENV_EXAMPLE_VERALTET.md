# Befund für den Review-Chat: `app/.env.example` veraltet gegenüber IT-Rückmeldung

> Stand: 2026-08-16. Gefunden von Claude (Cowork-Sitzung, Gerätebrücke) beim Versuch, für einen
> lokalen Testlauf synthetische `.env.local`-Platzhalterwerte zu setzen. Keine Änderung an
> `.env.example` durch diese Notiz — bewusst nur dokumentiert, damit der Review-Chat daraus eine
> Arbeitsscheibe für den Worker-Chat machen kann.

## Worum es geht

`app/.env.example` beschreibt im Abschnitt „Pflicht: interner Objektspeicher fuer Bilder
(MinIO/S3; ADR-011)" fünf Pflichtvariablen (`S3_ENDPOINT`, `S3_PUBLIC_BASE_URL`, `S3_BUCKET`,
`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`) als verbindlich für den Bildspeicher, inklusive
Fail-Closed-Hinweis bei Containerstart.

Das ist seit `07-Betrieb/IT_RUECKMELDUNG_INFRASTRUKTUR.md` (Stand 2026-08-03, Abschnitt 1) **nicht
mehr aktuell**: die IT hat MinIO/S3 für den Bildspeicher gestrichen. Bilder liegen stattdessen in
einem Dateisystem-Mount, gesteuert über die einzelne Variable `IMAGE_STORAGE_DIR`
(Container-Pfad `/data/images`, siehe Abschnitt 2 der IT-Rückmeldung: atomares Schreiben über
Temp+`rename`, Verzeichnis-Sharding, idempotentes Löschen, kein Directory-Listing, Health-Check
prüft Existenz/Schreibbarkeit).

`app/.env.example` wurde nach diesem Beschluss offenbar nicht nachgezogen — die Rückmeldung selbst
weist ausdrücklich darauf hin: *„`deploy/README.md` ist entsprechend anzupassen"*, `.env.example`
ist dort nicht explizit genannt, gehört aber zum selben Bild.

## Warum das jetzt auffällt

Beim Versuch, für einen lokalen, synthetischen Testlauf (ohne echte IT-Werte, wie mit Dennis
besprochen) eine `.env.local` zu befüllen, würde ein unbedarfter Blick in `.env.example` auf das
falsche, bereits abgelöste Bildspeicher-Schema führen (MinIO/S3 statt `IMAGE_STORAGE_DIR`).

## Vorschlag für die Arbeitsscheibe (durch den Worker-Chat)

- Abschnitt „Pflicht: interner Objektspeicher..." in `app/.env.example` ersetzen durch
  `IMAGE_STORAGE_DIR` (Beispielwert lokal, klar als synthetisch/lokal gekennzeichnet), inkl. Verweis
  auf `IT_RUECKMELDUNG_INFRASTRUKTUR.md` als Quelle.
  - Prüfen, ob `app/src/lib/minio-config.ts` (bzw. dessen Nachfolger, falls im Zuge von AP15/AP14
    bereits umgebaut) tatsächlich noch `MINIO_REQUIRED_ENV_KEYS`/`S3_*` liest oder ob dort bereits
  auf `IMAGE_STORAGE_DIR` umgestellt wurde — falls die Umstellung im Code selbst noch aussteht,
  ist das eine größere, separate Arbeitsscheibe (nicht nur Doku), bitte vom Review-Chat entsprechend
  einordnen und priorisieren.
  - `deploy/README.md`, `deploy/compose*.yml` auf denselben Stand prüfen (dort laut Rückmeldung
    ohnehin schon als anzupassen vermerkt).
- Kein Commit/Push ohne Freigabe durch Dennis, wie bei allen anderen Arbeitsscheiben.

Bitte durch den Review-Chat zu einer eigenen `AUFTRAG_<n>.md`-Notiz für den Worker-Chat machen,
inklusive Entscheidung, ob es bei reiner Dokumentationskorrektur bleibt oder ob im Code selbst noch
MinIO-Reste entfernt werden müssen.
