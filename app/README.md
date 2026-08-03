# Kabelbereitschaft – Webanwendung (Next.js)

Responsive Webanwendung für die Kabelbereitschaft (Bereich Deutsche Bahn):
Erfassung von Bereitschaftsvorgängen, Monteurzuweisung, technische Dokumentation,
Bild-/EXIF-Auswertung, Material- und Lagerverwaltung, CSV-Export.

## Stack
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL 18 mit RLS ·
Auth.js v5 · MinIO/S3-Objektspeicher.

Hinweis: „Auth.js v5" ist nach ADR-011 die Zielbezeichnung; als Abhängigkeit liegt derzeit
`next-auth` in einer Vorabversion (`5.0.0-beta.*`) vor.

## Lokale Ausführung
1. `cp .env.example .env.local` und die Variablennamen mit lokalen bzw. synthetischen
   Testwerten belegen: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` sowie die fünf
   Pflichtnamen `S3_ENDPOINT`, `S3_PUBLIC_BASE_URL`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`,
   `S3_SECRET_ACCESS_KEY`. **Keine Supabase-URL und keinen Anon-Key eintragen** –
   `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` und
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` sind verbotene Namen; ihr Vorhandensein bricht den
   Containerstart mit Exit-Code 78 ab (ebenso eine fehlende Pflichtvariable).
   Hinweis zur Lücke: `AUTH_URL` ist im Containerbetrieb Pflicht, steht in
   `.env.example` aber nur als Prosaverweis und nicht als eigene Variablenzeile.
2. `npm install`
3. Schema über die dokumentierte Kette gegen eine **Testdatenbank** anwenden
   (siehe `supabase/README.md`).
4. Ersten Administrator über `scripts/bootstrap-admin.mjs` anlegen.
5. `npm run dev` → http://localhost:3000

## Skripte
- `npm run dev` – Entwicklungsserver (`next dev`)
- `npm run build` / `npm run start` – Produktionsbuild bzw. -start
- `npm run lint` – ESLint
- `npm run typecheck` – TypeScript-Prüfung (`tsc --noEmit`)
- `npm run test:unit` – Node-Testrunner über `test/*.test.mjs`
- `npm test` – `tsc --noEmit` + ESLint + `test:unit`
- `npm run test:e2e` – Playwright; zusätzlich `test:e2e:headed`, `test:e2e:debug`

## Struktur
- `src/app` – Seiten (Login, geschützter Bereich `(app)`), Server-Actions, Route-Handler
- `src/components` – UI (Header, Navigation, Logo, Platzhalter)
- `src/lib` – Datenbankzugriff (`src/lib/db`), Auth.js-Sitzungen, MinIO/S3-Zugriff,
  Rollen/Status, EXIF-Hilfsfunktion, DB-Typen
- `supabase/` – SQL-Migrationen, Bootstrap, Seed, Testkette. Der Verzeichnisname ist ein
  **historischer Pfadname** und bedeutet nicht, dass Supabase noch Ziel ist.
- `public/branding/` – Firmenlogo (Platzhalter)

Ausführliche Doku: siehe Vault-Ordner `00`–`07` eine Ebene höher.

> Stand: 2026-08-03 (Plattformrichtigstellung, AP15).
