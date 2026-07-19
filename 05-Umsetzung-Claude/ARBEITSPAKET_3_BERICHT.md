# Arbeitspaket 3 – Umsetzungsbericht
> Stand: 2026-07-19 · MVP V0.1 · Material- und Lagerverwaltung

## Statushinweis (wichtig)
Der gesamte AP3-Code ist implementiert und die Verifikation wurde am 2026-07-19
**tatsächlich ausgeführt** und ist **vollständig grün**: `npm run lint`, `npx tsc --noEmit`,
`next build`, Migration 0001–0004 (inkl. Idempotenz-Prüfung der additiven Migrationen 0003/0004)
sowie der bestehende und der neue vollständige AP3-Smoke-Test. Ergebnisse siehe Abschnitt
„Testergebnisse". Umgebungsnotiz: Die lokale Prüfung lief gegen PostgreSQL 16 (user-space);
in `0001_init.sql` wurde für den lokalen Lauf ausschließlich die Zeile
`create extension pgcrypto` übersprungen, da `gen_random_uuid()` in PostgreSQL 13+ Kernbestand
ist und Supabase die Erweiterung ohnehin bereitstellt. Die Migrationsdatei selbst bleibt
unverändert.

## Erledigte Funktionen (Code vorhanden)
- **Materialstammdaten** (`/material`, Admin): Anlegen, Bearbeiten, Aktivieren/Deaktivieren,
  Suche, Sortierung; kein Löschen. Felder: Materialnummer, Bezeichnung, Kurzbeschreibung,
  Einheit, Kategorie, Mindestbestand (optional), Status.
- **Lagerorte** (`/lager`, Admin): Anlegen/Bearbeiten/Aktiv-Inaktiv, Typen (5), kein Löschen.
- **Bestandsübersicht** (`/bestand`): ausschließlich aus View `material_stock`
  (Material, Lager, Istbestand, Einheit, Status), Suche/Filter/Sortierung.
- **Lagerbewegungen** (Admin-Dialog): Wareneingang, Umbuchung, Korrektur, Verlust, Beschädigung.
- **Entnahme / Rückgabe / Verbrauch** (Monteur, im Vorgang): vorgangs- und lagerbezogen.
- **Materialhistorie** (`/materialhistorie`): alle Bewegungen, Filter (Material, Lager, Vorgang,
  Person, Zeitraum, Bewegungstyp), neueste zuerst.
- **Material im Vorgang**: Karte im Vorgangsdetail, berechnet aus `inventory_movements`.
- **Dashboard**: Admin-Karte „Material unter Mindestbestand".
- Alles responsive (Tabellen Desktop, Karten Mobile, Dialoge für Bewegungen).

## Validierungen (implementiert)
- Keine negativen Bestände (DB-Trigger, autoritativ).
- Keine Entnahme ohne Vorgang (Constraint + Server-Action).
- Rückgabe ≤ entnommene Restmenge (Server-Action).
- Nur aktive Materialien/Lager auswählbar.

## Geänderte/neue Dateien
- Migration: `app/supabase/migrations/0004_ap3_inventory_rls.sql` (additive RLS für Monteur-Verbrauch).
- Libs: `src/lib/inventory.ts`, `src/lib/inventory-actions.ts` (neu); `src/lib/roles.ts` (Navigation).
- Komponenten (neu): `Modal`, `inventory/MaterialsClient`, `LocationsClient`, `StockClient`,
  `MovementsClient`, `MonteurMaterialActions`, `IncidentMaterialCard`.
- Seiten: `bestand`, `materialhistorie` (neu); `material`, `lager` (aus Platzhalter ersetzt);
  `vorgaenge/[id]` (Material-Karte), `dashboard` (Low-Stock-Karte).
- Test (neu): `app/supabase/test/11_ap3_smoke.sql` – vollständiger AP3-Smoke-Test (11 Szenarien).
- Doku: DATENMODELL, LAGER_UND_MATERIAL, TESTPLAN, TESTFAELLE, OFFENE_PUNKTE.

## Testergebnisse (tatsächlich ausgeführt am 2026-07-19)
Umgebung: Node v22, PostgreSQL 16 (user-space). Alle Prüfungen erfolgreich:

- `npm run lint` → **PASS** (0 Fehler).
- `npx tsc --noEmit` → **PASS** (0 Fehler).
- `next build` → **PASS** (Compiled successfully; alle AP3-Routen erzeugt: `/bestand`, `/material`,
  `/lager`, `/materialhistorie`, `/dashboard`, `/vorgaenge/[id]`). Nicht-blockierende Warnung:
  Next 16 meldet `middleware` als deprecated (AP1-Datei, außerhalb AP3-Umfang).
- Migration 0001–0004 gegen leere DB → **PASS** (13 Tabellen, 33 RLS-Policies, 8 `movement_type`,
  View `material_stock`, Trigger `trg_inventory_nonneg`, AP2-Spalte `priority`, AP3-Policy
  `movements_insert_monteur_verbrauch`). Erneutes Anwenden von 0003 und 0004 → **PASS** (idempotent).
- Bestehender Smoke-Test `10_smoke_test.sql` → **PASS**.
- AP3-Smoke-Test `11_ap3_smoke.sql` → **PASS** (alle 11 Szenarien):
  T1 Wareneingang, T2 Umbuchung, T3 Entnahme mit Vorgang, T4 Entnahme ohne Vorgang blockiert
  (Constraint `mv_entnahme`), T5 Rückgabe ≤ Restmenge, T6 Rückgabe > Restmenge abgelehnt
  (App-Regel `returnableQuantity`), T7 Verbrauch berechtigter Monteur, T8 Verbrauch
  unberechtigt blockiert (RLS 0004), T9 negativer Bestand blockiert (Trigger), T10 RLS
  Admin/Disposition/Monteur, T11 Bestandsberechnung via `material_stock`.

## Gefundene und behobene Fehler
- Keine Defekte in AP3-Implementierung, Migrationen oder RLS.
- Korrektur ausschließlich im neuen Testartefakt `11_ap3_smoke.sql`: erwarteter Gesamtbestand
  der Abschlussprüfung von 94 auf 89 berichtigt (korrektes Sollverhalten: Zentral 70 +
  Fahrzeug 19) und als OK/FAIL-Assertion ausgeführt.

## Offene Punkte
- Manuelle UI-Abnahme gegen ein verbundenes Supabase-Projekt (siehe TESTPLAN).
- AP4 (Bild-Upload/EXIF, CSV-Export) – separat.

## Empfehlung für Arbeitspaket 4
1. Zuerst AP3-Verifikation + Commit nachholen (sobald Build-Umgebung verfügbar).
2. AP4: Bild-Upload (privater Bucket vorhanden) mit serverseitiger EXIF-/GPS-Auswertung
   (`src/lib/exif.ts` vorbereitet); Bildkategorien; Anzeige/Timeline-Integration.
3. CSV-Export der Vorgangsübersicht (UTF-8) inkl. optionalem Logo-/Metadatenkopf.
