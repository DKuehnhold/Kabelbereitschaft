# Monitoring und Logging – Konzept (AP7)
> Stand: 2026-07-19 · Anbieterneutral (keine Plattform erfunden).

## Zu überwachende Ereignisse/Metriken
- Anwendungs-/API-Fehlerrate, HTTP-Statusverteilung (4xx/5xx).
- Fehlgeschlagene Synchronisation, fehlgeschlagene Uploads, offene Konflikte (Client meldet Zustände).
- Service-Worker-Registrierungs-/Update-Fehler.
- Datenbankfehler, RLS-Verstöße (abgelehnte Zugriffe), Authentifizierungsfehler.
- Verfügbarkeit (`/api/health`), Antwortzeiten, Speicher-/Storage-Verbrauch.
- Ungewöhnliche Fehlerraten / mögliche Missbrauchsmuster (Login, Sync, Upload).

## Logging-Regeln (verbindlich)
Nicht loggen: Passwörter, Tokens, Service-Keys, vollständige personenbezogene Inhalte,
vollständige Bildmetadaten ohne Zweck. IDs/aggregierte Zähler sind zulässig.

## Health-Check
`GET /api/health` liefert minimal `status/version/time` (keine Secrets/DB-Details). Für Uptime-Checks
geeignet. Erweiterte Diagnose nur für angemeldete Nutzer/Administratoren (Offline-/Dashboard-Ansicht).

## Umsetzung
Konkrete Plattform (z. B. Hosting-Logs, Supabase-Logs, externer APM) ist bei Deployment festzulegen.
Bis dahin: Konzept vorhanden, technische Umsetzung offen.

## Ergänzung Containerbetrieb (2026-07-28, AP14/A11)
Zielplattform ist ein Docker-Compose-Stack (siehe `deploy/README.md`). Daraus konkretisiert sich:

- **Logs:** Docker-`json-file`-Treiber mit Rotation (10 MB × 5 Dateien je Dienst), Zugriff über
  `docker compose logs`. Eine zentrale Aggregation und die Aufbewahrungsdauer sind **offen**.
- **Verfügbarkeit:** `/api/health` wird sowohl als Container-Healthcheck
  (`app/docker/healthcheck.mjs`, ohne curl/wget) als auch für externe Uptime-Prüfungen über HAProxy
  genutzt. Ungesunde Container werden von Compose neu gestartet (`restart: unless-stopped`).
- **HTTP-Statusverteilung, Antwortzeiten und Missbrauchsmuster** werden auf **HAProxy**-Ebene
  erhoben; dort liegt gemäß V4 auch das Rate Limiting.
- **Datenbank:** `pg_isready` als Healthcheck; Fehler- und Verbindungsmetriken aus den
  PostgreSQL-Logs. Statt „Supabase-Logs" gilt ab Arbeitspaket B der eigene PostgreSQL-Container.
- **Benachrichtigungsweg bei Fehlern:** **offen** (Infrastrukturentscheidung).
- Die Logging-Regeln oben gelten unverändert: keine Passwörter, Tokens, Schlüssel oder
  vollständigen personenbezogenen Inhalte in Logs.
