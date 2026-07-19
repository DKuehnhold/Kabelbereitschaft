# Deployment

> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1

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
