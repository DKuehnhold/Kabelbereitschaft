# Containerbetrieb – Kabelbereitschaft

> Stand: 2026-08-03 · AP14 / Arbeitspaket A, fortgeschrieben nach Arbeitspaket B
> (Objektspeicher) und nach AP15-3 (Runtime- und CI-Wahrheit) · **Entwurf, nicht
> freigegeben**

## 0. Statuswarnung — bitte zuerst lesen

**Dieser Stack ist NICHT produktionsfähig.**

1. Supabase ist **abgelöst**: Authentifizierung, Datenzugriff und Bildspeicher laufen gegen die
   interne Plattform aus PostgreSQL, Auth.js und MinIO
   (`../00-Projektsteuerung/ADR-011-postgres-eigenplattform.md`). Damit ist der Stack aber **nicht**
   freigegeben — es fehlen weiterhin die echten Endpunkte, Zugangsdaten und DNS-Angaben der internen
   IT sowie die **Proxyfreigabe für die Bucket-Route** (Abschnitte 5 und 13).
2. **V1 (Aufbewahrungsfristen für Personen-, EXIF-/GPS- und Auditdaten) ist offen und wirkt als
   Produktionssperre.** Bis zur Entscheidung durch Dennis führen Stage und Test ausschließlich
   synthetische Daten; produktiver Datenanfall ist gesperrt.
3. Es hat **kein produktiver Containerlauf** stattgefunden, und **auf dem Arbeitsplatz** hat
   überhaupt kein Containerlauf stattgefunden — dort ist keine Containerlaufzeit vorhanden. In der
   GitHub-CI laufen dagegen Containerprüfungen: der Job `container` baut das Image, startet es und
   erzwingt den Konfigurationsabbruch, der Job `objectstore` startet einen echten MinIO-Container
   (`.github/workflows/ci.yml`). Diese CI-Prüfungen sind **kein Nachweis einer produktiven
   Umgebung** und **kein Nachweis der echten Reverse-Proxy-Route**. Die offenen Nachweise stehen in
   Abschnitt 12.
4. Der `minio`-Dienst des Compose-Stacks ist **im Betrieb ungeprüft**. Auf dem Arbeitsplatz, an dem
   er geschrieben wurde, ist **keine Containerlaufzeit** vorhanden: er konnte dort weder gestartet
   noch mit `docker compose config` validiert werden. Beides leistet inzwischen die CI:
   `docker compose config` prüft das Stackmodell für **Stage und Produktion** einschließlich
   `minio`, und der Job `objectstore` startet einen echten, digest-fest referenzierten
   MinIO-Container und führt den Produktivcode dagegen aus (`.github/workflows/ci.yml`). **Weiter
   unbestätigt** bleibt das Healthcheck-Kommando des Compose-Dienstes `minio`, weil die CI den
   Server per `docker run` startet und nicht über den Compose-Stack (Abschnitt 12).
5. Eine **automatische Provisionierung des Objektspeichers gibt es nicht mehr**. Bucket, Policy und
   Anwendungsidentität legt die interne IT vor dem ersten Start an (Abschnitt 4,
   „MinIO-Provisionierung durch die interne IT"). Ohne diesen Schritt startet die Anwendung
   **trotzdem gesund** und jeder Bildupload scheitert erst zur Laufzeit.

## 1. Zielarchitektur

```
Unternehmens-Gateway
        │
   HAProxy  (TLS-Terminierung, HTTP→HTTPS, Rate Limiting, X-Forwarded-*)
        │  intern, unverschlüsselt
        ├─ /            → app   (Next.js 16.2.12, Node 22, non-root, :3000, nur "expose")
        │                   │
        │                   ├─ postgres  (18, nur internes Netz, persistentes Volume)
        │                   └─ minio     (nur internes Netz, privater Bucket, eigenes Volume)
        │
        └─ /<bucket>/…  → minio  (Bucket-Route für signierte GET-URLs, siehe Abschnitt 5)
```

Die Zielplattform ist die interne Eigenplattform nach ADR-011: **PostgreSQL 18** für Daten,
Anmeldung und Sitzungen, **Auth.js v5** für die Sitzungsverwaltung, **MinIO** als privater
Objektspeicher für die Vorgangsbilder. **Supabase ist abgelöst** und wird von keinem Modul mehr
benutzt; eine gesetzte Supabase-Laufzeitvariable verweigert den Containerstart (Abschnitt 12).

Bucket, Policy und Anwendungsidentität im Objektspeicher legt die **interne IT vor dem ersten
Start** an; der Stack tut das nicht selbst (Abschnitt 4, „MinIO-Provisionierung durch die interne
IT"). Nur der Dienst `minio` sieht die Root-Zugangsdaten des Objektspeichers; die Anwendung arbeitet
ausschließlich mit einer auf einen Bucket begrenzten Identität.

Der Reverse Proxy ist **HAProxy** und liegt außerhalb dieses Stacks. Deshalb:

- kein Proxy-Container,
- **kein veröffentlichter Port** — weder für die Anwendung noch für die Datenbank noch für den
  Objektspeicher,
- HAProxy muss `X-Forwarded-For`, `X-Forwarded-Proto` und `X-Forwarded-Host` setzen und von außen
  eingehende Fälschungen dieser Header verwerfen,
- HAProxy terminiert TLS (mindestens 1.2), erzwingt HTTP→HTTPS, setzt Uploadgrößen (mindestens
  `NEXT_PUBLIC_MAX_IMAGE_MB`, Standard 15 MB, plus Reserve) und Zeitlimits für Uploads und Server
  Actions,
- Rate Limiting liegt gemäß **V4** auf Proxy-Ebene, nicht in der Anwendung,
- interne Containerports werden nicht nach außen offengelegt.

Die Sicherheitsheader kommen weiterhin aus `app/next.config.ts` und dürfen im Proxy nicht
widersprüchlich gesetzt werden. **CSP bleibt Report-Only** — die Umstellung auf durchsetzend gehört
zu AP14 nach Auswertung eines Report-Endpunkts und ist nicht Teil dieses Arbeitspakets.

## 2. Voraussetzungen auf dem Server

| Anforderung | Wert |
|---|---|
| Betriebssystem | Linux, x86-64 (`linux/amd64`) — **noch zu bestätigen**, siehe Abschnitt 13 |
| Docker Engine | ≥ 24 (für `--wait` in Compose empfohlen ≥ 25) |
| Docker Compose | v2 (Plugin `docker compose`, nicht `docker-compose`) |
| Rechte | der ausführende Benutzer muss Docker ohne `sudo` nutzen können — **noch zu bestätigen** |
| Zugriff auf `ghcr.io` | ausgehend, für `docker pull` |
| Speicher | Datenbankvolume **und** Objektvolume für die Bilder; Bemessung beider offen (siehe Abschnitt 13) |

## 3. Verzeichnisstruktur

```
deploy/
├── compose.yml                 Basis-Stack (app, postgres, minio)
├── compose.stage.yml           Overlay Stage
├── compose.production.yml      Overlay Produktion
├── env/
│   ├── app.env.example         Vorlage – Platzhalter
│   ├── postgres.env.example    Vorlage – Platzhalter
│   ├── minio.env.example       Vorlage – Platzhalter (nur Root-Zugangsdaten)
│   └── .gitignore              echte *.env werden nie versioniert
├── minio/
│   └── incident-images-app.policy.json
│                               Berechtigungstext der Anwendungsidentität,
│                               versioniert; wird von der IT angelegt
├── scripts/
│   ├── deploy.sh               Update mit Health und automatischem Rollback
│   ├── rollback.sh             Rücksprung auf vorherige Version
│   ├── healthcheck.sh          Zustandsprüfung
│   ├── db-backup.sh            pg_dump (Custom-Format) + Prüfsumme
│   └── db-restore.sh           Wiederherstellung, destruktiv, mit Rückfrage
├── state/                      zur Laufzeit: deploy.log, previous-image.*
└── backups/                    zur Laufzeit: Dumps (Ablageort konfigurierbar)
```

## 4. Erstinstallation

```bash
# 1. Repository bzw. nur den Ordner deploy/ auf den Server bringen
# 2. Environment-Dateien aus den Vorlagen anlegen und ausfüllen
cd deploy
cp env/app.env.example      env/app.env
cp env/postgres.env.example env/postgres.env
cp env/minio.env.example    env/minio.env
chmod 600 env/app.env env/postgres.env env/minio.env
$EDITOR env/app.env env/postgres.env env/minio.env
#    Achtung: Bucketname und Anwendungszugangsdaten müssen zu dem passen, was
#    die IT im Objektspeicher anlegt (Kopplung siehe env/minio.env.example und
#    der Provisionierungsabschnitt unten).

# 3. An der Registry anmelden (Personal Access Token mit read:packages)
docker login ghcr.io

# 4. Konfiguration prüfen, ohne etwas zu starten
#    APP_IMAGE_REF enthält immer die vollständige Referenz (Tag ODER Digest),
#    weil ein Digest mit "@" und ein Tag mit ":" angehängt wird.
#    MINIO_IMAGE_REF ist aus demselben Grund eine vollständige Referenz. Sie hat
#    bewusst KEINEN Standardwert: welche MinIO-Version eingesetzt wird,
#    entscheidet die interne IT; eine hier eingetragene, ungeprüfte Referenz
#    wäre eine erfundene Angabe.
export APP_IMAGE_REF=ghcr.io/dkuehnhold/kabelbereitschaft@sha256:<digest>
export MINIO_IMAGE_REF=<von der IT geprüfte MinIO-Server-Referenz>
docker compose -f compose.yml -f compose.stage.yml config

# 5. MinIO-Provisionierung durch die interne IT durchführen (siehe unten) —
#    verbindlich, bevor die Anwendung produktiv genutzt wird.

# 6. Starten
scripts/deploy.sh stage ghcr.io/dkuehnhold/kabelbereitschaft@sha256:<digest>
```

Die Datenbank ist nach dem Start **leer**. Migrationen werden bewusst **nicht** automatisch
angewendet — siehe Abschnitt 9.

Der Objektspeicher ist nach dem Start ebenfalls leer, und **der Stack füllt ihn nicht**: es gibt
keinen Bootstrap-Dienst mehr, der Bucket, Policy oder Anwendungsidentität anlegt. Diese drei Dinge
sind ein manueller, verbindlicher Schritt der internen IT — beschrieben im folgenden Abschnitt.

### MinIO-Provisionierung durch die interne IT (verbindlich vor dem ersten Start)

Dieser Schritt ist **nicht optional** und gehört in die Inbetriebnahme-Checkliste. Er wird einmal je
Umgebung (Stage, Produktion) mit den Root-Zugangsdaten aus der jeweiligen `env/minio.env`
durchgeführt.

**Warum manuell:** die naheliegende Automatisierung mit dem MinIO-Clientwerkzeug übergibt
Zugangsdaten als **Prozessargumente** (`mc alias set`, `mc admin user add`); sie stehen damit für
andere Prozesse im selben PID-Namensraum in der Prozessliste. Ob dieselbe Fassung des Werkzeugs die
Zugangsdaten geheimnisfrei über eine Umgebungsvariable (`MC_HOST_<alias>`) beziehungsweise über
`stdin` annimmt, **konnte hier nicht nachgewiesen werden** — auf dem Arbeitsplatz gibt es weder eine
Containerlaufzeit noch das Werkzeug selbst. Statt eine unbewiesene Absicherung zu behaupten, wurde
der automatische Bootstrap **entfernt**.

**Inzwischen belegt, ohne diesen Beschluss zu ändern:** der CI-Job `objectstore` zeigt, dass die
Root-Zugangsdaten über die Umgebungsvariable `MC_HOST_<alias>` und die Zugangsdaten der
Anwendungsidentität über `stdin` übergeben werden können, ohne in einer Kommandozeile zu erscheinen
(`.github/workflows/ci.yml`). Der produktive Stack provisioniert **weiterhin nicht** automatisch;
eine Wiedereinführung wäre eine eigene, freizugebende Entscheidung.

**Anforderung an das eingesetzte Werkzeug:** gleichgültig, ob Kommandozeilenwerkzeug, Weboberfläche
oder Automatisierung der IT — **Zugangsdaten dürfen nicht als Kommandozeilenargument übergeben
werden**. Zulässig sind Umgebungsvariablen, eine Eingabe auf `stdin` oder eine Konfigurationsdatei
mit restriktiven Rechten.

**Die vier Schritte:**

1. **Privaten Bucket anlegen.** Name gemäß `S3_BUCKET` aus `env/app.env`; die Vorlage nennt
   `incident-images`.
2. **Anonyme Freigabe ausdrücklich entfernen.** Auch dann, wenn nie eine gesetzt wurde: der Zustand
   „keine anonyme Freigabe" wird aktiv hergestellt und nicht angenommen. Es gibt keine öffentliche
   Bucket-Policy und keine öffentliche ACL.
3. **Policy anlegen** mit dem Inhalt von `deploy/minio/incident-images-app.policy.json` (Name der
   Vorlage: `incident-images-app`). Sie erlaubt genau `s3:GetObject`, `s3:PutObject` und
   `s3:DeleteObject` auf die Objekte **eines** Buckets — genau die drei Operationen, die
   `app/src/lib/minio-storage.ts` ausführt.
4. **Anwendungsidentität anlegen** (eigene Kennung, langes zufälliges Geheimnis) und ihr **genau
   diese eine Policy** zuordnen. Kennung und Geheimnis kommen anschließend als `S3_ACCESS_KEY_ID`
   und `S3_SECRET_ACCESS_KEY` in `env/app.env`.

**Verifikationspflicht — nicht überspringen.** Nach dem Anlegen ist zu **bestätigen**, dass die
Policy der Identität tatsächlich zugeordnet ist, und zu **prüfen**, dass die Identität **keine
weitergehenden Rechte** besitzt: kein `s3:ListBucket`, kein `s3:*`, keine Bucketverwaltung, kein
Zugriff auf andere Buckets. Grund: die frühere automatische Zuordnung endete auf `|| true` — ein
Fehlschlag der Zuordnung blieb dadurch **unsichtbar**, und der Bootstrap meldete trotzdem Erfolg.
Genau dieser Fehler darf sich manuell nicht wiederholen.

**Root-Zugangsdaten:** sie werden ausschließlich für den Serverstart und für diesen
Provisionierungsschritt gebraucht. Die Anwendung sieht sie **niemals** — `env/minio.env` wird nur
vom Dienst `minio` gelesen, nicht vom Dienst `app`.

**Bucketname:** der Ressourcen-ARN in `deploy/minio/incident-images-app.policy.json` lautet
`arn:aws:s3:::incident-images/*` und muss mit `S3_BUCKET` in `env/app.env` übereinstimmen. Wird ein
anderer Bucketname verwendet, ist die Policy-Datei entsprechend anzupassen.

**Nicht fail closed — der Start ist ungesichert, die Absicherung ist rein organisatorisch:** fehlt
oder misslingt dieser Schritt, **startet die Anwendung trotzdem gesund**. Sie legt selbst keinen Bucket an und prüft beim Start auch nicht, ob er existiert
(`app/src/lib/minio-storage.ts` kennt nur Put, Get/Signieren und Delete;
`app/src/lib/minio-config.ts` prüft nur, ob Variablen gesetzt und formal gültig sind). Der Fehler
zeigt sich erst zur Laufzeit — **jeder Bildupload scheitert**. Vor der Umstellung fiel das beim Start
auf, weil die Anwendung auf den erfolgreichen Bootstrap wartete; dieser Rückschritt wird bewusst in
Kauf genommen und ist durch diesen Checklistenschritt zu kompensieren.

**Ungeprüft:** dieser **manuelle** Ablauf wurde in Stage oder Produktion nie ausgeführt
(Abschnitt 0, Punkt 3). Die gleichwertige Schrittfolge — Bucket anlegen, anonyme Freigabe entfernen,
Policy anlegen, Anwendungsidentität anlegen und ihr die Policy zuordnen, Zuordnung fail-closed
verifizieren — läuft dagegen im CI-Job `objectstore` gegen einen echten MinIO-Container
(`.github/workflows/ci.yml`). Das belegt die **Durchführbarkeit** der Schritte, **nicht** ihre
Durchführung in einer echten Umgebung.

## 5. Konfiguration

Alle Werte kommen aus `deploy/env/*.env` auf dem Server. **Keine Secrets im Repository und keine
Secrets in `compose.yml`.** Alle Dienste erhalten ihre Werte ausschließlich über `env_file`; **kein
Secret steht in einer Kommandozeile**.

Diese Aussage gilt seit der Entfernung des Bootstrap-Dienstes **ohne Ausnahme** — und zwar, weil die
betroffenen Kommandos **entfallen** sind, nicht weil sie abgesichert wurden. Früher übergab der
einmalige Bootstrap die MinIO-Root-Zugangsdaten und die Zugangsdaten der Anwendungsidentität als
Kommandozeilenargumente an das Clientwerkzeug; eine geheimnisfreie Variante konnte hier mangels
Containerlaufzeit nicht nachgewiesen werden. Statt eine unbewiesene Härtung zu behaupten, wurde der
Dienst entfernt. Die Provisionierung ist dadurch ein manueller IT-Schritt geworden (Abschnitt 4,
„MinIO-Provisionierung durch die interne IT"), samt der dort ausdrücklich benannten
Verschlechterung.

Fehlt eine Pflichtvariable, bricht der Container beim Start mit **Exit-Code 78** und einer klaren
Meldung ab, die ausschließlich Variablennamen nennt (`app/docker/verify-runtime-config.mjs`). Ein
stiller Start **ohne** Pflichtvariablen ist damit nicht mehr möglich. Die Startprüfung prüft
allerdings ausschließlich **Anwesenheit und Nichtleere** der Namen — kein Format und keinen
Platzhalterwert. Erkennbare Platzhalter weist erst die Laufzeitprüfung der fünf `S3_*`-Werte ab
(`app/src/lib/minio-config.ts`); ein Platzhalter in `DATABASE_URL`, `AUTH_SECRET` oder `AUTH_URL`
fällt beim Start **nicht** auf.

### Pflichtvariablen der Anwendung (`env/app.env`)

| Variable | Rolle |
|---|---|
| `DATABASE_URL` | Verbindung der Anwendung; eingeschränkte Rolle, kein `SUPERUSER`, kein `BYPASSRLS` |
| `AUTH_SECRET` | Schlüsselmaterial für die Sitzungstokens; ausschließlich Runtime-Secret |
| `AUTH_URL` | öffentliche Basis-URL hinter dem Proxy. Im Containerbetrieb **Pflicht**, weil `S3_PUBLIC_BASE_URL` gegen diesen Origin geprüft wird |
| `S3_ENDPOINT` | intern erreichbarer Objektspeicher, nur Server-zu-Server |
| `S3_PUBLIC_BASE_URL` | browserseitige Basis der signierten GET-URLs; **derselbe Origin wie `AUTH_URL`** |
| `S3_BUCKET` | privater Bucket der Vorgangsbilder |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Zugangsdaten der auf diesen einen Bucket begrenzten Anwendungsidentität |

Optional mit dokumentiertem Standard: `S3_REGION` (`us-east-1`, von MinIO ignoriert, aber von SigV4
benötigt) und `S3_FORCE_PATH_STYLE` (`true`). Vollständige Beschreibung in `env/app.env.example`.

Pflichtvariablen des Stacks selbst: `APP_IMAGE_REF` und `MINIO_IMAGE_REF` (Abschnitt 4).
`MINIO_CLIENT_IMAGE_REF` ist **entfallen** — sie gehörte zum entfernten Bootstrap-Dienst und wird von
`compose.yml` nicht mehr gebraucht. Die Root-Zugangsdaten des Objektspeichers stehen getrennt in
`env/minio.env`; die Kopplung zu `app.env` ist in `env/minio.env.example` beschrieben.

### Anforderung an die interne IT: Same-Origin-Route für den Bucket

`S3_PUBLIC_BASE_URL` muss **denselben Origin** haben wie `AUTH_URL` — das prüft `readMinioConfig()`
fail-closed. Daraus folgt eine Anforderung an den internen Reverse-Proxy:

- Unter diesem gemeinsamen Origin routet der Proxy den **Bucket-Pfad** auf den privaten
  `minio`-Dienst; der übrige Verkehr geht an `app`.
- Weil **Path-Style** verwendet wird (`S3_FORCE_PATH_STYLE=true`), beginnt der Pfad einer signierten
  URL mit dem **Bucketnamen**. Das ist das Merkmal, an dem der Proxy die Route unterscheiden kann.
- Der Proxy darf Pfad und Query-Parameter der signierten URL **nicht verändern** — die Signatur
  deckt sie ab. SigV4 signiert außerdem den **Host**: die Anwendung signiert gegen
  `S3_PUBLIC_BASE_URL`, nicht gegen den internen Dienstnamen (siehe
  `app/src/lib/minio-storage.ts`). Wie der Proxy den Host beim Weiterleiten behandeln muss, ist beim
  ersten echten Aufbau mit der IT zu klären — **hier ungeprüft**.

**Ohne diese Route bleiben Bilder im Browser unerreichbar.** Die konkrete Adresse, der Hostname und
die Freigabe liegen **nicht vor** und werden hier bewusst nicht erfunden (Abschnitt 13).

### Build- und Laufzeitvariablen

Next.js unterscheidet hart:

- **`NEXT_PUBLIC_*` wird zur Buildzeit in die Client-Bundles eingebrannt.**
- **Serverseitig gelesene Variablen** (`APP_VERSION`, `PORT`, `HOSTNAME`) sind zur Laufzeit setzbar.
  Das gilt auch für alle `S3_*`-Werte: sie werden ausschließlich serverseitig gelesen
  (`app/src/lib/minio-config.ts`, `minio-storage.ts` mit `server-only`) und gelangen **nicht** ins
  Client-Bundle.

| Variable | Stand |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **entfallen** und ausdrücklich **verboten** — gesetzt verweigert der Container den Start |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **entfallen** und ausdrücklich **verboten** — gesetzt verweigert der Container den Start |
| `NEXT_PUBLIC_MAX_IMAGE_MB` | Buildzeit, Client-Anzeige; **umgebungsunabhängig** (Standard 15) |
| `NEXT_PUBLIC_APP_VERSION` | war Buildzeit; ersetzt durch `APP_VERSION`, serverseitig, Laufzeit |

**Ergebnis:** es bleibt **kein öffentlicher, umgebungsspezifischer Wert** übrig. Ein Image ist damit
umgebungsunabhängig; die Promotion eines unveränderten Digests von Stage nach Produktion ist damit
grundsätzlich möglich, sobald die Freigaben aus Abschnitt 0 vorliegen — **erprobt wurde sie nicht**. Der ursprünglich vorgesehene
JSON-Konfigurationsblock im Layout wurde deshalb **bewusst nicht gebaut** — er wäre eine Struktur
ohne Inhalt. Sollte doch ein öffentlicher, umgebungsabhängiger Wert entstehen, wird der Block nach
der freigegebenen Vorgabe nachgezogen (serverseitig gelesen, sicher JSON-serialisiert, nicht
ausführbar, typisierte Zugriffsfunktion, CSP unverändert).

Ein zusätzlicher Grund, `layout.tsx` hier nicht anzufassen: die Datei trägt derzeit nicht committete
Branding-Änderungen (siehe Abschnitt 14).

## 6. Start, Stop, Neustart, Logs

```bash
cd deploy
CF="-f compose.yml -f compose.stage.yml"

docker compose $CF up -d --wait     # starten
docker compose $CF ps               # Zustand inkl. Health
docker compose $CF stop             # anhalten
docker compose $CF restart app      # nur die Anwendung neu starten
docker compose $CF down             # entfernen (Volume bleibt erhalten)

docker compose $CF logs -f app      # Logs folgen
docker compose $CF logs --tail 200 postgres
docker compose $CF logs --tail 200 minio
```

Der Stack kennt **nur** die drei Dienste `app`, `postgres` und `minio`; einen einmaligen
Bootstrap-Dienst gibt es nicht mehr. Ein „gesunder" Start sagt deshalb **nichts** darüber aus, ob
Bucket, Policy und Anwendungsidentität im Objektspeicher existieren — das prüft niemand automatisch
(Abschnitt 4, „MinIO-Provisionierung durch die interne IT").

Logrotation ist im Stack gesetzt (`json-file`, 10 MB × 5 Dateien je Dienst). Eine zentrale
Logaufbewahrung ist eine offene Entscheidung (Abschnitt 13).

## 7. Update

```bash
scripts/deploy.sh stage      ghcr.io/dkuehnhold/kabelbereitschaft@sha256:<digest>
scripts/deploy.sh production ghcr.io/dkuehnhold/kabelbereitschaft@sha256:<digest>
```

Ablauf: aktuelle Version protokollieren → `docker compose config` validieren → Image ziehen →
Container aktualisieren → Health abwarten → **bei Fehler automatisch Rollback** → Ergebnis in
`state/deploy.log`. In Produktion ist ausschließlich ein **Digest** zulässig; ein beweglicher Tag
wird abgewiesen. Es wird **nie auf dem Server gebaut**.

## 8. Healthcheck

- Im Container: `node /app/docker/healthcheck.mjs` gegen `GET /api/health`, ohne curl/wget.
- Von außen: `scripts/healthcheck.sh stage` prüft Docker-Zustand **und** den Endpunkt.
- `/api/health` liefert `status`, `version`, `time` — keine Secrets, keine DB-Details, kein
  Datenbankzugriff. Für Uptime-Prüfungen über HAProxy geeignet.

## 9. Datenbank und Migrationen

- **Der Containerstart führt keine Migrationen aus, und das produktive Deployment führt keine
  Migration automatisch aus.** Der Einsprung des Images (`app/docker/entrypoint.sh`) ruft
  ausschließlich die Konfigurationsprüfung `verify-runtime-config.mjs` auf und ersetzt sich danach
  durch den Node-Server; für den Dienst `app` kennt `deploy/compose.yml` kein eigenes `command`,
  und es gibt weder einen Migrations- noch einen Bootstrap-**Compose-Dienst**.
  Produktionsmigrationen erfolgen ausschließlich nach manueller Freigabe durch Dennis.
- **Die CI führt Bootstrap und Migrationskette dagegen aus.** Die frühere Aussage „die CI führt
  keine Migrationen aus" ist damit **überholt und hiermit richtiggestellt**. Der Job `database` in
  `.github/workflows/ci.yml` startet einen Service-Container `postgres:18-bookworm` und ruft
  `app/supabase/test/run_db_tests.sh` auf. Dieses Skript legt in diesem frisch gestarteten,
  ansonsten leeren Cluster eine eigene, danach wieder entfernte Testdatenbank an und wendet gegen
  sie **zuerst** die drei versionierten Bootstrap-Dateien `bootstrap/01_roles.sql`,
  `bootstrap/02_compat_auth.sql` und `bootstrap/03_compat_storage.sql` an, **danach** die
  Migrationen `0001`–`0017` in der **durch den Runner festgelegten Reihenfolge** — **verschränkt mit
  den SQL-Smokes**: jeder Smoke setzt den zuvor erteilten Rechtestand voraus, und umgekehrt darf
  eine später erteilte Berechtigung eine bestehende Negativprobe nicht still entwerten. Die
  Migrationen laufen also nicht als geschlossener Block. **Bootstrap ist von der nummerierten
  Migrationskette getrennt:** eigenes Verzeichnis `app/supabase/bootstrap/` mit eigenem
  Nummernschema `01`–`03`. Das ist ein
  **Prüfnachweis der Kette** und **kein** produktiver Migrationslauf; ein produktives Deployment
  ist damit ausdrücklich **nicht** nachgewiesen.
- Bestand: **17 versionierte Migrationen** `0001`–`0017` in `app/supabase/migrations/`, anzuwenden
  **strikt in der vorgesehenen Reihenfolge**. Eine allgemeine Additivität oder Idempotenz der Kette
  wird ausdrücklich **nicht** behauptet: `0013_ap14b_drop_supabase_compat.sql` baut den
  Supabase-Altpfad bewusst ab. Der Verzeichnisname `supabase/` ist ein historischer **Pfadname**
  und bedeutet nicht, dass Supabase noch benutzt wird.
- Für neue PostgreSQL-Instanzen liegt das getrennte Bootstrap-Verfahren als **drei versionierte
  Dateien** in `app/supabase/bootstrap/` vor (`01_roles.sql`, `02_compat_auth.sql`,
  `03_compat_storage.sql`); es bleibt bewusst **außerhalb** der nummerierten Migrationskette. Eine
  nachträglich vor `0001` eingefügte Migration `0000` ist ausdrücklich **verworfen**. Details in
  ADR-011, Abschnitt 2.10. Ausgeführt sind diese Dateien belegt **nur im CI-Prüflauf**; ein
  produktiver Bootstrap-Lauf hat **nicht** stattgefunden.
- Stage und Produktion verwenden **getrennte Datenbanken beziehungsweise Instanzen** mit eigenen
  Zugangsdaten.
- Die Anwendung verbindet sich mit einer eingeschränkten Rolle, die die Gruppenrolle `app_user`
  erbt — kein `SUPERUSER`, kein `BYPASSRLS`, kein Eigentum an den Tabellen.

## 10. Backup und Grenzen

```bash
scripts/db-backup.sh stage                  # Dump + SHA256 nach deploy/backups/stage
scripts/db-restore.sh stage <dumpdatei>     # destruktiv, mit ausgeschriebener Bestätigung
```

Der Datenbestand liegt seit der Supabase-Ablösung an **zwei** Orten:

| Bestand | Ort | Sicherung |
|---|---|---|
| Vorgänge, Stammdaten, Konten, Sitzungen, Audit | PostgreSQL, Volume `postgres-data` | `scripts/db-backup.sh` (`pg_dump`, Custom-Format, SHA256) |
| Bilddateien | MinIO, Volume `minio-data` | **existiert nicht** |

**Grenzen, die bekannt bleiben müssen:**

- Das vorhandene Skript sichert **ausschließlich PostgreSQL**. Für die Objektdaten gibt es
  **kein Sicherungsskript** in diesem Repository. Ein Dump ohne die zugehörigen Objekte ist keine
  vollständige Wiederherstellungsgrundlage.
- **Zeitliche Konsistenzgrenze — offene Betriebsentscheidung.** Datenbank und Objektspeicher werden
  unabhängig voneinander gesichert. Ein Wiederherstellungspunkt ist deshalb **nicht garantiert
  deckungsgleich**:
  - ein wiederhergestellter Metadatensatz kann auf ein Objekt zeigen, das im Objekt-Backup **noch
    fehlt** (Bild wird zur toten Referenz),
  - umgekehrt kann ein Objekt zurückkommen, zu dem **kein Metadatensatz** mehr existiert
    (verwaistes Objekt, das über die Anwendung niemand mehr sieht oder löscht).

  Wie damit umgegangen wird — Reihenfolge der Sicherung, akzeptierte Abweichung, Abgleichlauf nach
  einer Wiederherstellung, Umgang mit verwaisten Objekten — ist **noch nicht entschieden**
  (Abschnitt 13).
- Backupziel, Aufbewahrungsdauer, Verschlüsselung, Auslagerung und Verantwortlichkeit sind für
  **beide** Bestände **offen** (Abschnitt 13).
- Ein Recovery-Test hat **nicht** stattgefunden — weder für die Datenbank noch für die Objektdaten.

## 11. Rollback

- Anwendung: `scripts/rollback.sh stage` (ohne Argument: die von `deploy.sh` protokollierte
  Vorgängerversion) oder mit explizitem Digest.
- Datenbank: **kein Schema-Rollback.** Die Migrationskette ist nicht rückspielbar —
  `0013_ap14b_drop_supabase_compat.sql` entfernt den Supabase-Altpfad endgültig. Fehler werden per
  Forward-Fix behoben. Datenrückstellung nur über `db-restore.sh` aus einer Sicherung.
- Grenzfall: schlägt auch der Rollback fehl, bricht `deploy.sh` mit Protokoll ab und verlangt
  manuellen Eingriff — es wird nichts stillschweigend „repariert".

## 12. Sicherheit im Betrieb

| Maßnahme | Umsetzung |
|---|---|
| Kein Root im Container | `USER node`; Dateien gehören `root` → die Anwendung kann ihren Code nicht ändern |
| Rechteausweitung | `no-new-privileges:true`, `cap_drop: ALL` |
| Dateisystem | `read_only: true`, beschreibbar nur `/tmp` und `/app/.next/cache` (tmpfs) |
| Keine Secrets im Image | `.dockerignore` schließt `.env*`, `.git`, `e2e`, `supabase/test` aus; kein `ARG` für Geheimnisse; CI prüft `docker history` |
| Keine Alt-Variablen | die Webanwendung verwendet keinen Service-Role-Key. Sind `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` oder `NEXT_PUBLIC_SUPABASE_ANON_KEY` gesetzt, verweigert der Container den Start |
| Netz | ein internes Netz; keine veröffentlichten Ports — auch nicht für den Objektspeicher |
| Objektspeicher privat | privater Bucket, **keine anonyme Freigabe**, keine öffentliche ACL; das Entfernen einer anonymen Freigabe ist ein ausdrücklicher Schritt der IT-Provisionierung (Abschnitt 4) und wird vom Stack **nicht** erzwungen |
| Trennung der Zugangsdaten | die **Root-Zugangsdaten** des Objektspeichers sieht nur der Dienst `minio` (`env/minio.env`); der `app`-Dienst bekommt diese Datei nicht |
| Geringste Rechte im Objektspeicher | die Anwendungsidentität soll auf **einen** Bucket und **drei** Operationen begrenzt sein (`s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`) — kein Listing, keine Bucketverwaltung. Der Berechtigungstext ist versioniert (`deploy/minio/incident-images-app.policy.json`); dass er tatsächlich und ausschließlich so zugeordnet ist, ist bei der Provisionierung zu **verifizieren** |
| Bildzugriff | Lesen ausschließlich über **kurzlebige signierte GET-URLs** (Standard 1 h, `SIGNED_URL_TTL_SECONDS`); **kein presigned PUT im Browser** — Uploads laufen serverseitig |
| Secret-Rotation | Werte in `env/*.env` ändern → `docker compose up -d` (kein Neubau nötig); zusätzlich alle Sitzungen widerrufen. Für die Objektspeicher-Identität siehe Hinweis in `env/minio.env.example` — der Ablauf ist **nicht erprobt** |
| Zertifikate | vollständig bei HAProxy; kein Zertifikat im Stack |

**Prüf- und Betriebsnachweise:**

| Nachweis | Status |
|---|---|
| `docker build` erfolgreich | **GitHub-CI erfolgreich** (`30380208864`) |
| Container startet als `node`, nicht root | **GitHub-CI erfolgreich** |
| `/api/health` im Container erfolgreich | **offen** |
| Statische Assets, `sw.js`, `/manifest.webmanifest` erreichbar | **offen** |
| `read_only: true` ohne Funktionsverlust | **offen** — schreibbare Pfade sind nur abgeleitet |
| Healthcheck erkennt defekten App-Prozess | **offen** |
| Rollback auf vorherigen Tag | **offen** |
| Keine Secrets in `docker history` | **GitHub-CI erfolgreich** |
| `docker compose config` gültig (Stage **und** Produktion) | **in CI geprüft** — der Schritt „Compose-Modell validieren" im Job `container` legt `app.env`, `postgres.env` und `minio.env` aus den Vorlagen an, setzt `APP_IMAGE_REF` und `MINIO_IMAGE_REF` und ruft `docker compose config` für **beide** Overlays auf (`.github/workflows/ci.yml`). Ein grüner Lauf des Jobs `container` ist für Commit `a86d7a6` (CI-Lauf `30791223313`) **durch Codex berichtet und von Claude nicht selbst abgerufen**. Auf dem Arbeitsplatz weiterhin ungeprüft: dort gibt es keine Containerlaufzeit |
| `minio` startet und wird `healthy` (Healthcheck des **Compose-Dienstes**) | **offen** — der Job `objectstore` startet MinIO per `docker run` und wartet mit `curl` **vom Runner aus** auf `/minio/health/live`. Das Healthcheck-Kommando **innerhalb** des Compose-Dienstes bleibt eine unbestätigte Annahme, u. a. ob die gewählte Image-Variante `curl` enthält |
| Bucket, Policy und Identität existieren (IT-Provisionierung) | **offen** — manueller Schritt der internen IT (Abschnitt 4); der Stack legt nichts an und prüft nichts |
| Policy-Syntax vom Server akzeptiert | **in CI geprüft** — der Job `objectstore` in `.github/workflows/ci.yml` startet einen echten, digest-fest referenzierten MinIO-Container und wendet auf ihn die versionierte Datei `deploy/minio/incident-images-app.policy.json` an (nur gemountet, nicht neu erzeugt). Ein grüner Lauf ist für Commit `a86d7a6` (CI-Lauf `30791223313`) **durch Codex berichtet und von Claude nicht selbst abgerufen**. Im **Vault** ist dieser Job **nie gelaufen** — hier gibt es keine Containerlaufzeit. Kein Nachweis einer produktiven Umgebung |
| Anwendungsidentität kann genau die drei Operationen und sonst nichts | **in CI geprüft** — derselbe Job `objectstore` legt eine von der Root-Identität getrennte Anwendungsidentität an, ordnet ihr genau diese eine Policy zu, prüft die Zuordnung fail-closed und führt den Produktivcode (`app/src/lib/minio-storage.ts` über das echte AWS SDK v3) gegen den Container aus; ein zweiter Bucket dient als Gegenprobe der Rechtebegrenzung. Grüner Lauf wie in der Zeile darüber — **durch Codex berichtet, von Claude nicht selbst abgerufen**. Der Nachweis läuft gegen einen CI-eigenen MinIO auf Loopback mit synthetischen Zugangsdaten und **ohne** gesetzte `AUTH_URL`; er belegt Policy und Rechtebegrenzung, **nicht** die Same-Origin-Route unter einem echten Origin. Die Verifikationspflicht bei der Provisionierung (Abschnitt 4) bleibt unberührt |
| Signierte GET-URL im Browser erreichbar (Proxy-Route, Same-Origin) | **offen** — hängt an der Proxyfreigabe der internen IT |
| ESLint, TypeScript, normaler Build und Standalone-Build | **lokal erfolgreich** (2026-07-28) |
| Öffentliche Browser-/Accessibility-Tests | **lokal 11/11 erfolgreich** (2026-07-28) |
| Startvalidierung ohne/gültige/verbotene Konfiguration | **lokal erfolgreich** (Exit 78/0/78, 2026-07-28) |

## 13. Offene Infrastrukturentscheidungen

1. Zielserver: Distribution, Version, Architektur (`amd64` angenommen), CPU, RAM, Speicher
2. Installationspfad und ausführender Benutzer; Docker ohne `sudo`
3. Domain beziehungsweise Subdomain, DNS-Stand
4. Bemessung des Datenbankvolumes **und** des Objektvolumes für die Bilder
5. Logaufbewahrung und Benachrichtigungsweg bei Fehlern
6. Backupziel, Verantwortlichkeit, Recovery-Ziel (RPO/RTO) für Datenbank **und** Objektspeicher,
   einschließlich des Umgangs mit der Konsistenzgrenze aus Abschnitt 10
7. Multi-Arch-Build (nur nach Bestätigung der Serverarchitektur)
8. Digest-Pinnung der Basisimages und der eingesetzten GitHub-Actions
9. **Image-Referenz des Objektspeichers**: `MINIO_IMAGE_REF` hat bewusst keinen Standardwert. Welche
   Version eingesetzt und freigegeben wird, entscheidet die interne IT; im Vault konnte keine
   Referenz verifiziert werden. `MINIO_CLIENT_IMAGE_REF` ist mit dem Bootstrap-Dienst **entfallen**.
10. **Proxyfreigabe für die Bucket-Route** (Abschnitt 5): gemeinsamer Origin für `AUTH_URL` und
    `S3_PUBLIC_BASE_URL`, Weiterleitung des Bucket-Pfads auf den privaten `minio`-Dienst,
    unveränderte Weitergabe von Pfad, Query und Host. Solange diese Freigabe fehlt, bleiben Bilder
    im Browser unerreichbar.
11. Sicherungsverfahren für die Objektdaten: ein Skript dafür existiert **nicht**.
12. **Durchführung und Nachweis der MinIO-Provisionierung** (Abschnitt 4): wer sie ausführt, wann sie
    je Umgebung erfolgt ist und wie das Ergebnis der Verifikation festgehalten wird, ist noch nicht
    festgelegt.

Solange diese Punkte offen sind, enthalten die Vorlagen ausschließlich dokumentierte Platzhalter. Es
wurde keine Verbindung zu einer realen Umgebung hergestellt.

**Zusätzlich offen — Nachweis statt Erfolg:** **auf dem Arbeitsplatz** wurde `minio` nie gestartet
und `docker compose config` nie ausgeführt, weil dort keine Containerlaufzeit vorhanden ist. In der
CI ist beides abgedeckt: `docker compose config` für Stage und Produktion im Job `container`, ein
echter MinIO-Container samt versioniertem Policy-Text im Job `objectstore` (Abschnitt 12).
**Unbestätigt bleibt das Healthcheck-Kommando des Compose-Dienstes `minio`**, weil die CI den
Server per `docker run` startet und nicht über den Compose-Stack. Ebenfalls offen bleiben die
produktive MinIO-Provisionierung, das Sicherungs- und Wiederherstellungsverfahren für die
Objektdaten und die Endpunkte der internen IT; der erste echte Lauf in Stage oder Produktion hat
das zu prüfen.

## 14. Hinweis zum Arbeitsstand des Repositories

Zum Zeitpunkt dieser Erstellung liegen im Vault **elf nicht committete Änderungen**, darunter sechs
Branding-Dateien (`globals.css`, `layout.tsx`, `login/page.tsx`, `manifest.ts`, `Logo.tsx`,
`ServiceWorkerRegister.tsx`). Diese Dateien wurden von Arbeitspaket A **nicht angefasst**, damit
Branding und Infrastruktur nicht in denselben Commit geraten. Eine Sicherung liegt unter
`C:\Backup\Arbeitsstand_vor_AP14_<Zeitstempel>` und `<Vault>\Backup\Arbeitsstand_vor_AP14_<Zeitstempel>`
mit SHA256-Manifest.

## Freigabe

- [ ] Freigabe zur Ausgabe als PDF/Word/Excel

Freigegeben von: —
Freigabedatum: —
