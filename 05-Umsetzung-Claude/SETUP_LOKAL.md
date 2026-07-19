# Lokales Setup
> Stand: 2026-07-19 · MVP V0.1

## Voraussetzungen
- Node.js 20+ (getestet mit Node 22), npm.
- Ein Supabase-Projekt (für Login/Datenbank). Ohne Projekt startet die App, Login ist deaktiviert.

## Schritte
```bash
cd app
cp .env.example .env.local        # URL + Anon-Key des Supabase-Projekts eintragen
npm install
npm run dev                       # http://localhost:3000
```

## Datenbank einrichten
1. Supabase-Projekt öffnen → SQL-Editor.
2. `app/supabase/migrations/0001_init.sql` ausführen.
3. `app/supabase/migrations/0002_storage.sql` ausführen.
4. Optional `app/supabase/seed.sql` für Beispiel-Stammdaten.
5. Unter **Authentication** einen Benutzer anlegen; danach:
   `update public.profiles set role='admin' where id='<uuid>';`

## Qualitätsprüfungen
```bash
npm run lint
npm run typecheck
npm run build
```

## Hinweise
- Keine echten Zugangsdaten committen. `.env.local` ist über `.gitignore` ausgeschlossen.
- `app/supabase/test/*` nur für lokale DB-Prüfung – nicht in Supabase ausführen.
