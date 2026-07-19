# Navigation und Seiten

> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1

Die App nutzt Next.js 15 (App Router). Alle fachlichen Routen sind geschützt und erfordern eine gültige Supabase-Sitzung. Die sichtbare Navigation richtet sich nach `profiles.role`.

## Seitenlandkarte

| Route | Zweck | Zugriff |
| --- | --- | --- |
| `/login` | Anmeldung, Firmenlogo | öffentlich |
| `/` | Einstieg → rollenabhängige Weiterleitung | angemeldet |
| `/vorgaenge` | Vorgangsübersicht | Disponent, Admin |
| `/vorgaenge/neu` | Vorgang anlegen | Disponent, Admin |
| `/vorgaenge/[id]` | Vorgangsdetail + Chronik | Disponent, Admin; Monteur nur wenn zugewiesen |
| `/meine-einsaetze` | Nur zugewiesene Vorgänge | Monteur |
| `/lager` | Lagerorte, Bestände, Bewegungen | Admin; Monteur (Entnahme/Rückgabe) |
| `/material` | Materialstammdaten | Admin |
| `/verwaltung` | Benutzer, Rollen, Stammdaten | Admin |

> In AP1 sind Login und die rollenbasierte Grundnavigation umgesetzt. Die fachlichen Seiteninhalte (Vorgänge, Lager, Material) folgen in späteren APs.

## Geschützte Routen

- Ohne gültige Sitzung erfolgt Weiterleitung auf `/login`.
- Rollen werden serverseitig und über RLS geprüft; die UI blendet unzulässige Bereiche zusätzlich aus.
- Ein Monteur erreicht `/vorgaenge/[id]` nur für ihm zugewiesene Vorgänge.

## Grundnavigation je Rolle

| Rolle | Sichtbare Hauptpunkte |
| --- | --- |
| Disponent | Vorgänge, Vorgang anlegen |
| Monteur | Meine Einsätze, Lager (Entnahme/Rückgabe) |
| Administrator | Vorgänge, Lager, Material, Verwaltung, Export |

## Responsives Verhalten

- **Desktop-Header:** horizontale Navigationsleiste mit Firmenlogo links, Rollen-/Benutzeranzeige rechts.
- **Mobiler Header:** kompakter Header mit Firmenlogo und einklappbarem Menü (Burger).
- Layout und Tabellen/Listen sind für Touch-Bedienung im Feld optimiert (größere Zielflächen, vertikale Stapelung).
