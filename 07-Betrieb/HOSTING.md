# Hosting

> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1

## Zielarchitektur

| Komponente | Empfehlung |
| --- | --- |
| Frontend/Backend (Next.js 15) | Vercel |
| Datenbank / Auth / Storage | Supabase Cloud (managed PostgreSQL, Auth, Storage) |

Vercel hostet die Next.js-Anwendung (App Router, Server-Komponenten, serverseitige EXIF-Auswertung). Supabase liefert die managed Postgres-DB, Authentifizierung und den privaten Storage-Bucket.

## Environment-Variablen

Werden in Vercel (Projekt-Settings) und lokal als `.env.local` gepflegt – **nie im Repo**. Vorlage: `app/.env.example`.

| Variable | Zweck |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase-Projekt-URL (öffentlich) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon-Key für Client (öffentlich, durch RLS geschützt) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-Role-Key nur serverseitig (geheim) |

Der Service-Role-Key darf ausschließlich serverseitig verwendet werden und niemals an den Client gelangen.

## Grundsatz Secrets

- Keine Secrets im Repository. Nur `.env.example` mit Platzhaltern wird versioniert.
- Produktive Werte liegen in Vercel-Umgebungsvariablen bzw. lokal in `.env.local` (per `.gitignore` ausgeschlossen).

## Lokale Ausführung

```
cd app
npm install
npm run dev
```

Zuvor `.env.local` aus `.env.example` erstellen und mit den Supabase-Werten befüllen.
