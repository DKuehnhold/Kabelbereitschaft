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
