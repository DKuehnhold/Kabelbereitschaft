# Deployment

> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1
>
> **⚠️ TEILWEISE ÜBERHOLT (Kennzeichnung 2026-07-28, AP14/A11).**
> Die unten beschriebene Zielplattform **Vercel + Supabase Cloud** ist durch die Zielentscheidung
> vom 2026-07-28 abgelöst: Stage und Produktion laufen als **Docker-Compose-Stack mit
> ausschließlich PostgreSQL**, TLS und Rate Limiting über **HAProxy**.
> Führend für den Containerbetrieb ist `deploy/README.md`; die Zielarchitektur steht in
> `00-Projektsteuerung/ADR-011-postgres-eigenplattform.md` (Status: Entwurf).
> Ebenfalls überholt: die Nennung von `SUPABASE_SERVICE_ROLE_KEY` als Deploymentvariable — die
> Webanwendung verwendet keinen Service-Role-Key.
> Weiterhin gültig: die Trennung App/Doku, die Migrationsreihenfolge, die Deployment-Checkliste
> und der Rollback-Grundsatz (additive Migrationen, Forward-Fix).
> Dieser Abschnitt bleibt als historischer Stand erhalten und wird in AP14 fachlich neu geschrieben.

## Überblick

Der App-Code liegt im Unterordner `app` des Vaults; die Dokumentation liegt im Vault-Root (Ordner 00–99). Deployment: Git-Repository → Vercel (Next.js) mit Supabase als Backend.

## Trennung App / Doku

```
Kabelbereitschaft-App/        (Vault-Root, Obsidian)
├── 00-…99-…                  Projektdokumentation (Markdown)
└── app/                      Next.js-Anwendung (deploybar)
    ├── public/branding/      Firmenlogo (SVG/PNG)
    └── supabase/migrations/  DB-Migrationen (versioniert)
```

Nur der Ordner `app` wird deployt. Die Doku ist nicht Teil des Build/Deploy.

## Deploymentfluss

1. **Repository** – Code inkl. `app` und Migrationen nach Git pushen.
2. **Vercel-Projekt** – mit dem Repo verbinden; Root/Projektverzeichnis auf `app` setzen.
3. **Env-Setup** – Umgebungsvariablen in Vercel hinterlegen (siehe `07-Betrieb/HOSTING.md`), keine Secrets im Repo.
4. **Supabase-Projekt** – Projekt anlegen (EU-Region), Auth und privaten Storage-Bucket einrichten.
5. **Migration** – Schema per `supabase db push` bzw. `supabase migration up` einspielen; Seed für Rollen/Stammdaten ausführen.
6. **Build/Deploy** – Vercel baut (`npm run build`) und deployt automatisch bei Push.

## Env-Setup (Kurz)

| Variable | Ort |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | nur serverseitig (Vercel), geheim |

Vorlage: `app/.env.example` (ohne echte Werte).

## Lokale Entwicklung

```
cd app
npm install
npm run dev
```

Vorher `.env.local` aus `.env.example` erstellen und mit Supabase-Werten füllen. Migrationen lokal gegen eine Postgres-/Supabase-Instanz anwenden und testen, bevor sie produktiv gepusht werden.

## AP7 – Deployment-Readiness & Checkliste
- **Voraussetzungen:** Node 22; Umgebungsvariablen (`NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, optional
  `NEXT_PUBLIC_MAX_IMAGE_MB`, `NEXT_PUBLIC_APP_VERSION`); Supabase-Projekt mit Bucket `incident-images`.
- **Checkliste:** Build grün · Migrationen 0001–0006 angewendet · RLS aktiv · Storage-Bucket privat ·
  HTTPS + Auth-Redirect-URLs · Service Worker erreichbar (`/sw.js`) · Header/CSP geprüft · CORS (Supabase) ·
  Health-Check (`/api/health`) · Logging/Monitoring aktiv · Rollback-Pfad bereit.
- **Migrationen im Deployment:** Reihenfolge `0001`→`0006`; Vorabprüfung + Backup vor Anwendung;
  Verifikation via Smokes; Fehlerfall → Forward-Fix bevorzugt (additive Migrationen; kein destruktives Rollback).
  Bewertung je Migration: additiv, idempotent (soweit vorgesehen), geringes Sperr-/Datenvolumen-Risiko.
- **Rollback:** App-Deploy auf vorherigen Tag; DB additiv → i. d. R. vorwärtskompatibel; Storage unverändert.
- **Plattform:** noch nicht endgültig festgelegt; keine spekulative Voraussetzung. (Falls Vercel gemäß
  bestehender Doku: entsprechende Env/Domain/Callback-Konfiguration verwenden.)
