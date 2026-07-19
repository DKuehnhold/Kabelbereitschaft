# Testplan

> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1

## Teststrategie

Zweistufig: automatisierte technische Prüfungen (Lint, Typecheck, Build, DB-Migration) und manuelle funktionale Prüfungen (Login, Rollen, Navigation, später Fachfunktionen). Der Testumfang wächst mit den Arbeitspaketen.

## Umfang Arbeitspaket 1 (jetzt testbar)

| Prüfung | Art | Inhalt |
| --- | --- | --- |
| Build | automatisch | `npm run build` erzeugt fehlerfreien Produktions-Build |
| Lint | automatisch | `npm run lint` ohne Fehler |
| Typecheck | automatisch | TypeScript-Prüfung ohne Fehler |
| Migration | automatisch/manuell | DB-Migration läuft gegen leere Postgres-DB durch |
| RLS | manuell | Rollen-Policies greifen (Zugriff nur gemäß Rolle) |
| Login | manuell | Anmeldung/Abmeldung, Schutz der Routen |
| Rollen | manuell | Navigation je Rolle admin/disponent/monteur korrekt |
| Grundnavigation | manuell | geschützte Routen leiten ohne Sitzung auf `/login` |

## Umfang spätere Arbeitspakete (geplant)

| Bereich | Prüfung |
| --- | --- |
| Vorgang | Anlegen, Zuweisen, Statuslauf, Chronik-Unveränderbarkeit |
| Zustand | Zustandsbewertung setzen |
| Bilder | Upload, EXIF-Auswertung, Verhalten ohne GPS/EXIF, privater Bucket |
| Material | Bewegungen, Bestandsableitung, keine negativen Bestände, Vorgang+Lager-Bindung |
| Export | CSV-Format, Filterwirkung |

## Werkzeuge

- Manuelle Tests: Browser (Desktop + mobile Ansicht/Responsive-Modus).
- Automatisierte Prüfungen: npm-Skripte im Ordner `app`.
- DB-Prüfung: Supabase-CLI / lokale Postgres-Instanz.

## Testdaten

Seed-Daten für Rollen (je ein admin/disponent/monteur), Baustufen und Stammdaten werden mit der Migration bereitgestellt. Keine echten personenbezogenen Daten in Testumgebungen.

## AP2 – Vorgangsverwaltung (Prüfumfang)
Automatisch geprüft (ausgeführt): `npm run lint`, `tsc --noEmit`, `next build`,
Migration 0001–0003 + RLS-/Trigger-Smoke-Test inkl. Prioritätsprüfung gegen PostgreSQL 18.

Manuell zu prüfen (benötigt verbundenes Supabase-Projekt):
- Dashboard Disponent (Kennzahlen, Tabelle, Filter/Suche) und Monteur (nur eigene Einsätze).
- Vorgang anlegen (Pflichtfeldvalidierung, Status=Neu, Chronikeintrag).
- Vorgang bearbeiten (nur Disposition/Admin).
- Monteur zuweisen / entfernen; Statuswechsel rollenabhängig; Zustandsbewertung; Notiz.
- Timeline zeigt Ereignisse chronologisch, unveränderbar.
- Responsiv (Sidebar/Hamburger, Tabellen/Karten).
