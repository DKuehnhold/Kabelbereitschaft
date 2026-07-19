# Kabelbereitschaft – Webanwendung (Next.js)

Responsive Webanwendung für die Kabelbereitschaft (Bereich Deutsche Bahn):
Erfassung von Bereitschaftsvorgängen, Monteurzuweisung, technische Dokumentation,
Bild-/EXIF-Auswertung, Material- und Lagerverwaltung, CSV-Export.

## Stack
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL, Auth, Storage, RLS).

## Lokale Ausführung
1. `cp .env.example .env.local` und Supabase-URL + Anon-Key eintragen.
2. `npm install`
3. Migrationen im Supabase-Projekt anwenden (siehe `supabase/README.md`).
4. `npm run dev` → http://localhost:3000

## Skripte
- `npm run dev` – Entwicklungsserver
- `npm run build` / `npm run start` – Produktion
- `npm run lint` – ESLint
- `npm run typecheck` – TypeScript-Prüfung

## Struktur
- `src/app` – Seiten (Login, geschützter Bereich `(app)`), Server-Actions, Route-Handler
- `src/components` – UI (Header, Navigation, Logo, Platzhalter)
- `src/lib` – Supabase-Clients, Auth, Rollen/Status, EXIF-Hilfsfunktion, DB-Typen
- `supabase/` – SQL-Migrationen, Seed, lokale Testskripte
- `public/branding/` – Firmenlogo (Platzhalter)

Ausführliche Doku: siehe Vault-Ordner `00`–`07` eine Ebene höher.
