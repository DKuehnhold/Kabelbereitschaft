# PWA – Progressive Web App (AP5)
> Stand: 2026-07-19

## Manifest & Installierbarkeit
- `app/manifest.ts` (Next Metadata-Route) → `/manifest.webmanifest`.
- `name`, `short_name`, `description`, `start_url: /dashboard`, `scope: /`,
  `display: standalone`, `theme_color: #1e3a8a`, `background_color: #f8fafc`, `lang: de`.
- Icons: `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (maskable),
  `apple-touch-icon.png` (180). Root-Layout setzt `manifest`, `themeColor` (viewport),
  `appleWebApp` und Icons.
- Registrierung des Service Workers app-weit über `ServiceWorkerRegister` (im Root-Layout).

## Service Worker (`public/sw.js`)
Ohne Third-Party-Libs (Next.js bietet keinen eingebauten SW-Generator; handgeschriebener SW
ist der von Next dokumentierte Weg).

Cache-Strategien:
- **Navigationen** (GET/HTML): network-first → Cache → `/offline` (Fallback).
- **Statische Assets** (`/_next/static`, `/icons`, `/branding`, Bilder, css/js/fonts):
  stale-while-revalidate.
- **Precache** (App-Shell): `/offline`, `/manifest.webmanifest`, App-Icons.

Cache-Invalidierung: `CACHE_VERSION` (`kb-v1`); bei `activate` werden Caches ohne aktuelle
Version gelöscht; `skipWaiting` + `clients.claim` für zügige Aktivierung. `message: "SKIP_WAITING"`
erlaubt sofortiges Update.

Sicherheit: Es werden ausschließlich **Same-Origin-GET**-Antworten gecacht. `/api/*`, `/auth/*`
und Cross-Origin (Supabase) werden **nie** gecacht → keine Tokens/Session/Antwortdaten im Cache.

## Öffentliche Routen
Damit PWA-Ressourcen ohne Session/offline laden: `/sw.js`, `/manifest.webmanifest`, `/offline`,
`/icons/*` sind in `middleware`-Matcher bzw. `PUBLIC_PREFIXES` freigegeben.

## Grenzen / Browser-QA
Installations-Prompt, SW-Registrierung/-Update und Cache-Invalidierung sind manuell im Browser
abzunehmen (in der Build-Umgebung ohne Browser nicht ausführbar).
