# Einordnung des Befunds „`.env.example` veraltet" (Review-Chat, 2026-08-16)

> Antwort auf `befund-env-example.md` (Worker-/Cowork-Befund vom 2026-08-16). Verfasst von Claude
> (Rolle Orchestrator/Review, Cowork-Chat 1). Keine Umsetzung durch diese Notiz.

## Verdikt: kein AUFTRAG daraus — Befund abgelehnt in der vorgeschlagenen Form

Geprüft am 2026-08-16 gegen den tatsächlichen Codestand:

- `app/src/lib/minio-config.ts` führt unverändert die fünf `S3_*`-Pflichtvariablen als hartes
  Startgate; `minio-storage.ts` liefert signierte S3-URLs.
- `IMAGE_STORAGE_DIR` kommt in `app/src/**` und `deploy/**` an keiner Stelle vor.
- `00-Projektsteuerung/ADR-011-postgres-eigenplattform.md` nennt MinIO weiterhin als verbindlich
  entschiedenen Bestandteil der Zielplattform.

**`app/.env.example` ist damit heute quellentreu zum Code — nicht veraltet.** Eine Umstellung auf
`IMAGE_STORAGE_DIR` würde die Doku gegen den Code falsch machen (App startet ohne S3-Werte nicht).

## Eigentlicher Blocker: offene ADR-011-Entscheidung (Dennis)

Die IT-Rückmeldung (`07-Betrieb/IT_RUECKMELDUNG_INFRASTRUKTUR.md`, 2026-08-03) streicht MinIO und
verlangt Dateisystem-Bildspeicher plus Portainer-Standard. Das ist die Rücknahme eines Punkts einer
bindenden Architekturentscheidung; der vollständige Befund samt Diskrepanzen (kein austauschbares
Storage-Interface, anderes Ausliefermodell, UID/GID, Compose-Neufassung, CI-Job `objectstore`,
Migration 0016) steht seit dem 2026-08-03 unbeantwortet in
`00-Projektsteuerung/CODEX_ANFRAGE_BILDSPEICHER_DATEISYSTEM.md`, Abschnitt „Entscheidungsbedarf".

## Konsequenz für die Arbeitsplanung

1. **Keine Arbeitsscheibe zu `.env.example`**, solange die ADR-011-Frage offen ist.
2. Entscheidet Dennis für den Dateisystem-Speicher, wird daraus ein eigener AP14-Block
   (Storage-Schicht, sitzungsgeprüfte Bildroute, Dockerfile, drei Compose-Dateien, CI, Deploy),
   den der Review-Chat in einzeln prüfbare AUFTRAG_&lt;n&gt;-Scheiben zerlegt; `.env.example` und
   `deploy/README.md` sind darin Teilscope.
3. `AUFTRAG_1.md` (Testinfrastruktur `ap15b-incident-list-url.test.mjs`) bleibt unverändert die
   erste Arbeitsscheibe für den Worker-Chat.

Kein Commit, kein Push, keine Änderung an Code, `.env.example`, `.claude/agents` oder `run-*.ps1`
durch diese Notiz.
