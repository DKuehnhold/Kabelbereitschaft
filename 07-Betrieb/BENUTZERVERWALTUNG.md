# Benutzerverwaltung

> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1

Benutzer werden über Supabase Auth verwaltet; die fachliche Rolle liegt in `profiles.role`.

## Benutzer anlegen

1. Benutzer in **Supabase Auth** anlegen (E-Mail + Passwort, oder Einladung).
2. Zu jedem Auth-Benutzer existiert ein Datensatz in `profiles` (per Trigger beim Anlegen erzeugt oder manuell ergänzt).
3. Im Profil die **Rolle** setzen: `administrator`, `disponent` oder `monteur`.

## Rollenzuweisung

- Die Rolle steuert Navigation und Zugriff (RLS).
- Änderung der Rolle erfolgt über das Feld `profiles.role` (nur durch Administrator).
- Ein Monteur benötigt zusätzlich Zuweisungen (`incident_assignments`), um Vorgänge zu sehen.

## Deaktivierung

- Benutzer werden nicht gelöscht, sondern über `is_active` (Feld auf `profiles`) deaktiviert.
- Deaktivierte Benutzer erscheinen nicht mehr in Auswahllisten (z. B. Monteur-Zuweisung) und erhalten keinen fachlichen Zugriff.
- Optional zusätzlich der Auth-Zugang in Supabase sperren.

## Ersteinrichtung Administrator

1. Ersten Benutzer in Supabase Auth anlegen.
2. Dessen `profiles`-Datensatz sicherstellen und `role = 'administrator'` setzen (initial per Supabase-SQL-Editor / Seed).
3. Über diesen Admin alle weiteren Benutzer und Rollen einrichten.

> Sicherheitshinweis: Der initiale Admin-Zugang ist besonders zu schützen; Standard-/Testpasswörter vor Produktivbetrieb ändern.
