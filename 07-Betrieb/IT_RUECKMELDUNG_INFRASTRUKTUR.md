# Rückmeldung zu `IT_ANFRAGE_INFRASTRUKTUR.md`

> Stand: 2026-08-03. Antwort auf den Bestellzettel vom 2026-08-01. Diese Rückmeldung ändert zwei
> Dinge: (a) **MinIO fällt weg**, Bilder liegen im Dateisystem, (b) das Deployment folgt unserem
> Standard (Portainer-Stack, Host-Mounts unter `/var/docker-compose/<stack-name>`). Alles andere aus
> dem Bestellzettel bleibt gültig. `deploy/README.md` ist entsprechend anzupassen.

---

## 1. Entscheidung: MinIO entfällt, Bildspeicher ist das Dateisystem

**Abschnitt 4 des Bestellzettels wird gestrichen**, ebenso die Bucket-Route in Abschnitt 2 und alle
`MINIO_*`/`S3_*`-Werte in Abschnitt 6.

**Begründung:**

- Wir hatten mit MinIO in der Vergangenheit **massive Betriebsprobleme** — Upgrades mit
  Breaking Changes, Bruch von IAM-/Policy-Verhalten zwischen Versionen, fehleranfällige manuelle
  Provisionierung von Bucket/Policy/Identität je Umgebung, und Signatur- bzw. Host-Header-Probleme,
  sobald ein Reverse Proxy zwischen Client und Bucket steht. Genau diese Punkte stehen im
  Bestellzettel als offene Risiken drin (fünf manuelle Schritte, „muss beim ersten echten Aufbau
  gemeinsam mit der IT geklärt werden") — das ist Aufwand und Ausfallrisiko, das wir für **einen
  einzigen Bucket auf einem einzigen Server** nicht rechtfertigen können.
- Das Projekt bewegt sich zusätzlich **stärker in diese Richtung**: ein Deployment pro Umgebung,
  auf einem Host, mit Host-Mounts und zentraler Dateisicherung. Ein S3-Ökosystem mit eigenem
  Identitätsmodell, eigenem Netzwerkpfad und eigenem Backupverfahren ist dafür die falsche
  Abstraktion. Ohne MinIO fallen ein Dienst, ein Image-Freigabeprozess, vier Geheimnisse, eine
  Proxy-Route und ein komplettes zweites Backupverfahren weg.
- Ein späterer Wechsel auf S3 bleibt möglich: die Anwendung kapselt Bildzugriffe hinter einer
  Storage-Schnittstelle, die Dateisystem-Implementierung ist eine von mehreren möglichen.

**Was daraus folgt:**

| Vorher | Jetzt |
| --- | --- |
| `minio`-Dienst im Stack, Image-Digest von der IT | entfällt |
| `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` | entfallen |
| `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | entfallen |
| zweite Proxy-Route auf `/incident-images` mit unveränderten Pfad-/Query-/Host-Werten | entfällt — HAProxy braucht **nur noch eine** Route auf die App |
| signierte, direkt vom Browser abgerufene Bild-URLs | Bilder werden **ausschließlich von der Anwendung** über eine sitzungsgeprüfte Route ausgeliefert |
| separates Objekt-Volume + eigenes Backupverfahren | ein Host-Verzeichnis, das die bestehende Dateisicherung mitnimmt |

## 2. Vorgaben für den Bildspeicher (relevant für Implementierung)

- Container-Pfad **`/data/images`**, konfiguriert über **`IMAGE_STORAGE_DIR`**. Kein Fallback auf
  einen Pfad innerhalb des Images — fehlt oder ist die Variable nicht beschreibbar, startet die
  Anwendung nicht (Fail-Fast statt stiller Ablage in der Container-Schicht).
- **Schreiben atomar:** Temporärdatei im **selben** Dateisystem, dann `rename`. Kein Schreiben
  direkt an den Zielnamen, kein `/tmp` als Zwischenstation (anderes Dateisystem → `rename` schlägt
  fehl). Für Temporärdateien ein Unterverzeichnis `/data/images/.tmp`, das beim Start aufgeräumt wird.
- **Verzeichnis-Sharding**: Ablage unter `<2 Hex-Zeichen des Schlüssels>/<Schlüssel>`, damit kein
  Verzeichnis mit zehntausenden Einträgen entsteht.
- **Löschen ist idempotent**: `ENOENT` ist kein Fehler.
- **Kein Directory-Listing** als Teil der Fachlogik — die Datenbank ist die Wahrheit darüber,
  welche Bilder existieren.
- Pfadbildung ausschließlich aus intern erzeugten Schlüsseln, **niemals** aus Benutzereingaben oder
  Originaldateinamen (Path Traversal).
- Der Health-Check (`/api/health`) prüft zusätzlich, dass `/data/images` existiert und
  **beschreibbar** ist — sonst ist ein defekter Mount erst beim ersten Upload sichtbar.
- Ausliefern über eine Anwendungsroute mit Sitzungsprüfung; kein statischer Webserver, kein
  `X-Accel-Redirect`/`X-Sendfile`-Pfad an HAProxy vorbei.

## 3. Zielumgebung: unser Standard

- Betrieb als **Portainer-Stack** (Docker Standalone Endpoint). Es gibt **keine** Deploy-Skripte auf
  dem Host, kein `docker compose` per SSH, keine `--wait`-Abhängigkeit. Stack-Env-Variablen werden in
  Portainer gepflegt, nicht im Repository.
- **Alle** persistenten Daten liegen als **Host-Mounts** unter
  `/var/docker-compose/<stack-name>/<container-name>/` — also ein eigenes Verzeichnis je Dienst.
  Keine named volumes.

```
/var/docker-compose/kabelbereitschaft-stage/     (Stage)
/var/docker-compose/kabelbereitschaft/           (Produktion)
    ├── postgres/             → /var/lib/postgresql/data   (PGDATA = .../pgdata)
    └── app/
        └── images/           → /data/images               (Bildspeicher, ersetzt MinIO)
```

- **Wichtig für die Compose-Datei:** Bind-Mounts **absolut** angeben
  (`/var/docker-compose/kabelbereitschaft/app/images:/data/images`). Relative Pfade (`./…`) lösen in
  Portainer gegen dessen eigenes Stack-Verzeichnis auf, nicht gegen
  `/var/docker-compose/<stack-name>` — das würde die Daten woanders ablegen als vorgesehen.
- Der **Verzeichnisname entspricht dem Dienstnamen** in der Compose-Datei (`postgres`, `app`). Wird
  ein Dienst umbenannt, wird auch das Host-Verzeichnis mitbenannt.
- **PostgreSQL 18 läuft im Stack** (nicht zentral), Datenverzeichnis als Host-Mount. `PGDATA` auf ein
  **Unterverzeichnis** des Mounts setzen (`/var/lib/postgresql/data/pgdata`), damit `initdb` nicht
  über `lost+found`/Mount-Wurzel-Eigenheiten stolpert.
- **Feste UID/GID im Image** (Vorschlag `10001:10001`, non-root), damit die IT die Host-Verzeichnisse
  deterministisch `chown`en kann. Postgres bleibt beim Image-Standard (`999`). Beide
  Host-Verzeichnisse vor dem ersten Start anlegen und passend berechtigen — Portainer legt fehlende
  Bind-Mount-Pfade als `root:root` an, was dem App-Container das Schreiben verwehrt.
- **Ein stack-eigenes Netzwerk `stack`** wird in der Compose-Datei deklariert, alle Dienste hängen
  ausschließlich daran. Damit läuft die interne Kommunikation (App → Postgres) in einem abgeschirmten
  eigenen Netz und nicht im Default-Netz des Endpoints; die Dienste erreichen sich über ihren
  Dienstnamen (`postgres:5432`). Stage und Produktion sind getrennte Stacks und bekommen dadurch
  automatisch getrennte Netze.
  - Nicht als `internal: true` — das würde auch ausgehenden Verkehr des App-Containers unterbinden.
    Die Abschirmung entsteht dadurch, dass **nur** die App einen Port veröffentlicht.
- **Anbindung an HAProxy: die App veröffentlicht einen Port.** Postgres veröffentlicht **keinen**.
  - Publish gebunden an das Loopback-Interface: `127.0.0.1:${APP_PORT}:3000`. Ohne die
    IP-Angabe hängt der Port auf allen Interfaces und ist am Proxy und an der Firewall vorbei
    direkt erreichbar.
  - Läuft HAProxy nicht auf demselben Host, tritt an die Stelle von `127.0.0.1` die interne
    Server-Adresse — dann muss die Firewall den Port auf den Proxy einschränken.
  - `APP_PORT` kommt aus den Stack-Env-Variablen, **je Umgebung unterschiedlich** (Stage und
    Produktion können auf demselben Host laufen und würden sich sonst den Port streiten).
    Vorschlag: Produktion `3000`, Stage `3001` — die endgültige Vergabe macht die IT.
  - Die Anwendung lauscht im Container unverändert auf `3000`; das Mapping ist reine Host-Sache.
- Architektur `amd64` wird bestätigt vorausgesetzt; Logging `json-file`, 10 MB × 5 je Dienst;
  `restart: unless-stopped`; `depends_on` mit `condition: service_healthy` für die Datenbank.
- Bilddaten und Datenbank liegen unter **einem** Stack-Verzeichnis, wachsen aber weiter unabhängig —
  die Bemessung des Speicherplatzes bleibt wie im Bestellzettel eine IT-Angabe.

## 4. Aktualisierte Liste: was die IT noch liefern muss

| Wert | Umgebung | Wer |
| --- | --- | --- |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Stage und Produktion je eigenes | IT |
| `AUTH_SECRET` | Stage und Produktion je eigenes | von uns generierbar, IT legt als Stack-Secret ab |
| Domain/DNS für `AUTH_URL` | Stage und Produktion je eigenes | IT |
| `APP_PORT` je Umgebung (Host-Port für HAProxy, siehe Abschnitt 3) | Stage und Produktion je eigenes | IT |
| Angelegte und berechtigte Host-Verzeichnisse | je Umgebung | IT |
| ghcr.io-Zugriff + Registry-Eintrag in Portainer (`read:packages`) | Zielserver | IT/wir gemeinsam |

Entfallen gegenüber dem Bestellzettel: MinIO-Image-Referenz, `MINIO_ROOT_*`, `S3_*`, die
Bucket-Route und die fünf manuellen MinIO-Provisionierungsschritte.

## 5. Auswirkung auf Backup (Abschnitt 7 des Bestellzettels)

Die Bilddaten sind jetzt ein gewöhnliches Verzeichnis unter
`/var/docker-compose/<stack-name>/app/images/` und können von der bestehenden Dateisicherung ohne Sonderverfahren mitgenommen werden. Ein
S3-spezifisches Sicherungsverfahren ist damit nicht mehr nötig. **Unverändert offen bleibt** der
Hinweis auf nicht deckungsgleiche Wiederherstellungspunkte: Datenbank-Dump und Dateisicherung
entstehen zu unterschiedlichen Zeitpunkten, ein wiederhergestellter Datensatz kann auf ein noch
fehlendes Bild zeigen. Der Recovery-Test bleibt Teil der AP14-Abnahme.

## 6. Unverändert gültig

Abschnitt 1 (Zielserver), 2 (TLS, Forwarded-Header, Uploadgröße ≥ `NEXT_PUBLIC_MAX_IMAGE_MB` plus
Reserve, Rate Limiting am Proxy) — mit zwei Abweichungen: die Bucket-Route entfällt, und die Aussage
„wir veröffentlichen keinen Port" gilt nur noch für Datenbank und Bildspeicher; die App
veröffentlicht einen an das Loopback-Interface gebundenen Port für HAProxy (Abschnitt 3). Weiter
gültig: Abschnitt 3 (getrennte Datenbanken und Zugangsdaten,
`app_user` ohne `SUPERUSER`/`BYPASSRLS` via Bootstrap), 5 (Registry), 8 (Monitoring/Logs offen) und
9 (V1 als Produktionssperre, nur synthetische Daten auf Stage, Migrationen ausschließlich nach
Freigabe durch Dennis, in Produktion nur Digest als Image-Referenz).
