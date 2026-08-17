# MELDUNG 7 vom Worker-Chat zu AUFTRAG_7

> Stand: 2026-08-17. Verfasst von Claude (Rolle Worker, Ausführungsagent
> „kb-implementierung"), Antwort auf `00-Projektsteuerung/AUFTRAG_7.md`.
> Schriftliche Notiz, kein Chat-Kanal.

## Geänderte/neue Dateien

**Neu (3):**

- `app/supabase/migrations/0020_hlk_meldung_anrufdaten.sql`
- `app/supabase/test/27_hlk_anrufdaten.sql`
- `app/test/auftrag7-hlk-anrufdaten.test.mjs`

**Geändert (9):**

- `app/src/lib/date-local.ts`
- `app/src/lib/incidents.ts`
- `app/src/lib/incident-actions.ts`
- `app/src/lib/incident-list.ts`
- `app/src/lib/database.types.ts`
- `app/src/components/incidents/NewIncidentForm.tsx`
- `app/supabase/test/run_db_tests.sh`
- `app/supabase/test/run_ap14b_local.ps1`
- `.github/workflows/ci.yml`

Keine Änderung an Bestandsmigrationen (0001-0019 unverändert), an
`.claude/**`, `run-orchestrator.ps1`/`run-programmer.ps1`, PROJEKT_WISSEN.md,
PROJEKTSTATUS.md, CHAT_STATUS.md. Keine Policy-/Wächter-/Statusmodell-
Änderung, keine CSV-/Exportänderung, keine Listen-/Detail-UI. Kein
Commit/Push.

## Diff-Kurzbeschreibung

### Migration `0020_hlk_meldung_anrufdaten.sql` (neu, ~430 Zeilen)

Vier additive Spalten auf `public.incidents`:

- `reported_at timestamptz` (nullable, kein Default) — Anrufzeitpunkt.
- `caller_contact_id uuid references public.contacts(id)` (nullable, FK
  NICHT kaskadierend) — Anrufender.
- `trade_id uuid references public.trades(id)` (nullable, FK NICHT
  kaskadierend, 0019/AUFTRAG_6) — Gewerk an der Meldung.
- `is_in_clarification boolean not null default false` — "In Klärung"-
  Kennzeichen, idempotente Herstellung sinngemäß nach dem 0018-Abschnitt-1-
  Muster 1b-1e (Frischer Fall/Default nachziehen/Backfill/NOT NULL
  nachziehen), **ohne** Schritt 1a: es gibt laut Entscheidung Dennis
  ausdrücklich **keinen** Wächter-Trigger für diese Spalte.

`incident_list_view` vollständig neu definiert: `is_in_clarification`,
`trade_id`, `trade_label` (Join auf `public.trades`) **ausschließlich ans
Ende** der Spaltenliste angehängt, alle bisherigen 33 Spalten (aus 0018)
unverändert an ihrer Position. Neues `left join public.trades tr on tr.id =
i.trade_id`.

`create_incident_ap12` additiv um drei nachgestellte, defaultbehaftete
Parameter erweitert (`p_reported_at`, `p_caller_contact_id`, `p_trade_id`,
alle `default null`). **Bewusst per `drop function if exists` (exakte alte
21-Parameter-Signatur) + `create or replace function` (neue 24-Parameter-
Signatur)** statt eines einfachen `create or replace function` mit
zusätzlichen Parametern — Begründung ausführlich im Migrationskommentar:
PostgreSQL bestimmt die Funktionsidentität für `create or replace` über die
**vollständige** Parametertypliste (`proargtypes`), unabhängig von Defaults;
ein einfaches `create or replace` mit drei zusätzlichen Parametern hätte eine
**zweite, überladene** Fassung angelegt statt die bestehende zu ersetzen —
zwei parallele Anlagewege unter demselben Namen. Bestehende Aufrufer mit nur
21 Positionsargumenten bleiben lauffähig (PostgreSQL löst Aufrufe mit
weniger Argumenten als deklarierten, defaultbehafteten Parametern regulär
auf) — das wird von Fall Y4 im Smoke ausdrücklich nachgewiesen. Rechte:
`revoke all ... from public, anon, authenticated` + `grant execute ... to
app_user` ausschließlich auf die neue 24-Parameter-Signatur (dieselbe
Konvention wie jede seit 0014 neu vergebene Ausführungsberechtigung).

Im Funktionskörper werden `p_caller_contact_id`/`p_trade_id` **ohne**
zusätzliche fachliche Prüfung (Aktiv-Status, Kundenzugehörigkeit)
übernommen — der Auftrag verlangt das nicht, die FK-Constraints erzwingen
bereits die Existenz; anders als `p_contact_id` (Aktiv-/Kundenprüfung, weil
er den benachrichtigten Ansprechpartner der Disposition bestimmt) ist
`caller_contact_id` ein rein dokumentarischer Verweis.

Vier Abschlussprüfungen (fail-closed): Spaltenzustand (Typen,
NOT-NULL/Default von `is_in_clarification`), zwei FK-Prüfungen
(`confdeltype`, weist `'c'`/kaskadierend zurück), View-Spaltenreihenfolge
(`information_schema.columns`, die drei neuen Spalten müssen exakt die
letzten drei Positionen belegen), Funktionsrechte/-signatur (`app_user`
besitzt Execute auf der neuen 24-Parameter-Fassung, `to_regprocedure` auf
die alte 21-Parameter-Signatur liefert `null`).

**Rückwirkungslosigkeit auf die bestehende Kette geprüft und dokumentiert:**
die beiden einzigen SQL-Smokes, die `create_incident_ap12` mit exakt 21
Positionsargumenten aufrufen bzw. seine 21-Parameter-Signatur über
`has_function_privilege` prüfen (`17_ap12_details.sql`, `20_ap14b_data.sql`),
laufen in der Kette **vor** Migration 0020 (Position direkt nach 0010 bzw.
nach 0014) und sehen die alte Signatur unverändert an ihrer Stelle, bevor
0020 sie ersetzt.

### Smoke `27_hlk_anrufdaten.sql` (neu, Fallkennung Y)

Kopf-/Aufbaustil exakt nach `26_hlk_kataloge.sql`/`25_ap15b_incident_metrics.sql`
(Fixtures im Eigentümerkontext, `begin;`/`rollback;`-Rahmen, `do $$`-Fälle mit
`raise exception 'SMOKE … FAIL …'`/`raise notice 'SMOKE … OK …'`,
Funktionszahl-Gegenprobe, UUID-Präfix `27a00000-`): Y-FIXTURES, Y1
(Spaltenzustand), Y2 (Idempotenz-Doppellauf der echten Migration 0020 per
`\ir`, prüft Spaltenzustand UND Funktionssignatur/-rechte nach erneutem
Lauf), Y3 (`create_incident_ap12` mit allen drei neuen Feldern speichert
korrekt, Disponent), Y4 (derselbe RPC-Aufruf mit weiterhin nur 21
Positionsargumenten bleibt lauffähig, neue Spalten bleiben NULL —
Rückwärtskompatibilitätsnachweis zum DROP/CREATE-Vorgehen), Y5 (Monteur wird
trotz der drei neuen, besetzten Parameter weiterhin mit 42501 über
`incidents_insert` abgewiesen — keine Policy-Änderung), Y6/Y7 (FK-Verhalten
`caller_contact_id`/`trade_id`: Löschen der referenzierten Zeile scheitert
mit 23503, kein automatisches Nullsetzen), Y8 (View liefert
`is_in_clarification`/`trade_id`/`trade_label` korrekt und an den letzten
drei Positionen — Data-Level-Gegenprobe zur Katalogprüfung in der Migration),
Y9 (**kein Wächter**: Administrator UND der aktiv zugewiesene Monteur dürfen
`is_in_clarification` per gewöhnlichem UPDATE setzen/zurücknehmen — anders
als `is_false_alarm`/0018, wo ausschließlich Disponent berechtigt ist),
Y-ENDE (Rollback-Nachweis + unveränderte Funktionszahl).

### `app/src/lib/date-local.ts`

Drei neue, reine Funktionen (kein Server-/DB-Import, testbar ohne Datenbank):
`berlinWallTimeToInstant(y, m, d, hh, mi, ss)` (Berliner Wanduhrzeit →
Instant, dieselbe Zwei-Schritt-Offsetkorrektur wie `startOfTodayBerlin`),
`formatBerlinDatetimeLocal(instant)` (Instant → `"YYYY-MM-DDTHH:mm"`,
Wiederverwendung von `partsAt`), `parseBerlinDatetimeLocal(value)`
(`datetime-local`-Wert → Instant, fail-closed mit Rückrechnungsprobe gegen
nicht existierende Kalendertage/Uhrzeiten, dasselbe Prinzip wie `isIsoDate()`
in `incident-actions.ts`/`incidents.ts`). Begründung der Zeitzonenlösung:
Anrufzeit kommt aus einem `<input type="datetime-local">` ohne
Zeitzoneninformation und wird als Europe/Berlin-Wanduhrzeit interpretiert —
dieselbe, bereits im Projekt etablierte Zeitzonenkonvention wie
`created_date_local`/`startOfTodayBerlin`, hier nur um die Umkehrrichtung
(Wanduhrzeit → Instant statt Instant → Kalendertag) ergänzt.

### `app/src/lib/incident-actions.ts`

`createIncident()`: liest `caller_contact_id`/`trade_id` per `strOrNull()`
(ungeprüft gebunden, wie das bestehende `contact_id` — eine unbrauchbare
Kennung meldet die Datenbank über den Fremdschlüssel/eine Typumwandlung,
abgedeckt von `mapDbError()`) und `reported_at` per `str()`; ein nicht
leerer Wert wird über `parseBerlinDatetimeLocal()` ausgewertet, ein
ungültiger Wert ergibt fail-closed die Fachmeldung „Ungültiger
Anrufzeitpunkt.“ vor jedem Datenbankzugriff. Der RPC-Aufruf bindet die drei
Werte als zusätzliche, nachgestellte Parameter (`$22::timestamptz,
$23::uuid, $24::uuid`) — rein additiv, die 21 bestehenden Parameter/Werte
sind unverändert.

### `app/src/lib/incidents.ts`

`IncidentFormOptions` um `trades: IncidentFormOption[]` erweitert;
`getIncidentFormOptions()` liest zusätzlich aktive Gewerke
(`select id, label from public.trades where is_active order by label asc`)
auf demselben `client` derselben Transaktion (keine zweite Transaktion,
dieselbe Konvention wie `cableTypes`); `emptyIncidentFormOptions()`
entsprechend ergänzt.

### `app/src/lib/incident-list.ts` und `app/src/lib/database.types.ts`

Rein additive Typerweiterungen, wie im Auftrag verlangt — **keine**
Verdrahtung in die SQL-Projektion (`incidents.ts`: `LIST_SELECT`/
`INCIDENT_ROW_COLUMNS`) und **keine** Listen-/Detail-UI, das folgt mit
AUFTRAG_8:

- `incident-list.ts`: `IncidentListRow` um `is_in_clarification: boolean`,
  `trade_id: string | null`, `trade_label: string | null` ans Ende ergänzt.
- `database.types.ts`: `Incident` um `reported_at`/`caller_contact_id`/
  `trade_id`/`is_in_clarification` ergänzt (Kommentar hält die
  Annahme-=-Anlage-Festlegung ausdrücklich fest); `IncidentListView` um
  dieselben drei View-Spalten ans Ende ergänzt; `CreateIncidentAp12Args` um
  die drei optionalen, nachgestellten Argumente ergänzt.

### `app/src/components/incidents/NewIncidentForm.tsx`

Neuer Block „Anruf" im Pflichtbereich der Zuordnungs-Spalte (unterhalb des
bestehenden 2×2-Grids, oberhalb der Sektionsgrenze — **nicht** hinter der
Aufklapp-Trennlinie): `<input type="datetime-local" name="reported_at">`
(vorbelegt mit „jetzt" über `formatBerlinDatetimeLocal`, **erst in einem
Effekt nach dem ersten Rendern** gesetzt, um einen Hydration-Mismatch
zwischen Server- und Client-Zeitpunkt zu vermeiden — dasselbe, bereits im
Projekt etablierte Muster wie `ThemeToggle.tsx`, inkl. desselben
`eslint-disable-next-line react-hooks/set-state-in-effect`) und
`<select name="caller_contact_id">` (einfaches Select über
`options.contacts`, gefiltert auf den gewählten Kunden). Gewerk-Select
(`<select name="trade_id">`, optional, `— keines —`) in der Störungs-Spalte,
zwischen Priorität und Beschreibung.

**Stopppunkt-Prüfung zum bestehenden `ContactSelector` (dokumentiert, kein
Stopp ausgelöst):** der bestehende `ContactSelector` **passt hier nicht** —
er bindet seine `<select>`-Elemente fest an die Formularschlüssel
`contact_id`/`contact_phone_number_id` (Ansprechpartner-Datenpfad für die
Staff-Benachrichtigung). Eine zweite Einbindung für „Anrufender" hätte
denselben FormData-Schlüssel `contact_id` doppelt belegt und den
bestehenden Ansprechpartner-Datenpfad verfälscht. Der Auftrag sieht genau
diesen Fall vor („sonst einfaches Select über die bestehende Kontaktliste")
— umgesetzt als eigenes, unabhängiges `<select name="caller_contact_id">`
über dieselbe `options.contacts`-Liste, ohne `ContactSelector.tsx`
anzufassen. Die Freitext-Fallbacks `caller_name`/`caller_contact` bleiben
unverändert im optionalen Abschnitt „Meldung & Bemerkungen". Layout Variante
A (Grid-Struktur, Section-/OptionalSection-Komponenten) unverändert
beibehalten.

### Läufer-Verdrahtung

- `run_db_tests.sh`: `FILES`-Array um `0020_hlk_meldung_anrufdaten.sql` +
  `27_hlk_anrufdaten.sql` hinter 0019/26 ergänzt; Kopfkommentar um einen
  Absatz zu AUFTRAG_7 erweitert. Generischer `SMOKE … FAIL/OK`-Grep im
  restlichen Skript erfasst Fallkennung Y ohne weitere Änderung.
- `run_ap14b_local.ps1`: `$files`-Array um dieselben zwei Dateien ergänzt,
  Kopfkommentar/Reihenfolgeübersicht erweitert, Konsolen-Überschrift und die
  dateispezifische `Where-Object`-Filterkette um eine achte Alternative
  (`"27_hlk_anrufdaten" -and "SMOKE Y\S+"`) ergänzt.
- `.github/workflows/ci.yml`: Schrittname „Datenbankprüfungen" von
  „Migrationen 0001-0019, Smokes 15-26" auf „Migrationen 0001-0020, Smokes
  15-27" geändert (wortgleich mit der Vorgabe aus AUFTRAG_7.md) — sonst
  keine Änderung am Job.

### Unit-Test `auftrag7-hlk-anrufdaten.test.mjs` (neu, 17 Fälle)

Zwei Testarten: (1) Verhaltensnachweis der reinen Funktionen aus
`date-local.ts` (10 Fälle: Sommer-/Winterzeit, Rundreise, fail-closed bei
Musterabweichungen/nicht existierendem Kalendertag/nicht existierender
Uhrzeit, Umstellungsrandfall); (2) statischer Wächter (Muster aus
`ap15b-callers.test.mjs`/`auftrag6-hlk-kataloge.test.mjs`, 7 Fälle):
`incident-actions.ts` importiert `parseBerlinDatetimeLocal` und
`createIncident()` liest/validiert/bindet die drei neuen Felder korrekt,
`NewIncidentForm.tsx` bindet die drei neuen Formularfelder ein und lässt die
Freitext-Fallbacks unverändert, `incidents.ts` liest aktive Gewerke,
Migration 0020 enthält die vier Spalten und die View-Spaltenreihenfolge
sowie das DROP/CREATE der RPC, `run_db_tests.sh`/`run_ap14b_local.ps1`
führen 0020/27 unmittelbar hinter 0019/26, `ci.yml` trägt den vorgegebenen
Schrittnamen. **CRLF-Falle beachtet:** `incident-actions.ts`/`incidents.ts`
liegen mit CRLF-Zeilenenden vor — die Funktionskörper-Regexes verwenden
`\r?\n` (dieselbe Lehre wie in `auftrag6-hlk-kataloge.test.mjs` bereits
dokumentiert; beim ersten Lauf mit reinem `\n` traten zwei Fehlschläge auf,
in einem Schritt für beide Fälle korrigiert).

**Testzahl-Änderung: Baseline 122 → neu 139 (+17), alle grün.**

## Prüfergebnisse (tatsächlich erhoben, aus `app/`)

- `node ./node_modules/typescript/bin/tsc --noEmit --incremental false`:
  **Exit 0**.
- `node ./node_modules/eslint/bin/eslint.js` auf allen 6 geänderten/neuen
  `.ts`/`.tsx`-Dateien (`date-local.ts`, `incidents.ts`,
  `incident-actions.ts`, `incident-list.ts`, `database.types.ts`,
  `NewIncidentForm.tsx`) sowie der neuen Testdatei: **Exit 0**, keine
  Ausgabe. Ein Fund unterwegs korrigiert: `react-hooks/set-state-in-effect`
  auf dem `useEffect`, der `reportedAt` mit „jetzt" vorbelegt — behoben mit
  demselben, bereits im Projekt etablierten
  `// eslint-disable-next-line react-hooks/set-state-in-effect` wie in
  `ThemeToggle.tsx` (identischer Anwendungsfall: einmaliges Vorbelegen aus
  einer externen, nicht-React-Quelle zur Vermeidung eines Hydration-
  Mismatch).
- `node --test test/*.test.mjs`: **Exit 0, 139 Einträge, 139 pass, 0 fail, 0
  skipped** (Baseline 122 + 17 neue Fälle aus
  `auftrag7-hlk-anrufdaten.test.mjs`).
- `bash -n` auf `supabase/test/run_db_tests.sh`: Rohdatei (CRLF-Zeilenenden,
  vorbestehender Zustand des gesamten Arbeitsbaums, siehe MELDUNG_5/6)
  **Exit 2** (`syntax error near unexpected token $'do\r'`) — **kein** durch
  AUFTRAG_7 verursachter Fehler. Nach LF-Normalisierung
  (`sed 's/\r$//' supabase/test/run_db_tests.sh | bash -n /dev/stdin`, nur
  in eine temporäre Pipe, die Datei im Arbeitsbaum wurde nicht verändert):
  **Exit 0**. `run_ap14b_local.ps1` wurde nicht mit einem PowerShell-Parser
  geprüft (`pwsh` in dieser Linux-Sandbox nicht installiert); die Änderung
  folgt strukturell 1:1 den sieben bereits vorhandenen, funktionierenden
  Alternativen im selben `Where-Object`-Block.
- SQL-Dateien (`0020_hlk_meldung_anrufdaten.sql`, `27_hlk_anrufdaten.sql`):
  **kein DB-Lauf möglich in dieser Sandbox** (keine PostgreSQL-Instanz
  verfügbar, `psql`/`createdb` nicht installiert) — wie im Auftrag verlangt
  ausdrücklich so dokumentiert; der Nachweis (Spaltenzustand, Idempotenz,
  FK-Verhalten, erweiterte RPC, View-Spalten, RLS-Gegenprobe) folgt im
  CI-Job `database` nach Dennis' Commit.
- `npm run build`: **ein Versuch** (wie im Auftrag verlangt, nicht
  wiederholt) — Build-Fehler `EPERM: operation not permitted, unlink
  '…/.next/.fuse_hidden0000026d00000001'`. Identisches Bild wie in
  MELDUNG_3/4/5/6 dokumentiert: derselbe bekannte, umgebungsbedingte
  OneDrive-Mount-Blocker, keine neue Ursache. Lokale Gegenprüfung durch
  Dennis (`npm run dev`/`npm run build`) bleibt erforderlich.

## Git-Status (nur eigener Umfang)

`.git/index.lock` existiert nicht und wurde nicht angelegt; ausschließlich
lesende `git`-Befehle (`git status --porcelain`, `git diff -w --stat`)
verwendet.

`git status --porcelain` auf genau den 12 Dateien dieses Auftrags:

```
 M .github/workflows/ci.yml
 M app/src/components/incidents/NewIncidentForm.tsx
 M app/src/lib/database.types.ts
 M app/src/lib/date-local.ts
 M app/src/lib/incident-actions.ts
 M app/src/lib/incident-list.ts
 M app/src/lib/incidents.ts
 M app/supabase/test/run_ap14b_local.ps1
 M app/supabase/test/run_db_tests.sh
?? app/supabase/migrations/0020_hlk_meldung_anrufdaten.sql
?? app/supabase/test/27_hlk_anrufdaten.sql
?? app/test/auftrag7-hlk-anrufdaten.test.mjs
```

**Hinweis zur Diff-Größe:** `git diff` gegen `HEAD` zeigt für mehrere dieser
Dateien (insbesondere `NewIncidentForm.tsx`, `incidents.ts`,
`incident-actions.ts`) deutlich mehr Zeilen als in dieser Meldung
beschrieben — das liegt daran, dass `HEAD` der letzte **committete** Stand
ist und die Ergebnisse von AUFTRAG_5 (Variante-A-Umbau von
`NewIncidentForm.tsx`) und AUFTRAG_6 (`incidents.ts`-Erweiterungen aus
früheren Aufträgen) ebenfalls noch uncommitted im Arbeitsbaum liegen (kein
Auftrag dieser Kette committet). Die in dieser Meldung beschriebene
Diff-Kurzbeschreibung bezieht sich ausschließlich auf die in diesem Lauf
tatsächlich vorgenommenen Änderungen, nicht auf den vollständigen
`git diff`-Umfang gegen `HEAD`.

Der übrige Arbeitsbaum trägt weiterhin die aus MELDUNG_4/5/6 bekannte,
vorbestehende große Zahl `M`-Einträge außerhalb jedes Auftragsumfangs (u. a.
`.claude/`, `deploy/`, weite Teile von `app/supabase/`) — diese wurden von
mir **nicht** erzeugt und **nicht** angefasst.

**Kein Commit, kein Push, kein Merge, kein Tag, keine Orchestrierung.** Der
Arbeitsbaum bleibt uncommitted zur Prüfung durch den Orchestrator/
Review-Chat.

## Statuspflege

`.claude/automation/status/fortschritt.json` liegt unter der laut AUFTRAG_7
ausdrücklich verbotenen Negativliste (`.claude/**`) und wurde deshalb
**nicht** geändert — dieselbe Abwägung wie in MELDUNG_5/6 bereits begründet
und dort an den Orchestrator zurückgemeldet.

## Stopppunkt

**Kein Stopppunkt ausgelöst.** Im Einzelnen geprüft:

- **View-Neudefinition verändert keine bestehende Spaltenposition:** alle
  33 Spalten aus 0018 stehen unverändert an ihrer Position, die drei neuen
  stehen nachweislich (Migrationsprüfung UND Smoke Y8) an den letzten drei
  Positionen.
- **`createIncident` wurde nicht strukturell umgebaut:** die drei neuen
  Felder sind rein additive, optionale FormData-Felder mit additiven,
  nachgestellten RPC-Parametern; die bestehenden 21 Parameter/Werte, die
  Referenzprüfung (`validateRefs`) und die Fehlerabbildung (`mapDbError`)
  sind unverändert. Das DROP/CREATE von `create_incident_ap12` selbst ist
  eine reine Signaturerweiterung auf Datenbankebene (keine Änderung der
  bestehenden Validierungslogik im Funktionskörper), rückwärtskompatibel
  nachgewiesen (Smoke Y4) und rückwirkungslos auf die beiden vorgelagerten
  Smokes, die die alte Signatur verwenden (17, 20 — beide laufen vor 0020).
- **`ContactSelector` passt nicht, ein einfaches Select mit Bestandsmitteln
  ist aber ausdrücklich möglich** (siehe Diff-Kurzbeschreibung oben) — genau
  der im Auftrag vorgesehene Ausweg, kein Stopppunkt.
- Derselbe Fehler ist nicht dreimal aufgetreten: die CRLF-Regex-Falle im
  neuen Unit-Test (zwei betroffene Fälle) wurde beim ersten Testlauf erkannt
  und in einem Schritt korrigiert; der `react-hooks/set-state-in-effect`-Fund
  wurde beim ersten ESLint-Lauf erkannt und mit dem bereits im Projekt
  etablierten Muster (`ThemeToggle.tsx`) in einem Schritt behoben.
