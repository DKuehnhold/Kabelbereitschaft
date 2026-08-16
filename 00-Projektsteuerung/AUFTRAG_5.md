# AUFTRAG 5 an den Worker-Chat: Erfassungsmaske nach Variante A („Neue Meldung")

> Stand: 2026-08-16. Verfasst von Claude (Rolle Orchestrator/Review, Cowork-Chat 1).
> Grundlage: Entscheidungen Dennis vom 2026-08-16 (PROJEKT_WISSEN.md: Variante A, Begriff
> „Meldung", shadcn-Basis) und Mockup-Abnahme im Review-Chat. Voraussetzung: REVIEW_4 grün.
> CHAT_STATUS.md-Konvention beachten.

## Ziel

Die Erfassungsseite `/vorgaenge/neu` nach **Variante A** umbauen — erste sichtbare
GUI-Scheibe auf dem shadcn-Fundament (AUFTRAG_3):

1. **Desktop (ab md-Breakpoint): zwei Spalten** — links „Zuordnung" (Kunde*, Bauabschnitt*,
   VzG-Strecke*, Bereitschaftsnummer), rechts „Störung" (Priorität*, Beschreibung*,
   Kabelpositionen/Kabeltyp wie bisher über den vorhandenen `CablePositionsEditor`).
   Primäraktion oben rechts neben der Seitenüberschrift, zusätzlich am Formularende.
2. **Mobil (unter md): eine Spalte**, Reihenfolge Zuordnung → Störung; Primäraktion als
   unten fixierte Leiste (sticky, Daumenzone, safe-area beachten).
3. **Optionale Abschnitte** „Ort & Objekt" und „Meldung & Bemerkungen" als **eingeklappte**
   Collapsibles (shadcn `collapsible`), Kennzeichnung „optional"; eingegebene Werte bleiben
   beim Ein-/Ausklappen erhalten (Collapsible nur visuell, kein Unmount der Inputs — sonst
   gehen Formularwerte des unkontrollierten Formulars verloren).
4. **Priorität als Tippflächen** (shadcn `toggle-group`, Single-Select, Pflichtfeld) statt
   Dropdown; Werte/`name`-Attribut und Server-Action-Payload unverändert (verstecktes Input
   oder Radio-Pattern, damit `createIncident` identische FormData erhält).
5. **Begriffe nur auf dieser Seite:** Überschrift „Neue Meldung", Knopf „Meldung anlegen",
   Hinweistext entsprechend („Nach dem Speichern öffnet sich die Meldungsseite …").
   Sonst nirgends umbenennen.
6. Mindest-Touchzielgröße 44px für alle Bedienelemente; Labels/`htmlFor` und
   Fehlermeldungsverhalten unverändert erhalten (a11y nicht verschlechtern).

## Positivliste

- `app/src/components/incidents/NewIncidentForm.tsx`
- `app/src/app/(app)/vorgaenge/neu/page.tsx` (nur Überschrift/Umgebung dieser Seite)
- Bei Bedarf: Import/Nutzung der vorhandenen shadcn-Komponenten aus
  `src/components/ui/shadcn/` (dort KEINE Änderungen außer dem dokumentierten
  `bg-muted`-Kompromiss, falls er hier sichtbar würde — dann stoppen und melden)
- Bei Bedarf: **eine** neue Unit-Testdatei unter `app/test/` (registerHooks-Muster)

## Negativliste

- **Keine Änderung an `createIncident`/Server-Actions, keine Migration, kein SQL, keine
  neuen Felder** (Anrufdaten-Block kommt erst nach Dennis' Entscheidungen — NICHT vorziehen).
- Keine Änderung an anderen Seiten/Komponenten, keine globale „Meldung"-Umbenennung,
  keine Routenänderung (`/vorgaenge/neu` bleibt).
- Keine Änderung an `globals.css`-Bestandswerten (additiv nur, falls zwingend — offenlegen).
- Kein Commit, kein Push.

## Abnahmekriterium (DoD)

- `tsc --noEmit`: Exit 0. ESLint auf geänderten Dateien: Exit 0.
- `node --test test/*.test.mjs`: keine roten Einträge (Baseline 115/115; neue Tests offen
  deklarieren).
- Die an `createIncident` übermittelten FormData-Feldnamen und -werte sind nachweislich
  unverändert (kurz begründen oder per Test belegen).
- Ein `npm run build`-Versuch, Ergebnis dokumentieren (bekanntes EPERM-Mount-Limit
  akzeptiert; lokaler Nachweis bleibt bei Dennis).
- Screenshot-Abnahme ist in der Sandbox nicht möglich → visuelle Abnahme macht Dennis lokal
  (`npm run dev`); in der Meldung die geprüften Breakpoints/Zustände textlich beschreiben.

## Stopppunkt

Anhalten und melden, wenn: der Umbau ohne Änderung der Server-Action nicht möglich ist;
eine sichtbare Gestaltungsfrage auftaucht, die das Variante-A-Mockup nicht beantwortet;
derselbe Fehler dreimal auftritt; oder CHAT_STATUS einen aktiven Orchestrator-Lauf zeigt.

## Meldeweg

`00-Projektsteuerung/MELDUNG_5.md` (Konvention wie bisher) + `fortschritt.json` gemäß
REVIEW_4-Antwort. Danach stoppen — Review durch Chat 1.
