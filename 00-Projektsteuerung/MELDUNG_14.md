# MELDUNG 14 vom Worker-Chat zu AUFTRAG_14

> Stand: 2026-08-17. Verfasst von Claude (Rolle Worker, Ausführungsagent
> „kb-implementierung"), Antwort auf `00-Projektsteuerung/AUFTRAG_14.md`.
> Schriftliche Notiz, kein Chat-Kanal.

## Ergebnis in Kürze

Migration 0022 (Qualifikationen, Zuordnung, `assignment_kind`, Nullable-
Umbau, partielle Unique-Indizes) additiv und idempotent umgesetzt, SQL-Smoke
29 (Fallkennung AA, 15 Fälle) geschrieben, Läufer/CI eingekettet und der
CI-Namenstest tolerant (Regex) gemacht. Lib/Actions erweitert
(`qualifications`, `technician_qualifications`, `assignment_kind`,
Monatsabfrage, Verschiebe-Operation als eine Transaktion). Neue Pflegeseite
`stammdaten/qualifikationen` sowie Qualifikations-Mehrfachauswahl auf der
Monteure-Seite. Das Dispo-Board wurde auf Wochen-/Monatsumschalter, rechte
Monteurliste (farbig nach höchster Qualifikation), HTML5-Drag&Drop MIT
Pflicht-Klick-Ebene und eine eigene Dispo-Zeile umgebaut. Alle erhobenen
Prüfungen grün (tsc, ESLint, 177/177 Unit-Tests, `bash -n`); SQL-Nachweis an
CI-Job `database` delegiert (kein `psql` in dieser Sandbox); `npm run build`
lief in den erlaubten einen Versuch, aber ohne Ergebnis vor Zeitlimit
(dokumentiert unten). Kein Stopppunkt ausgelöst.

## Geänderte/neue Dateien

**Neu (9):**

- `app/supabase/migrations/0022_hlk_dispo_board.sql`
- `app/supabase/test/29_hlk_dispo_board.sql`
- `app/src/lib/qualifications.ts`
- `app/src/app/(app)/stammdaten/qualifikationen/page.tsx`
- `app/src/components/masterdata/QualificationsClient.tsx`
- `app/test/auftrag14-hlk-dispo-board.test.mjs`

**Geändert (13):**

- `app/src/lib/on-call-plan.ts` (assignment_kind, Monatsabfrage `listOnCallMonth`)
- `app/src/lib/on-call-plan-actions.ts` (`assignDispo`, `moveOnCallEntry`)
- `app/src/lib/masterdata.ts` (Qualifikations-Reads, `getActiveTechniciansWithColor`)
- `app/src/lib/masterdata-actions.ts` (`saveQualification`, `setQualificationActive`, `setTechnicianQualifications`)
- `app/src/lib/date-local.ts` (Monats-Helfer: `monthStartIso`, `startOfMonthBerlinIso`, `addMonthsToIsoDate`, `daysInMonthIso`)
- `app/src/lib/roles.ts` (Nav-Eintrag „Qualifikationen")
- `app/src/app/globals.css` (additive Palette-Tokens `--qual-*-bg/-fg`, drei Blöcke: hell/dunkel/Systempräferenz-dunkel)
- `app/src/app/(app)/bereitschaftsplan/page.tsx` (Wochen-/Monatsumschalter)
- `app/src/components/on-call-plan/OnCallPlanClient.tsx` (vollständig umgebaut: DnD + Klick, Dispo-Zeile, Monatsraster)
- `app/src/app/(app)/stammdaten/monteure/page.tsx` (Qualifikations-Zuordnung geladen)
- `app/src/components/masterdata/TechniciansClient.tsx` (Qualifikations-Mehrfachauswahl im Bearbeiten-Dialog)
- `app/supabase/test/run_db_tests.sh` / `run_ap14b_local.ps1` (0022/29 hinter 0021/28 eingekettet)
- `.github/workflows/ci.yml` (Schrittname „Migrationen 0001-0022, Smokes 15-29")
- `app/test/auftrag7-hlk-anrufdaten.test.mjs` (Namenstest auf Regex `Migrationen 0001-00\d\d, Smokes 15-\d\d` umgestellt)
- `app/test/auftrag10-bereitschaftsplan.test.mjs` (zwei Fälle an das neue Komponenten-/Aktionsdesign angepasst, siehe unten)

**Vorbestehend uncommitted, von mir NICHT angefasst** (per `git status`
sichtbar, außerhalb des Auftragsumfangs): `0015_ap14b_masterdata_inventory_grants.sql`,
`21_ap14b_masterdata_inventory.sql`, `ap14b-masterdata-inventory.int.mjs`.

Keine Änderung an Meldungs-/Erfassungs-/Listenpfaden, keine bestehenden
Farbtoken geändert, keine Qualifikations-Startwerte erfunden. Kein
`.claude/**`, kein PROJEKT_WISSEN/PROJEKTSTATUS/CHAT_STATUS. Kein
Commit/Push (nur lesende `git`-Befehle verwendet).

## Migration 0022 — Kernpunkte

- `public.qualifications` (`label`, `rank int`, `color text` = Palettenschlüssel
  mit Check-Constraint auf die feste Menge, `is_active`) — Muster 0019, KEINE
  Startwerte.
- `public.technician_qualifications` (n:m, `unique(technician_id,
  qualification_id)`) — Muster 0021 (`on_call_plan`): select/insert/delete,
  KEIN update, kein `is_active` (reiner Zuordnungszustand).
- `public.on_call_plan`: `assignment_kind text not null default 'bereitschaft'`
  mit Check `in ('bereitschaft','dispo')`; `construction_stage_id` nullable
  (`alter column ... drop not null`, idempotent); neuer Check
  `on_call_plan_stage_kind_chk` koppelt beide Felder
  (`bereitschaft` ⇒ Bauabschnitt Pflicht, `dispo` ⇒ Bauabschnitt NULL).

### Unique-Index-Logik je Zuweisungsart (Bestandsschutz)

Der alte Constraint `on_call_plan_stage_date_tech_uq` (construction_stage_id,
plan_date, technician_id) wurde entfernt und durch **zwei partielle
Unique-Indizes** ersetzt:

- `on_call_plan_bereitschaft_uq` auf `(construction_stage_id, plan_date,
  technician_id) where assignment_kind = 'bereitschaft'` — exakt dieselben
  Spalten wie der alte Constraint.
- `on_call_plan_dispo_uq` auf `(plan_date, technician_id) where
  assignment_kind = 'dispo'` — ohne Bauabschnittsspalte, weil sie dort NULL
  ist (NULL kollidiert in einem gewöhnlichen Unique-Index nie mit sich
  selbst; der partielle Index ist hier fachlich zwingend).

**Kein Datenrisiko:** `assignment_kind` erhält beim `add column` automatisch
den Default `'bereitschaft'` für JEDE Bestandszeile — genau die Art, die die
alte Unique-Bedingung ohnehin voraussetzte. Der neue `bereitschaft`-Index
prüft dieselben drei Spalten wie zuvor; kein Stopppunkt ausgelöst.

## Bedienablauf (Dispo-Board)

**Drag & Drop (Desktop, HTML5-Drag-API, keine neue Abhängigkeit):** einen
Monteur-Chip aus der rechten Liste auf eine Zelle (Bauabschnitt×Tag oder die
Dispo-Zeile) ziehen legt eine neue Zuweisung an; einen bestehenden
Zuweisungs-Chip auf eine ANDERE Zelle ziehen verschiebt ihn
(`moveOnCallEntry`, delete+insert in einer Transaktion); auf den
gestrichelten „Hierher ziehen zum Entfernen"-Bereich oder zurück in die
Monteurliste ziehen entfernt die Zuweisung.

**Klick-Rückfallebene (Touch/Barrierefreiheit, Pflicht):** einen
Monteur-Chip antippen wählt ihn aus (sichtbar hervorgehoben, `aria-pressed`);
eine Zelle antippen weist den ausgewählten Monteur dieser Zelle zu und hebt
die Auswahl wieder auf. Jede bestehende Zuweisung trägt zusätzlich ein „×"
zum direkten Entfernen — unabhängig von einer laufenden Auswahl. In der
Monatsansicht öffnet ein Tagesklick (bei ausgewähltem Monteur) eine kompakte
Auswahl „Bauabschnitt oder Dispo?", weil die Monatszellen keine eigenen
Bauabschnittsspalten haben.

**DnD gilt nur in der Wochenmatrix** (natürliche Bauabschnitt×Tag-Zellen als
Drop-Ziel); die Monatsansicht bietet ausschließlich die Klick-Ebene plus
„×" zum Entfernen — ein Drop auf eine kompakte Monatszelle hätte kein
eindeutiges Ziel (welcher Bauabschnitt?). Das ist kein Stopppunkt (DnD
funktioniert, wo es einen sinnvollen Drop-Zielraum gibt), sondern eine
bewusste Abgrenzung.

## Farbpalette (`src/lib/qualifications.ts`)

Acht Palettenschlüssel: `rot`, `blau`, `gruen`, `gelb`, `orange`, `violett`,
`tuerkis`, `grau` (`grau` zusätzlich neutrale Standardfarbe ohne
Qualifikation). Jeder Schlüssel hat ein additives CSS-Tokenpaar
`--qual-<schlüssel>-bg`/`-fg` in `globals.css` (drei Blöcke: hell, explizites
Dark-Theme, Systempräferenz-Dark — bestehende Tokens unverändert). Die
Datenbank speichert ausschließlich den Schlüssel (`qualifications.color`,
Check-Constraint `qualifications_color_chk`), nie freies Hex. Die höchste
(größte `rank`) AKTIVE Qualifikation eines Monteurs bestimmt seine
Chip-Farbe im Board (`technicianColorKey()`).

## „Mehrere Tage auf einmal" (Punkt 4)

**Nicht umgesetzt.** Eine Mehrfachauswahl von Tagen bräuchte einen eigenen
Auswahlzustand (welche Tage markiert sind), eine sichtbare Markierung je
Zelle und eine geänderte Bestätigungslogik (eine Aktion für N Zellen statt
für eine) — das ist eine strukturelle Erweiterung der bestehenden „eine
Aktion pro Zelle"-Interaktion, keine Ergänzung ohne Umbau. Laut Auftrag
("nur wenn ohne Umbau möglich, sonst entfallen lassen und begründen") bewusst
weggelassen; die Klick-Ebene deckt „Tag für Tag" weiterhin vollständig ab.

## Prüfergebnisse (tatsächlich erhoben, aus `app/`)

- `node ./node_modules/typescript/bin/tsc --noEmit --incremental false`:
  **Exit 0** (zweifach erhoben, vor und nach dem ESLint-Fix, beide Male 0).
- `node ./node_modules/eslint/bin/eslint.js` auf allen 14 neuen/geänderten
  Quelldateien des Auftrags in einem Lauf: **1 Fehler gefunden**
  (`react/no-unescaped-entities` in `OnCallPlanClient.tsx`, ein Zitatzeichen
  in JSX-Text), sofort behoben, erneuter Einzellauf auf dieselbe Datei:
  **Exit 0**. Kein Zeitlimit aufgetreten (Laufzeit < 5 s).
- `node --test test/*.test.mjs`: **Exit 0, 177 Einträge, 177 pass, 0 fail, 0
  skipped, 0 cancelled.** Baseline 162 → **neu 177** (+15: neun neue Fälle in
  `auftrag14-hlk-dispo-board.test.mjs`, sechs durch das Auftrags-Redesign
  netto — zwei bestehende Fälle in `auftrag10-bereitschaftsplan.test.mjs`
  wurden inhaltlich an das neue Komponenten-/Aktionsdesign angepasst, siehe
  unten, keine Testfälle entfernt).
- LF-normalisiertes `bash -n` auf `supabase/test/run_db_tests.sh`: **Exit 0**.
- `npm run build`: **ein Versuch** (wie vorgegeben, nicht wiederholt) — der
  Lauf erreichte innerhalb des verfügbaren Zeitfensters (178 s) kein Ergebnis
  (weder Erfolg noch der aus Vorgängermeldungen bekannte `EPERM
  .fuse_hidden`-Fehler); der Prozess wurde vom Werkzeugrahmen abgebrochen,
  bevor `next build` fertig kompilieren konnte. Dieselbe bekannte
  OneDrive-Mount-Langsamkeit wie in früheren Meldungen, diesmal als Timeout
  statt als EPERM sichtbar. Lokale Gegenprüfung durch Dennis (`npm run
  build`) bleibt erforderlich.
- **SQL-Nachweis (Migration 0022, Smoke 29) konnte in dieser Sandbox NICHT
  gegen eine echte PostgreSQL-Instanz laufen** — kein `psql`/`createdb`
  verfügbar. Delegiert an den CI-Job `database`
  (`.github/workflows/ci.yml`, Schritt „Datenbankprüfungen (Migrationen
  0001-0022, Smokes 15-29, sechs Integrationssuiten)"). Beide SQL-Dateien
  wurden stattdessen inhaltlich gegen den Auftrag und die Muster 0019/0021,
  26/28 geprüft.

### Warum sich zwei bestehende Testfälle geändert haben

`auftrag10-bereitschaftsplan.test.mjs` prüfte statisch, dass genau **zwei**
Aufrufstellen `STAFF_ALLOWED_ROLES.includes(session.role)` verwenden
(`assignOnCall`, `removeOnCall`) und dass `AddCellControl`/`AssignedBadge`
(die alten, jetzt entfernten Bauteile) durch `canEdit` bedingt sind.
AUFTRAG_14 ergänzt zwei weitere schreibende Aktionen (`assignDispo`,
`moveOnCallEntry`) nach demselben Allowlist-Muster und ersetzt die
Zellen-Bauteile durch die neue Drag&Drop-/Klick-Struktur. Ich habe die
Erwartungswerte auf die neue, unveränderte fachliche Zusage angepasst (jetzt
vier Aufrufstellen; die rechte Monteurliste und das „×" am Zuweisungs-Chip
sind weiterhin durch `canEdit` bedingt, zusätzlich `draggable={canEdit}`
geprüft) — keine Lockerung der ursprünglichen Prüfabsicht.

## Git-Status (nur eigener Umfang, nur lesende Befehle)

```
 M .github/workflows/ci.yml
 M app/src/app/(app)/stammdaten/monteure/page.tsx
 M app/src/app/globals.css
 M app/src/components/masterdata/TechniciansClient.tsx
 M app/src/components/on-call-plan/OnCallPlanClient.tsx
 M app/src/lib/date-local.ts
 M app/src/lib/masterdata-actions.ts
 M app/src/lib/masterdata.ts
 M app/src/lib/on-call-plan-actions.ts
 M app/src/lib/on-call-plan.ts
 M app/src/lib/roles.ts
 M app/supabase/test/run_ap14b_local.ps1
 M app/supabase/test/run_db_tests.sh
 M app/test/auftrag10-bereitschaftsplan.test.mjs
 M app/test/auftrag7-hlk-anrufdaten.test.mjs
?? app/src/app/(app)/stammdaten/qualifikationen/
?? app/src/components/masterdata/QualificationsClient.tsx
?? app/src/lib/qualifications.ts
?? app/supabase/migrations/0022_hlk_dispo_board.sql
?? app/supabase/test/29_hlk_dispo_board.sql
?? app/test/auftrag14-hlk-dispo-board.test.mjs
```

`.git/index.lock` wurde nicht angetroffen. Vorbestehende, außerhalb des
Auftragsumfangs liegende Änderungen (`.claude/`, `deploy/`, weite Teile von
`app/supabase/` inkl. der drei oben genannten Dateien) wurden von mir
**nicht** erzeugt und **nicht** angefasst.

**Kein Commit, kein Push, kein Merge, kein Tag.** Der Arbeitsbaum bleibt
uncommitted zur Prüfung durch den Orchestrator/Review-Chat.

## Statuspflege

`.claude/automation/status/fortschritt.json` liegt unter der Negativliste
(kein `.claude/**`) und wurde deshalb **nicht** geändert — dieselbe Abwägung
wie in den Vorgängermeldungen (z. B. MELDUNG_10.md), dem Orchestrator zur
Kenntnis.

## Stopppunkt

**Kein Stopppunkt ausgelöst.** Im Einzelnen geprüft:

- **Unique-Umbau vs. Bestandsdaten:** kein Risiko, siehe Abschnitt „Migration
  0022 — Kernpunkte" oben (Default-Backfill deckt sich exakt mit der alten
  Bedingung).
- **Dispo-Zeile ohne Nullable-Änderung:** die Nullable-Änderung war nötig und
  wurde vorgenommen (`alter column ... drop not null`, idempotent, kein
  Datenverlust — bestehende Zeilen behalten ihren gesetzten Wert).
- **DnD ohne neue Abhängigkeit:** funktioniert (HTML5-Drag-API,
  `draggable`/`onDragStart`/`onDrop`/`dataTransfer`), die Klick-Ebene ist
  zusätzlich vollständig vorhanden.
- Kein Fehler ist auch nur zweimal identisch aufgetreten (der einzige
  ESLint-Fund wurde im ersten Korrekturversuch behoben).
