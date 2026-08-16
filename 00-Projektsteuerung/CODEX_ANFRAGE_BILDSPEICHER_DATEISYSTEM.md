# Anfrage an Codex: MinIO vs. Dateisystem als Bildspeicher

> Stand: 2026-08-03. Verfasst von Claude als Befund zur Architekturentscheidung — **keine
> Umsetzung erfolgt.** Auslöser: die interne IT hat auf `07-Betrieb/IT_ANFRAGE_INFRASTRUKTUR.md`
> geantwortet (`07-Betrieb/IT_RUECKMELDUNG_INFRASTRUKTUR.md`, 2026-08-03) und schlägt vor, MinIO
> ersatzlos zu streichen und Vorgangsbilder stattdessen im Dateisystem eines Host-Mounts abzulegen.

## Worum es geht

`00-Projektsteuerung/ADR-011-postgres-eigenplattform.md` ist als **„Status: angenommen /
verbindlich"** markiert (beschlossen 2026-07-30, Entscheider Dennis) und nennt **MinIO** ausdrücklich
als Teil der verbindlichen Zielplattform (Zeile 5: „PostgreSQL 18, Auth.js v5, MinIO und
Containerbetrieb..."; Zeile 202: „Entschieden: MinIO als selbst betriebener, S3-kompatibler
Bildspeicher im Compose-Stack").

Der Vorschlag der IT ist damit keine Konfigurationsfrage, sondern die Rücknahme eines Punktes einer
bindenden Architekturentscheidung. Nach `AGENTS.md` setzt Codex die Architekturgrenzen — dieser
Befund geht deshalb an Codex, bevor irgendetwas umgesetzt wird.

## Befund: die IT-Annahmen stimmen an mehreren Stellen nicht mit dem Codestand überein

Ich habe das gegen den tatsächlichen Code und die bestehenden Betriebsdateien geprüft (nur gelesen,
nichts verändert):

1. **Kein austauschbares Storage-Interface.** Die Rückmeldung geht davon aus, dass „die Anwendung
   Bildzugriffe hinter einer Storage-Schnittstelle kapselt, die Dateisystem-Implementierung ist eine
   von mehreren möglichen". Tatsächlich liefert `app/src/lib/minio-storage.ts` signierte S3-URLs, und
   `app/src/lib/images-server.ts` reicht dieses `signed_url` direkt an die Galerie weiter — der
   Browser lädt Bilder also **direkt vom Objektspeicher**. Die IT will dagegen „Bilder werden
   ausschließlich von der Anwendung über eine sitzungsgeprüfte Route ausgeliefert" (Abschnitt 2 der
   Rückmeldung) — das ist ein **anderes Ausliefermodell**, kein reiner Backend-Tausch. Es braucht eine
   neue, sitzungsgeprüfte Bildroute; `GalleryImage` (`lib/images.ts`) und die Aufrufer der Galerie
   müssen entsprechend geändert werden.
2. **UID/GID-Diskrepanz.** `app/Dockerfile` läuft aktuell als `USER node` — der eingebaute Benutzer
   des Basisimages `node:22-bookworm-slim`, UID **1000**. Die Rückmeldung schlägt UID/GID
   **`10001:10001`** vor. Diese UID existiert im Image nicht; ein eigener Benutzer müsste im
   Dockerfile angelegt werden, oder die IT bestätigt UID 1000.
3. **Compose-Struktur ist eine Neufassung, keine Wertänderung.** `deploy/compose.yml` verwendet heute
   named volumes (`postgres-data`, `minio-data`), Netzwerkname `internal`, keinen veröffentlichten
   Port. Die Rückmeldung verlangt absolute Bind-Mounts unter `/var/docker-compose/...`, Netzwerkname
   `stack`, einen an `127.0.0.1` gebundenen veröffentlichten App-Port und ein `PGDATA`-Unterverzeichnis.
   Das betrifft alle drei Compose-Dateien (`compose.yml`, `compose.stage.yml`,
   `compose.production.yml`) vollständig.
4. **Deploy-Skripte passen nicht zu Portainer.** `deploy/scripts/deploy.sh` und `rollback.sh` gehen
   von direkter `docker compose`-Ausführung (SSH) aus. Portainer-Stacks werden üblicherweise über die
   Portainer-API/GUI oder einen Webhook aktualisiert, nicht per SSH-Skript. Wie Deploy, Rollback und
   Health-Check unter Portainer ablaufen sollen, ist in der Rückmeldung nicht beschrieben.
5. **CI-Job `objectstore` wird hinfällig.** `.github/workflows/ci.yml` (ab Zeile 280) startet einen
   echten, digest-fest referenzierten MinIO-Container und prüft Policy/Rechte dagegen. Bei einem
   Wechsel auf das Dateisystem entfällt dieser Job vollständig und müsste durch einen
   Dateisystem-Äquivalent ersetzt werden (Schreib-/Lösch-/Pfad-Traversal-Test).
6. **Sunk Work.** Branch `feat/ap14b-images-minio` (PR #5) enthält bereits Migration
   `0016_ap14b_images_columns_grants.sql` (Spaltenrechte für `storage_path`), 37
   Bild-Integrationstests und den CI-Job `objectstore` — das ist der bisherige Umsetzungsstand für
   genau das, was jetzt verworfen würde. Die **Datenbankseite bleibt unverändert richtig** (Metadaten,
   RLS betreffen nicht die Objektschicht); nur die Objektschicht selbst und alles, was direkt daran
   hängt (Migration 0016, Bildroute, CI-Job, Compose, Dockerfile-Benutzer), ist betroffen.

## Was an der IT-Vorgabe fachlich in Ordnung ist

Die konkreten Vorgaben zum Dateisystem-Speicher (Rückmeldung Abschnitt 2 — atomar schreiben via
`rename` im selben Dateisystem, Verzeichnis-Sharding, idempotentes Löschen, kein Directory-Listing,
Pfadbildung ausschließlich aus internen Schlüsseln) sind technisch stimmig und dagegen spricht
nichts. Sie passen sogar zu `buildStoragePath()` in `app/src/lib/images.ts`, das schon heute
ausschließlich aus geprüften UUIDs baut und damit Pfad-Traversal-sicher ist.

## Offene Rückfragen an die IT (vorgeschlagen, noch nicht gestellt)

- Sind UID/GID `10001:10001` und der Netzwerkname `stack` verbindlich oder Vorschlag? (Bei `APP_PORT`
  steht ausdrücklich „die endgültige Vergabe macht die IT", bei der UID nur „Vorschlag".)
- Wie laufen Deploy, Rollback und Health-Check unter Portainer konkret ab?
- Wie ist die bestehende Dateisicherung technisch eingebunden — Snapshot bei offenem Schreibvorgang
  ein Risiko?

## Entscheidungsbedarf

1. Wird ADR-011 in der MinIO-Passage geändert (Entscheidung Dennis, ggf. mit Codex als Architekt)?
2. Falls ja: Wie wird mit dem bestehenden Stand auf `feat/ap14b-images-minio` (PR #5) umgegangen —
   verwerfen, oder Metadaten-/RLS-Teile weiterverwenden und nur die Objektschicht austauschen?
3. Wer schreibt die neue Auslieferroute (sitzungsgeprüfter Bildabruf) und passt Dockerfile/Compose/CI
   an — das ist regulärer Umsetzungsumfang für `kb-implementierung`, aber erst nach Punkt 1 und 2.

Bis diese drei Punkte geklärt sind, wird an AP14B „Bilder und Uploads" nicht weitergearbeitet.
