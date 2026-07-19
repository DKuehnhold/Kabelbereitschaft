# Projektstruktur
> Stand: 2026-07-19 · MVP V0.1

```
Kabelbereitschaft-App/            (Obsidian-Vault = Projektordner)
├─ 00-Projektsteuerung/           Status, Entscheidungen, offene Punkte, Changelog
├─ 01-Anforderungen/              Zielbild, MVP-Umfang, Rollen, Statusmodell, Akzeptanz
├─ 02-Fachkonzept/                Vorgang, Bild/EXIF, Lager/Material, CSV-Export
├─ 03-Architektur/                Systemarchitektur, Datenmodell, Sicherheit, Deployment
├─ 04-UI-UX/                      Navigation/Seiten, Disposition, Monteur, Lager, Branding
├─ 05-Umsetzung-Claude/           Bericht AP1, Setup, Projektstruktur (dieses Dokument)
├─ 06-Tests/                      Testplan, Testfälle, Abnahme
├─ 07-Betrieb/                    Hosting, Backup, Benutzerverwaltung, Datenschutz
├─ 99-Anlagen/
└─ app/                           Next.js-Anwendung
   ├─ src/
   │  ├─ app/                     Seiten, Server-Actions, Route-Handler
   │  │  ├─ login/                Login (Seite + Action)
   │  │  ├─ auth/signout/         Abmelde-Route
   │  │  └─ (app)/                geschützter Bereich (Dashboard, Vorgänge, Material, …)
   │  ├─ components/              AppHeader, NavLinks, Logo, Placeholder
   │  ├─ lib/                     supabase/*, auth, roles, status, exif, database.types
   │  └─ middleware.ts            Session-Refresh + Routen-Schutz
   ├─ public/branding/            Firmenlogo (Platzhalter) + README
   └─ supabase/                   migrations/, seed.sql, test/, README
```

`node_modules/` und `.next/` werden nicht versioniert (siehe `.gitignore`).
