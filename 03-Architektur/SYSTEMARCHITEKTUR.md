# Systemarchitektur
> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1

## Überblick
Single-Page-taugliche, serverseitig gerenderte Webanwendung auf Basis von **Next.js 16 (App Router)**.
Datenhaltung, Authentifizierung und Dateiablage über **Supabase** (PostgreSQL, Auth, Storage).
Autorisierung primär in der Datenbank über **Row Level Security (RLS)**.

```
Browser (responsive UI)
   │  HTTPS
Next.js (App Router)
   ├─ Server Components / Server Actions / Route Handler
   ├─ Proxy/Middleware: Session-Refresh + Routen-Schutz
   └─ @supabase/ssr (Cookie-basierte Session)
        │
Supabase
   ├─ Auth (E-Mail/Passwort, JWT)
   ├─ PostgreSQL (Datenmodell + RLS + Trigger)
   └─ Storage (privater Bucket incident-images)
```

## Schichten
- **UI**: `src/app` (Seiten), `src/components` (Header, Navigation, Logo, Platzhalter). Tailwind CSS.
- **Anwendungslogik (Server)**: Server Components lesen Daten mit dem Server-Supabase-Client;
  Mutationen über Server Actions / Route Handler. Rollenprüfung via `src/lib/auth.ts`.
- **Datenzugriff**: `@supabase/ssr` – getrennte Clients für Browser (`client.ts`),
  Server (`server.ts`) und Middleware (`middleware.ts`).
- **Datenbank**: PostgreSQL-Schema als Migration (`app/supabase/migrations`). RLS + Trigger
  setzen fachliche Regeln durch (Sichtbarkeit, Unveränderbarkeit, Bestandsschutz).

## Routing / Seiten
- Öffentlich: `/login`, `/auth/signout`.
- Geschützt (Route-Gruppe `(app)`, `force-dynamic`): `/dashboard`, `/vorgaenge`, `/vorgaenge/neu`,
  `/meine-einsaetze`, `/material`, `/lager`, `/benutzer`, `/export`.
- Nicht angemeldete Zugriffe auf geschützte Routen → Redirect auf `/login` (Middleware + Layout).

## Session & Schutz
- Middleware (`src/middleware.ts`) frischt bei jedem Request die Supabase-Session auf und
  blockt nicht-öffentliche Routen ohne gültige Session.
- Das geschützte Layout lädt zusätzlich Profil + Rolle serverseitig (`requireSession`) und
  reicht sie an Header/Navigation. Jede rollenspezifische Seite prüft die Rolle erneut.

## Umgebung / Konfiguration
- Konfiguration ausschließlich über Env-Variablen (`.env.local`, nicht im Repo).
- Ohne Konfiguration bleibt die App lauffähig (Login zeigt Hinweis); es werden Platzhalterwerte
  verwendet, echte Netzwerkaufrufe scheitern bewusst.

## Nicht enthalten (bewusst)
Keine Navigation/Routenberechnung, kein Live-GPS-Tracking, kein Offlinebetrieb, keine
Push-/E-Mail-Automatisierung – siehe MVP-Abgrenzung.
