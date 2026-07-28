# Containerbetrieb – Kabelbereitschaft

> Stand: 2026-07-28 · AP14 / Arbeitspaket A · **Entwurf, nicht freigegeben**

## 0. Statuswarnung — bitte zuerst lesen

**Dieser Stack ist NICHT produktionsfähig.**

1. Die Anwendung nutzt in diesem Stand weiterhin Supabase für Authentifizierung, Datenzugriff und
   Bildspeicher. Der `postgres`-Dienst im Stack ist vorbereitet, wird von der Anwendung aber **noch
   nicht verwendet**. Betriebsfähig wird der Stack erst nach Abschluss von **Arbeitspaket B**
   (Supabase-Ablösung, siehe `../00-Projektsteuerung/ADR-011-postgres-eigenplattform.md`).
2. **V1 (Aufbewahrungsfristen für Personen-, EXIF-/GPS- und Auditdaten) ist offen und wirkt als
   Produktionssperre.** Bis zur Entscheidung durch Dennis führen Stage und Test ausschließlich
   synthetische Daten; produktiver Datenanfall ist gesperrt.
3. Es hat **kein Containerlauf** stattgefunden. Alle Angaben in diesem Dokument sind aus den
   Konfigurationsdateien abgeleitet, nicht aus einem Betriebsnachweis. Die offenen Nachweise stehen
   in Abschnitt 12.

## 1. Zielarchitektur

```
Unternehmens-Gateway
        │
   HAProxy  (TLS-Terminierung, HTTP→HTTPS, Rate Limiting, X-Forwarded-*)
        │  intern, unverschlüsselt
   app   (Next.js 16.2.12, Node 22, non-root, :3000, nur "expose")
        │
   postgres  (18, nur internes Netz, persistentes Volume)
```

Der Reverse Proxy ist **HAProxy** und liegt außerhalb dieses Stacks. Deshalb:

- kein Proxy-Container,
- **kein veröffentlichter Port** — weder für die Anwendung noch für die Datenbank,
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
| Speicher | Datenbankvolume; Bemessung offen (siehe Abschnitt 13) |

## 3. Verzeichnisstruktur

```
deploy/
├── compose.yml                 Basis-Stack (app, postgres)
├── compose.stage.yml           Overlay Stage
├── compose.production.yml      Overlay Produktion
├── env/
│   ├── app.env.example         Vorlage – Platzhalter
│   ├── postgres.env.example    Vorlage – Platzhalter
│   └── .gitignore              echte *.env werden nie versioniert
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
chmod 600 env/app.env env/postgres.env
$EDITOR env/app.env env/postgres.env

# 3. An der Registry anmelden (Personal Access Token mit read:packages)
docker login ghcr.io

# 4. Konfiguration prüfen, ohne etwas zu starten
#    APP_IMAGE_REF enthält immer die vollständige Referenz (Tag ODER Digest),
#    weil ein Digest mit "@" und ein Tag mit ":" angehängt wird.
export APP_IMAGE_REF=ghcr.io/dkuehnhold/kabelbereitschaft@sha256:<digest>
docker compose -f compose.yml -f compose.stage.yml config

# 5. Starten
scripts/deploy.sh stage ghcr.io/dkuehnhold/kabelbereitschaft@sha256:<digest>
```

Die Datenbank ist nach dem Start **leer**. Migrationen werden bewusst **nicht** automatisch
angewendet — siehe Abschnitt 9.

## 5. Konfiguration

Alle Werte kommen aus `deploy/env/*.env` auf dem Server. **Keine Secrets im Repository, keine Secrets
in `compose.yml`, keine Secrets als Kommandozeilenargument.**

Fehlt eine Pflichtvariable, bricht der Container beim Start mit **Exit-Code 78** und einer klaren
Meldung ab, die ausschließlich Variablennamen nennt (`app/docker/verify-runtime-config.mjs`). Ein
stiller Start mit Platzhaltern ist nicht mehr möglich.

### Build- und Laufzeitvariablen

Next.js unterscheidet hart:

- **`NEXT_PUBLIC_*` wird zur Buildzeit in die Client-Bundles eingebrannt.** Solange die Anwendung
  `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` benötigt, ist ein Image
  **umgebungsspezifisch**. Die Promotion eines unveränderten Digests von Stage nach Produktion ist
  damit **noch nicht möglich**.
- **Serverseitig gelesene Variablen** (`APP_VERSION`, `PORT`, `HOSTNAME`) sind zur Laufzeit setzbar.

Analyse zur geplanten Runtime-Konfiguration (Auftrag Dennis, Punkt 5):

| Variable | Heute | Nach Arbeitspaket B |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Buildzeit, umgebungsspezifisch | **entfällt** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Buildzeit, umgebungsspezifisch | **entfällt** |
| `NEXT_PUBLIC_MAX_IMAGE_MB` | Buildzeit, Client-Anzeige | bleibt, aber **umgebungsunabhängig** (Standard 15) |
| `NEXT_PUBLIC_APP_VERSION` | war Buildzeit | ersetzt durch `APP_VERSION`, serverseitig, Laufzeit |

**Ergebnis:** nach der Supabase-Ablösung bleibt voraussichtlich **kein einziger öffentlicher,
umgebungsspezifischer Wert** übrig. Der vorgesehene JSON-Konfigurationsblock im Layout wurde deshalb
**bewusst nicht gebaut** — er wäre eine Struktur, die in Arbeitspaket B wieder entfernt würde. Statt
Verschieben wurde ersetzt (`APP_VERSION`) beziehungsweise als umgebungsunabhängig eingeordnet
(`NEXT_PUBLIC_MAX_IMAGE_MB`). Sollte in B doch ein öffentlicher, umgebungsabhängiger Wert entstehen,
wird der Block nach der freigegebenen Vorgabe nachgezogen (serverseitig gelesen, sicher
JSON-serialisiert, nicht ausführbar, typisierte Zugriffsfunktion, CSP unverändert).

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
```

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

- **Die CI führt keine Migrationen aus. Der Containerstart führt keine Migrationen aus.**
  Produktionsmigrationen erfolgen ausschließlich nach manueller Freigabe durch Dennis.
- Bestand: `app/supabase/migrations/0001…0011`, additiv und idempotent, **unverändert**.
- Für neue PostgreSQL-Instanzen ist ein getrenntes Bootstrap-Verfahren vorgesehen; eine nachträglich
  vor `0001` eingefügte Migration `0000` ist ausdrücklich **verworfen**. Details in ADR-011,
  Abschnitt 2.10.
- Stage und Produktion verwenden **getrennte Datenbanken beziehungsweise Instanzen** mit eigenen
  Zugangsdaten.
- Die Anwendung wird sich ab Arbeitspaket B mit der eingeschränkten Rolle `app_user` verbinden — kein
  `SUPERUSER`, kein `BYPASSRLS`.

## 10. Backup und Grenzen

```bash
scripts/db-backup.sh stage                  # Dump + SHA256 nach deploy/backups/stage
scripts/db-restore.sh stage <dumpdatei>     # destruktiv, mit ausgeschriebener Bestätigung
```

**Grenzen, die bekannt bleiben müssen:**

- Das Skript sichert **ausschließlich PostgreSQL**. Bilder liegen ab Arbeitspaket B in MinIO und
  benötigen eine eigene, zeitlich abgestimmte Sicherung. Ein Dump ohne die zugehörigen Objekte ist
  keine vollständige Wiederherstellungsgrundlage.
- Backupziel, Aufbewahrungsdauer, Verschlüsselung, Auslagerung und Verantwortlichkeit sind **offen**
  (Abschnitt 13).
- Ein Recovery-Test hat **nicht** stattgefunden.

## 11. Rollback

- Anwendung: `scripts/rollback.sh stage` (ohne Argument: die von `deploy.sh` protokollierte
  Vorgängerversion) oder mit explizitem Digest.
- Datenbank: **kein Schema-Rollback.** Die Migrationen sind additiv; Fehler werden per Forward-Fix
  behoben. Datenrückstellung nur über `db-restore.sh` aus einer Sicherung.
- Grenzfall: schlägt auch der Rollback fehl, bricht `deploy.sh` mit Protokoll ab und verlangt
  manuellen Eingriff — es wird nichts stillschweigend „repariert".

## 12. Sicherheit im Betrieb

| Maßnahme | Umsetzung |
|---|---|
| Kein Root im Container | `USER node`; Dateien gehören `root` → die Anwendung kann ihren Code nicht ändern |
| Rechteausweitung | `no-new-privileges:true`, `cap_drop: ALL` |
| Dateisystem | `read_only: true`, beschreibbar nur `/tmp` und `/app/.next/cache` (tmpfs) |
| Keine Secrets im Image | `.dockerignore` schließt `.env*`, `.git`, `e2e`, `supabase/test` aus; kein `ARG` für Geheimnisse; CI prüft `docker history` |
| Kein Service-Role-Key | die Webanwendung verwendet keinen; ist `SUPABASE_SERVICE_ROLE_KEY` gesetzt, verweigert der Container den Start |
| Netz | ein internes Netz; keine veröffentlichten Ports |
| Secret-Rotation | Werte in `env/*.env` ändern → `docker compose up -d` (kein Neubau nötig, solange keine `NEXT_PUBLIC_*` betroffen sind); ab B zusätzlich alle Sitzungen widerrufen |
| Zertifikate | vollständig bei HAProxy; kein Zertifikat im Stack |

**Prüf- und Betriebsnachweise:**

| Nachweis | Status |
|---|---|
| `docker build` erfolgreich | **offen** — in dieser Sitzung nicht ausführbar (kein Docker) |
| Container startet als `node`, nicht root | **offen** |
| `/api/health` im Container erfolgreich | **offen** |
| Statische Assets, `sw.js`, `/manifest.webmanifest` erreichbar | **offen** |
| `read_only: true` ohne Funktionsverlust | **offen** — schreibbare Pfade sind nur abgeleitet |
| Healthcheck erkennt defekten App-Prozess | **offen** |
| Rollback auf vorherigen Tag | **offen** |
| Keine Secrets in `docker history` | in CI vorgesehen, **lokal nicht geprüft** |
| `docker compose config` gültig | in CI vorgesehen, **lokal nicht geprüft** |
| ESLint, TypeScript, normaler Build und Standalone-Build | **lokal erfolgreich** (2026-07-28) |
| Öffentliche Browser-/Accessibility-Tests | **lokal 11/11 erfolgreich** (2026-07-28) |
| Startvalidierung ohne/gültige/verbotene Konfiguration | **lokal erfolgreich** (Exit 78/0/78, 2026-07-28) |

## 13. Offene Infrastrukturentscheidungen

1. Zielserver: Distribution, Version, Architektur (`amd64` angenommen), CPU, RAM, Speicher
2. Installationspfad und ausführender Benutzer; Docker ohne `sudo`
3. Domain beziehungsweise Subdomain, DNS-Stand
4. Bemessung des Datenbankvolumes
5. Logaufbewahrung und Benachrichtigungsweg bei Fehlern
6. Backupziel, Verantwortlichkeit, Recovery-Ziel (RPO/RTO)
7. Multi-Arch-Build (nur nach Bestätigung der Serverarchitektur)
8. Digest-Pinnung der Basisimages und der eingesetzten GitHub-Actions

Solange diese Punkte offen sind, enthalten die Vorlagen ausschließlich dokumentierte Platzhalter. Es
wurde keine Verbindung zu einer realen Umgebung hergestellt.

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
