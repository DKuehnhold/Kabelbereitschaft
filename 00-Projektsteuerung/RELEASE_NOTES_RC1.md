# Release Notes – v1.0.0-rc.1 (Entwurf)
> Stand: 2026-07-19 · Release Candidate. Tag/Release erst nach ausdrücklicher Nutzerfreigabe.

## Umfang (AP1–AP7)
- **Vorgangsverwaltung** mit Rollen (Administrator/Disposition/Monteur), RLS, Audit, unveränderbarer Chronik/Timeline, Priorität, Filter, Dashboard.
- **Material-/Lagerverwaltung** mit Beständen, Bewegungen, Entnahme/Rückgabe/Verbrauch, Historie, Mindestbestandskennzahl.
- **Bilddokumentation**: privater Upload (JPG/PNG, signierte URLs), EXIF/GPS, Galerie/Großansicht, Kategorie/Beschreibung, Soft-Delete.
- **CSV-Export** der Vorgangsübersicht (UTF-8+BOM, Semikolon, Formel-Injektionsschutz), filterbezogen.
- **PWA & Offline**: Manifest/Icons/Service Worker, Offline-Cache, Outbox, Upload-Warteschlange, Synchronisation, Konflikterkennung/-auflösung, Idempotenz.
- **Release-Härtung (AP7)**: Sicherheitsheader, Health-Check, a11y-Tests, CI-Gates, Betriebs-/Release-Dokumentation.

## Bekannte Einschränkungen / offene Punkte
- Push von AP4–AP7 nach GitHub steht aus (Zugangsdaten).
- Vollständige Browser-E2E, `@app`-E2E, PWA-Installations-/SW-Update-Runtime, Recovery-/Deployment-Test: benötigen Browser-Systembibliotheken, Test-Supabase bzw. Zielinfrastruktur.
- CSP aktuell Report-Only (Browser-Verifikation vor Umstellung auf durchsetzend).
- postcss (moderate, build-time via Next) – Behebung mit Next-Update.
- Middleware→Proxy-Migration offen (Next 16 Deprecation).

## Migrationsstand
`0001`–`0006` (additiv, idempotent), geprüft auf leerer DB und AP6-Bestand.
