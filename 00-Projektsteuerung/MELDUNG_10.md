# MELDUNG 10 vom Worker-Chat zu AUFTRAG_10

> Stand: 2026-08-17. Verfasst von Claude (Rolle Worker, Ausführungsagent
> „kb-implementierung"), Antwort auf `00-Projektsteuerung/AUFTRAG_10.md`.
> Schriftliche Notiz, kein Chat-Kanal.

## Vorbefund

Bei Übernahme des Auftrags waren Migration 0021, Smoke 28, die
Läufer-/CI-Verdrahtung, `on-call-plan.ts`/`on-call-plan-actions.ts`, die
Seite `/bereitschaftsplan` samt Client-Komponente, die Datums-Helfer in
`date-local.ts`, der Navigationseintrag in `roles.ts` und die Unit-Testdatei
bereits **vollständig und wortgetreu nach Auftrag** im Arbeitsbaum vorhanden
(nicht committet). Ich habe jede Datei gegen `AUFTRAG_10.md` und die
genannten Musterdateien geprüft, keine inhaltliche Abweichung gefunden und
ausschließlich die unten beschriebene Prüflauf-Regression behoben.

## Geänderte/neue Dateien

**Neu (bereits vorgefunden, von mir geprüft, keine Auffälligkeit — 8):**

- `app/supabase/migrations/0021_hlk_bereitschaftsplan.sql`
- `app/supabase/test/28_hlk_bereitschaftsplan.sql`
- `app/src/lib/on-call-plan.ts`
- `app/src/lib/on-call-plan-actions.ts`
- `app/src/app/(app)/bereitschaftsplan/page.tsx`
- `app/src/components/on-call-plan/OnCallPlanClient.tsx`
- `app/test/auftrag10-bereitschaftsplan.test.mjs`
- `00-Projektsteuerung/AUFTRAG_10.md` (Auftragsdatei selbst, nicht von mir erzeugt)

**Geändert (bereits vorgefunden, keine Auffälligkeit — 5):**

- `app/src/lib/date-local.ts` (Abschnitt "AUFTRAG_10": `isIsoCalendarDate`,
  `berlinCalendarDateIso`, `addDaysToIsoDate`, `mondayOfWeekBerlinIso`)
- `app/src/lib/roles.ts` (Nav-Eintrag „Bereitschaftsplan" für alle drei Rollen)
- `app/supabase/test/run_db_tests.sh` (0021/28 hinter 0020/27 eingekettet)
- `app/supabase/test/run_ap14b_local.ps1` (dieselbe Einkettung, Windows-Fassung)
- `.github/workflows/ci.yml` (Schrittname „Migrationen 0001-0021, Smokes 15-28")

**Von mir geändert (1, Regression aus der bereits vorgefundenen
CI-Umbenennung):**

- `app/test/auftrag7-hlk-anrufdaten.test.mjs`

Keine Änderung an incidents-Pfaden, Dashboard, Disponenten-/Detailansichten,
keine eigene Kürzel-Logik, keine Bestandsmigration angefasst. Kein
`.claude/**`, kein PROJEKT_WISSEN/PROJEKTSTATUS/CHAT_STATUS. Kein
Commit/Push.

## Diff-Kurzbeschreibung

### `app/supabase/migrations/0021_hlk_bereitschaftsplan.sql` (geprüft, unverändert übernommen)

Tabelle `public.on_call_plan` exakt nach Auftrag: `id uuid pk`,
`construction_stage_id`/`technician_id` als nicht kaskadierende FKs (keine
`on delete`-Klausel), `plan_date date not null`, Audit-Spalten/Trigger wie
Bestand, `unique (construction_stage_id, plan_date, technician_id)`. RLS: eine
`select`-Policy für jeden Angemeldeten, je eine `insert`/`delete`-Policy nur
für Staff — **drei** Einzel-Policies statt der üblichen zwei „for all",
begründet im Kopfkommentar (kein `update`-Bedarf, eine „for all"-Policy hätte
`update` auf Policy-Ebene mit erlaubt). Grants
`select, insert, delete` an `app_user` — die im Auftrag ausdrücklich
begründete Ausnahme (delete statt Deaktivierung, Audit-Trigger protokolliert
das delete vollständig). Vier fail-closed Prüfblöcke (Rechte inkl.
Negativprobe auf `update`, RLS/Policy-Zahl und -Kommando, FK-Nichtkaskadierung
beider Fremdschlüssel, Unique-Bedingung).

### `app/supabase/test/28_hlk_bereitschaftsplan.sql` (Fallkennung Z, geprüft, unverändert übernommen)

Zwölf Fälle (Z1–Z12) plus Fixture-/Endprobe: Z1 Idempotenz-Doppellauf der
echten Migrationsdatei per `\ir`; Z2–Z4 Anlegen durch Staff inkl. Unique-
Verletzung (23505) und der ausdrücklich zulässigen zweiten, verschiedenen
Person am selben Tag/Bauabschnitt; Z5–Z8 Rollenmatrix (Monteur liest, kein
insert/delete, kein update auch für Staff — je 42501); Z9 Entfernen durch
Staff; Z10/Z11 FK-Nichtkaskadierung beider Fremdschlüssel (23503); Z12 Audit
bei delete (`detail.old` trägt die gelöschte Zeile). Läuft komplett in einer
Transaktion mit `rollback`, Z-Ende belegt keine zurückbleibende Zeile und kein
neues Schemaobjekt.

### `app/supabase/test/run_db_tests.sh` / `run_ap14b_local.ps1` / `.github/workflows/ci.yml` (geprüft, unverändert übernommen)

0021/28 unmittelbar hinter 0020/27 in beide Läufer eingekettet (dieselbe
Konvention wie 0015/21…0020/27), CI-Schrittname auf „Migrationen 0001-0021,
Smokes 15-28" fortgeschrieben.

### `app/src/lib/date-local.ts` (geprüft, unverändert übernommen)

Neuer Abschnitt „AUFTRAG_10": `isIsoCalendarDate` (Formats- und
Kalenderüberlaufprobe wie `parseBerlinDatetimeLocal`), `berlinCalendarDateIso`
(Berliner Kalendertag eines Instants über `Intl.DateTimeFormat`),
`addDaysToIsoDate` (reine, DST-unabhängige Kalenderarithmetik über
`Date.UTC`), `mondayOfWeekBerlinIso` (Montag der Berliner Kalenderwoche:
zeitzonenabhängiger Schritt nur zur Ermittlung des heutigen Kalendertags,
danach reine Kalenderarithmetik — DST-fest wie im Auftrag verlangt).

### `app/src/lib/on-call-plan.ts` / `on-call-plan-actions.ts` (geprüft, unverändert übernommen)

`listOnCallWeek(weekStartIso)`: normalisiert auf den Montag der enthaltenden
Woche, liefert aktive Bauabschnitte (Zeilen) und alle Zuweisungen der sieben
Tage; fail-closed leere Woche ohne Sitzung. `assignOnCall`/`removeOnCall`:
Staff-Allowlist `STAFF_ALLOWED_ROLES = ["admin", "disponent"]` exakt nach dem
Muster aus `incident-list-actions.ts`, `withUserTransaction`, parametrisiertes
SQL, SQLSTATE-Klassifizierung (`PG_UNIQUE_VIOLATION` → freundliche
Duplikat-Meldung „Dieser Techniker ist für diesen Bauabschnitt an diesem Tag
bereits eingeteilt."), keine Datenbankmeldung im Aktionsergebnis.

### `app/src/app/(app)/bereitschaftsplan/page.tsx` / `OnCallPlanClient.tsx` (geprüft, unverändert übernommen)

Wochenmatrix wie die Excel: Zeilen = aktive Bauabschnitte, Spalten Mo–So mit
Datum, Zellen = Techniker-Badges; Staff kann je Zelle hinzufügen (Select) und
entfernen (×), Vor-/Zurück-Navigation je Woche und „Heute"-Sprung über
`?woche=`-Query-Parameter. `canEdit` (aus `session.role`) steuert echtes
Weglassen der Bedienelemente, keine CSS-Verstecklösung — geprüft per
statischem Test unten. Mobil: Tageskarten untereinander, dieselben Daten,
dasselbe Bedienmuster. Touchziele über `touchStyle = { minHeight: "44px" }`
(Muster aus `NewIncidentForm.tsx`).

### `app/src/lib/roles.ts` (geprüft, unverändert übernommen)

`NAV_ITEMS`-Eintrag `{ href: "/bereitschaftsplan", label: "Bereitschaftsplan",
roles: ["admin", "disponent", "monteur"] }` — für alle Rollen sichtbar wie im
Auftrag verlangt, Bedienbarkeit steuert die Seite selbst.

### `app/test/auftrag10-bereitschaftsplan.test.mjs` (geprüft, unverändert übernommen, 19 Fälle)

Zwei Testarten: (1) Verhaltensnachweis der reinen Kalenderfunktionen aus
`date-local.ts` mit echten Assertions gegen konkrete Werte, inkl. Frühjahrs-
und Herbst-DST-Wechsel 2026 (29.03./25.10.) und der Grenzfälle „Umstellungstag
selbst" sowie „kurz nach Mitternacht am Folgetag"; (2) statischer Wächter für
die Staff-Allowlist in `on-call-plan-actions.ts` (exakte
`STAFF_ALLOWED_ROLES`-Zeichenkette, keine abweichende Negativliste als Code,
genau zwei Verwendungsstellen) sowie für `OnCallPlanClient.tsx` (Bedienelemente
ausschließlich bei `canEdit` gerendert).

### `app/test/auftrag7-hlk-anrufdaten.test.mjs` (von mir geändert — Regressionsfix)

Der bestehende Fall `'ci.yml: Schrittname nennt "Migrationen 0001-0020, Smokes
15-27"'` (aus AUFTRAG_7) schlug fehl, weil die bereits vorgefundene
AUFTRAG_10-Änderung an `ci.yml` den Schrittnamen wie im Auftrag verlangt auf
„Migrationen 0001-0021, Smokes 15-28" fortgeschrieben hat. Ich habe die
Erwartung dieses einen Falls auf den jetzt gültigen Wortlaut aktualisiert und
im Testkommentar offengelegt, dass die Zeichenkette durch künftige additive
Aufträge planmäßig weiterwandert (dieselbe Fortschreibungslogik, die auch die
Kettenreihenfolge in `run_db_tests.sh` je Auftrag fortschreibt). Kein anderer
Fall dieser Datei war betroffen.

**Testzahl-Änderung: Baseline 143 → neu 162 (+19 neue Fälle aus
`auftrag10-bereitschaftsplan.test.mjs`), alle grün.**

## Prüfergebnisse (tatsächlich erhoben, aus `app/`)

- `node ./node_modules/typescript/bin/tsc --noEmit --incremental false`:
  **Exit 0**.
- `node ./node_modules/eslint/bin/eslint.js` auf allen neuen/geänderten
  Dateien des Auftrags (`on-call-plan.ts`, `on-call-plan-actions.ts`,
  `date-local.ts`, `roles.ts`, `bereitschaftsplan/page.tsx`,
  `OnCallPlanClient.tsx`, `auftrag10-bereitschaftsplan.test.mjs`): **Exit 0**,
  keine Ausgabe. `eslint.js` zusätzlich einzeln auf
  `auftrag7-hlk-anrufdaten.test.mjs` (meine Regressionskorrektur): **Exit 0**.
- `node --test test/*.test.mjs`: **Exit 0, 162 Einträge, 162 pass, 0 fail, 0
  skipped, 0 cancelled** (vor meiner Korrektur: 162 Einträge, 161 pass, 1 fail
  — der oben beschriebene, jetzt behobene Regressionsfall).
- LF-normalisiertes `bash -n` auf `supabase/test/run_db_tests.sh` (`sed
  's/\r$//' supabase/test/run_db_tests.sh | bash -n /dev/stdin`): **Exit 0**.
- `npm run build`: **ein Versuch** (wie im Auftrag verlangt, nicht
  wiederholt) — Build-Fehler `EPERM: operation not permitted, unlink
  '…/.next/.fuse_hidden0000026d00000001'`. Identisches Bild wie in den
  Vorgängermeldungen dokumentiert: derselbe bekannte, umgebungsbedingte
  OneDrive-Mount-Blocker, keine neue Ursache. Lokale Gegenprüfung durch
  Dennis (`npm run dev`/`npm run build`) bleibt erforderlich.
- **SQL-Nachweis (Migration 0021, Smoke 28) konnte in dieser Sandbox NICHT
  gegen eine echte PostgreSQL-Instanz gelaufen werden** — kein `psql`/`createdb`
  verfügbar. Der Nachweis wird wie im Auftrag vorgesehen an den CI-Job
  `database` delegiert (Schritt „Datenbankprüfungen (Migrationen 0001-0021,
  Smokes 15-28, sechs Integrationssuiten)", `.github/workflows/ci.yml:174`).
  Ich habe die SQL-Dateien stattdessen inhaltlich geprüft (Lesen + Abgleich
  gegen den Auftrag und die Muster 0019/0020, 26/27) und keine Abweichung
  gefunden — das ersetzt den echten DB-Lauf nicht.

## Git-Status (nur eigener Umfang)

Nur lesende `git`-Befehle verwendet (`git status --porcelain`, `git diff -w
--stat`). Eine etwaige `.git/index.lock` wurde nicht angetroffen bzw. wäre
wie vorgegeben ignoriert worden.

`git status --porcelain` auf den für AUFTRAG_10 relevanten Pfaden:

```
 M .github/workflows/ci.yml
 M app/src/lib/date-local.ts
 M app/src/lib/roles.ts
 M app/supabase/test/run_ap14b_local.ps1
 M app/supabase/test/run_db_tests.sh
 M app/test/auftrag7-hlk-anrufdaten.test.mjs
?? 00-Projektsteuerung/AUFTRAG_10.md
?? app/src/app/(app)/bereitschaftsplan/
?? app/src/components/on-call-plan/
?? app/src/lib/on-call-plan-actions.ts
?? app/src/lib/on-call-plan.ts
?? app/supabase/migrations/0021_hlk_bereitschaftsplan.sql
?? app/supabase/test/28_hlk_bereitschaftsplan.sql
?? app/test/auftrag10-bereitschaftsplan.test.mjs
```

`git diff -w --stat` auf den sechs bereits vorgefundenen/von mir ergänzten
geänderten Dateien:

```
 .github/workflows/ci.yml                  |  2 +-
 app/src/lib/date-local.ts                 | 86 +++++++++++++++++++++++++++++
 app/src/lib/roles.ts                      |  3 ++
 app/supabase/test/run_ap14b_local.ps1     | 24 ++++++++-
 app/supabase/test/run_db_tests.sh         | 17 ++++++
 app/test/auftrag7-hlk-anrufdaten.test.mjs | 14 +++--
 6 files changed, 141 insertions(+), 5 deletions(-)
```

Der übrige Arbeitsbaum trägt weiterhin die aus den Vorgängermeldungen
bekannte, vorbestehende große Zahl von Änderungen außerhalb jedes
Auftragsumfangs (u. a. `.claude/`, `deploy/`, weite Teile von
`app/supabase/`) — diese wurden von mir **nicht** erzeugt und **nicht**
angefasst.

**Kein Commit, kein Push, kein Merge, kein Tag, keine Orchestrierung.** Der
Arbeitsbaum bleibt uncommitted zur Prüfung durch den Orchestrator/
Review-Chat.

## Statuspflege

`.claude/automation/status/fortschritt.json` liegt unter der laut Vorgabe
„nur der OneDrive-Vault"/keine `.claude/**`-Änderung ausdrücklich verbotenen
Negativliste und wurde deshalb **nicht** geändert — dieselbe Abwägung wie in
den Vorgängermeldungen bereits begründet und dort an den Orchestrator
zurückgemeldet.

## Stopppunkt

**Kein Stopppunkt ausgelöst.** Im Einzelnen geprüft:

- **technicians-Bestandsmodell:** `technicians(id, first_name, last_name, …)`
  trägt kein eigenes Aktiv-Kennzeichen als Spalte auf der Tabelle selbst;
  `getActiveTechnicians()` in `masterdata.ts` filtert stattdessen über den
  verknüpften Systembenutzer (`profiles.is_active`, sofern verknüpft) bzw.
  liefert alle Techniker ohne Profilverknüpfung als aktiv — dieses Verhalten
  war bereits vor AUFTRAG_10 etabliert und wird von der Seite unverändert
  wiederverwendet (`getActiveTechnicians()` als Datenquelle der
  Techniker-Select). Keine Unklarheit, die eine neue Entscheidung verlangt
  hätte.
- **Designfrage:** Die Wochenmatrix folgt 1:1 „wie die Excel-Matrix,
  schlichtestes Muster" — Mobilkarten sind das bereits bestehende
  Listen-Kartenmuster, keine neue Gestaltungsfrage.
- Kein Fehler ist auch nur zweimal aufgetreten: der einzige aufgetretene
  Fehlschlag (ci.yml-Regression in `auftrag7-hlk-anrufdaten.test.mjs`) wurde
  im ersten Korrekturversuch behoben und danach lief die gesamte Suite grün.
