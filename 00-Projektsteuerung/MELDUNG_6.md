# MELDUNG 6 vom Worker-Chat zu AUFTRAG_6

> Stand: 2026-08-17. Verfasst von Claude (Rolle Worker, Ausführungsagent
> „kb-implementierung"), Antwort auf `00-Projektsteuerung/AUFTRAG_6.md`.
> Schriftliche Notiz, kein Chat-Kanal.

## Geänderte/neue Dateien

**Neu (9):**

- `app/supabase/migrations/0019_hlk_katalog_stammdaten.sql`
- `app/supabase/test/26_hlk_kataloge.sql`
- `app/src/app/(app)/stammdaten/gewerke/page.tsx`
- `app/src/app/(app)/stammdaten/funktionen/page.tsx`
- `app/src/app/(app)/stammdaten/objektarten/page.tsx`
- `app/src/components/masterdata/TradesClient.tsx`
- `app/src/components/masterdata/ContactFunctionsClient.tsx`
- `app/src/components/masterdata/ObjectTypesClient.tsx`
- `app/test/auftrag6-hlk-kataloge.test.mjs`

**Geändert (8):**

- `app/src/lib/masterdata.ts`
- `app/src/lib/masterdata-actions.ts`
- `app/src/lib/roles.ts`
- `app/src/components/masterdata/ContactsClient.tsx`
- `app/src/app/(app)/stammdaten/ansprechpartner/page.tsx`
- `app/supabase/test/run_db_tests.sh`
- `app/supabase/test/run_ap14b_local.ps1`
- `.github/workflows/ci.yml`

Keine Änderung an `incidents`-Pfaden, an bestehenden Migrationen (0001-0018
unverändert), an `.claude/**`, `run-orchestrator.ps1`/`run-programmer.ps1`,
PROJEKT_WISSEN.md, PROJEKTSTATUS.md, CHAT_STATUS.md. Kein Commit/Push.

## Diff-Kurzbeschreibung

### Migration `0019_hlk_katalog_stammdaten.sql` (neu, ~400 Zeilen)

Drei neue Tabellen nach dem Auftragswortlaut (`id`, `label`, `is_active` +
Audit-Spalten) — **bewusst ohne** `code`/`sort_order` wie `cable_types`: der
Auftrag zählt die Spalten der neuen Kataloge selbst auf und nennt genau diese
drei; `cable_types` dient nur als Stil-Vorbild (Audit-Trigger, RLS-Policy,
Grant-Formulierung), nicht als wörtliche Spaltenkopie. Diese Abweichung vom
1:1-Spaltenmuster ist durch den Auftragstext selbst vorgegeben, kein eigener
Entscheid, wird hier aber offengelegt.

- `public.trades` (Gewerke), Seed: 50 Hz, LST, TK, OSE, LWL-LST, LWL-TK,
  Unbekannt.
- `public.contact_functions` (Funktionen), Seed: BÜW, LBÜW, örtl. LST.
- `public.object_types` (Objektarten), Seed: BÜ, LSW.
- Je Tabelle: `create table if not exists`, `create or replace trigger` für
  `trg_touch_*`/`trg_audit_*` (Wiederverwendung von `tg_touch_updated()`/
  `tg_audit()`, unverändert), RLS aktiv, Einzel-Policy-Guard
  (`do $$ if not exists (select … pg_policies) …`, Stil aus
  `0008_ap10_incident_master_data.sql`/`0006_ap6_sync_idempotency.sql` statt
  des Bulk-Loops aus 0007) mit `*_select` (`app.current_user_id() is not
  null`) und `*_write` (`public.is_staff()`), Seed idempotent über
  `unique (label)` + `on conflict (label) do nothing`.
- `contacts.function_id`: `add column if not exists`, nullable FK auf
  `contact_functions(id)` ohne `on delete`-Klausel (= `NO ACTION`, damit
  nicht kaskadierend — dasselbe Muster wie
  `construction_stages.default_on_call_number_id`).
- Grants: `select, insert, update` an `app_user` auf allen drei Tabellen,
  **kein** `delete`.
- Abschluss: zwei fail-closed Prüfblöcke (Positiv-/Negativrechte, Stil
  0014/0015), eine RLS-/Policy-Katalogprüfung, eine Seed-Prüfung und eine
  FK-Prüfung (`confdeltype`, weist `'c'`/kaskadierend zurück).
- **Identitätsquelle bewusst geprüft und dokumentiert:** `auth.uid()`
  existiert seit `0013_ap14b_drop_supabase_compat.sql` nicht mehr (Schema
  `auth` gelöscht). Diese Migration verwendet deshalb durchgehend
  `app.current_user_id()` (0012) von Hand in jeder neuen Policy und jedem
  neuen Spalten-Default — das Laufzeit-Rewrite aus 0012 lief nur einmalig
  beim Anwenden von 0012 und erfasst keine später geschriebenen Objekte.
  `created_by`/`updated_by` verweisen auf `public.profiles(id)`, nicht mehr
  auf das entfernte `auth.users`.

### Smoke `26_hlk_kataloge.sql` (neu, Fallkennung X)

Kopf-/Aufbaustil exakt nach `25_ap15b_incident_metrics.sql` (Kopfkommentar,
Fixtures im Eigentümerkontext, `begin;`/`rollback;`-Rahmen, `do $$`-Fälle mit
`raise exception 'SMOKE … FAIL …'`/`raise notice 'SMOKE … OK …'`,
Funktionszahl-Gegenprobe): X-FIXTURES, X1 (Seeds vorhanden), X2
(Idempotenz-Doppellauf der echten Migration per `\ir`), X3 (Monteur liest),
X4 (Monteur schreibt nicht — 42501 auf allen drei Katalogen), X5 (Disponent
schreibt), X6 (Administrator schreibt — `is_staff()` unterscheidet anders als
der Fehlalarm-Wächter aus 0018 nicht zwischen beiden Rollen), X7 (app_user
besitzt kein `delete`-Tabellenrecht, auch Staff scheitert daran obwohl die
Policy `for all` es zuließe), X8 (FK-Verhalten `contacts.function_id`: Löschen
einer referenzierten Funktion scheitert mit 23503, kein automatisches
Nullsetzen, erst nach Entfernen des Ansprechpartners lösch­bar), X-ENDE
(Rollback-Nachweis + Seed-Fortbestand 7/3/2 + unveränderte Funktionszahl).

### Läufer-Verdrahtung

- `run_db_tests.sh`: `FILES`-Array um `0019_hlk_katalog_stammdaten.sql` +
  `26_hlk_kataloge.sql` hinter 0018/25 ergänzt; Kopfkommentar aktualisiert
  („…bis 0019“, neuer Absatz zu AUFTRAG_6). Generischer
  `SMOKE … FAIL/OK`-Grep im restlichen Skript erfasst Fallkennung X ohne
  weitere Änderung.
- `run_ap14b_local.ps1`: `$files`-Array um dieselben zwei Dateien ergänzt,
  Kopfkommentar erweitert, Konsolen-Überschrift und die dateispezifische
  `Where-Object`-Filterkette um eine siebte Alternative
  (`"26_hlk_kataloge" -and "SMOKE X\S+"`) ergänzt — ohne diese Alternative
  wäre der X-Nachweis im PowerShell-Konsolenauszug unsichtbar geblieben,
  exakt dieselbe Lehre wie bei den sechs vorherigen Smokes.
- `.github/workflows/ci.yml`: Schrittname „Datenbankprüfungen“ von
  „Migrationen 0001-0018, Smokes 15-25“ auf „Migrationen 0001-0019, Smokes
  15-26“ geändert — sonst keine Änderung am Job.

### `app/src/lib/masterdata.ts`

Neue Typen `TradeRow`/`ContactFunctionRow`/`ObjectTypeRow`
(`id`/`label`/`is_active`), neue Funktionen `listTrades`/
`getActiveTradeOptions`, `listContactFunctions`/
`getActiveContactFunctionOptions`, `listObjectTypes`/
`getActiveObjectTypeOptions` — exaktes Muster von `listCableTypes`
(`getSessionProfile` + `withUserTransaction`, `order by label asc` statt
`sort_order`/`name`, da keine Sortierspalte existiert). `ContactRow` um
`function_id`/`function_label` erweitert, `LIST_CONTACTS_SQL` um einen
zusätzlichen `left join public.contact_functions` ergänzt — das bestehende
Freitextfeld `function` bleibt unverändert.

### `app/src/lib/masterdata-actions.ts`

`saveTrade`/`setTradeActive`, `saveContactFunction`/
`setContactFunctionActive`, `saveObjectType`/`setObjectTypeActive` — exaktes
Muster von `saveCableType`/`setCableTypeActive` (dieselbe `requireStaff()`-
Allowlist, `withUserTransaction`, SQLSTATE-Klassifizierung über
`isPgError(error, PG_UNIQUE_VIOLATION)` mit eigenem deutschen Text,
ansonsten `saveErr(error)`). `revalidateMaster()` um die drei neuen Pfade
ergänzt. `saveContact()` liest zusätzlich `function_id` per `optionalUuid()`
(fail-closed bei nicht kanonischem Wert) und schreibt sie in
INSERT/UPDATE mit.

### `app/src/lib/roles.ts`

`NAV_GROUPS` → Gruppe „Stammdaten“ um drei Einträge ergänzt: „Gewerke“
(`/stammdaten/gewerke`), „Funktionen“ (`/stammdaten/funktionen“),
„Objektarten“ (`/stammdaten/objektarten`), jeweils für `admin`/`disponent`.

### Drei neue Pflegeseiten + Client-Komponenten

`stammdaten/gewerke`, `stammdaten/funktionen`, `stammdaten/objektarten`
jeweils `page.tsx` (Server Component, `requireSession()`-Gate wie
Kabelarten) + `*Client.tsx` (Client Component) — 1:1-Struktur von
`CableTypesClient.tsx`, aber nur ein Formularfeld „Bezeichnung“ (`label`)
statt Code/Name/Sortierung, da die Tabellenform laut Auftrag keine
Sortierspalte kennt.

### `ContactsClient.tsx` + `stammdaten/ansprechpartner/page.tsx`

Neues, optionales `<select name="function_id">` „Funktion (Katalog)“ neben
dem bestehenden Freitextfeld „Funktion“ — ergänzt es, ersetzt es nicht
(Auftragswortlaut). Die Seite lädt zusätzlich
`getActiveContactFunctionOptions()` und reicht sie als neue Pflicht-Prop
`functionOptions` durch.

### Unit-Test `auftrag6-hlk-kataloge.test.mjs` (neu, 7 Fälle)

Statischer Wächtertest nach dem Muster von `ap15b-callers.test.mjs`: prüft
Export der neuen Lese-/Schreibfunktionen, dass die drei neuen `save*`-
Aktionen die **bestehende Allowlist** `requireStaff()` nutzen und **keine**
eigene Negativliste (`role === "monteur"` o. ä.) einführen, dass `saveContact`
`function_id` liest und schreibt, dass `roles.ts` die drei Navigationseinträge
für admin **und** disponent führt, dass die drei Pflegeseiten ihre jeweilige
Lese-Funktion/Client-Komponente einbinden und dass `ContactsClient.tsx` das
neue `<select name="function_id">` trägt.

**Testzahl-Änderung: Baseline 115 → neu 122 (+7), alle grün.**

## Prüfergebnisse (tatsächlich erhoben, aus `app/`)

- `node ./node_modules/typescript/bin/tsc --noEmit --incremental false`:
  **Exit 0**.
- `node ./node_modules/eslint/bin/eslint.js` auf allen 11 neuen/geänderten
  `.ts`/`.tsx`-Dateien (masterdata.ts, masterdata-actions.ts, roles.ts, drei
  neue `page.tsx`, ansprechpartner/page.tsx, drei neue `*Client.tsx`,
  ContactsClient.tsx): **Exit 0**, keine Ausgabe.
- `node --test test/*.test.mjs`: **Exit 0, 122 Einträge, 122 pass, 0 fail, 0
  skipped** (Baseline 115 + 7 neue Fälle aus `auftrag6-hlk-kataloge.test.mjs`).
- `bash -n supabase/test/run_db_tests.sh` (Rohdatei, CRLF-Zeilenenden):
  **Exit 2**, Syntaxfehler bei `do\r`. Das ist **kein** durch AUFTRAG_6
  verursachter Fehler: die gesamte Datei liegt im Arbeitsbaum bereits
  CRLF-konvertiert vor (`git diff --stat` gegen HEAD zeigt 613
  Einfügungen/596 Löschungen für die ganze Datei, obwohl inhaltlich nur ~8
  Zeilen ergänzt wurden — bestätigt durch `git diff -w --stat`, das nach
  Herausrechnen der reinen Zeilenend-Unterschiede exakt 21 Einfügungen/2
  Löschungen zeigt). Diese CRLF-Konvertierung des gesamten Arbeitsbaums war
  bereits vor diesem Auftrag vorhanden (vgl. MELDUNG_5: „sehr große Zahl
  M-Einträge außerhalb des Auftragsumfangs … bereits vor diesem Auftrag
  vorhanden“) und wurde von mir **nicht** erzeugt. **Gegenprüfung, um die
  syntaktische Korrektheit der eigenen Ergänzung nachzuweisen:** nach
  Normalisierung auf LF (`sed 's/\r$//'`, nur in eine temporäre Kopie, die
  Datei im Arbeitsbaum wurde nicht verändert) meldet `bash -n` **Exit 0**.
  Ebenso meldet `bash -n` auf der von `git show HEAD:…` gelesenen
  (LF-)Fassung **Exit 0**. Die eigene Ergänzung ist damit syntaktisch
  nachgewiesen fehlerfrei; der rohe `bash -n`-Exitcode auf der Arbeitsbaum-
  Datei bleibt wegen der vorbestehenden CRLF-Konvertierung 2.
- SQL-Dateien (`0019_hlk_katalog_stammdaten.sql`, `26_hlk_kataloge.sql`):
  **kein DB-Lauf möglich in dieser Sandbox** (keine PostgreSQL-Instanz
  verfügbar) — wie im Auftrag verlangt ausdrücklich so dokumentiert; der
  Nachweis (Idempotenz-Doppellauf, Seeds, Rollenmatrix, FK-Verhalten) folgt
  im CI-Job `database` nach Dennis' Commit.
  `run_ap14b_local.ps1` wurde nicht mit einem PowerShell-Parser geprüft (in
  dieser Linux-Sandbox nicht verfügbar); die Änderung folgt strukturell
  1:1 den sechs bereits vorhandenen, funktionierenden Alternativen im selben
  `Where-Object`-Block.
- `npm run build`: **ein Versuch** (wie im Auftrag verlangt, nicht
  wiederholt) — **Exit 1**, `Error: EPERM: operation not permitted, unlink
  '…/.next/.fuse_hidden0000026d00000001'`. Identisches Bild wie in
  MELDUNG_3/4/5 dokumentiert: derselbe bekannte, umgebungsbedingte
  OneDrive-Mount-Blocker, keine neue Ursache. Lokale Gegenprüfung durch
  Dennis (`npm run dev`) bleibt erforderlich.

## Git-Status (nur eigener Umfang)

`.git/index.lock` existiert **nicht** (per `ls` geprüft); `git status`/
`git diff` melden dabei die Warnung „unable to unlink … index.lock:
Operation not permitted“ (Dateisystem-Restriktion beim Versuch, eine
interne Sperrdatei anzulegen) — das ist keine vorhandene Sperre, wurde
ignoriert und **nicht** gelöscht, wie im Auftrag verlangt. Ausschließlich
lesende `git`-Befehle (`git status --porcelain`, `git diff -w --stat`,
`git show HEAD:…`) verwendet.

`git status --porcelain` auf genau den 17 Dateien dieses Auftrags:

```
 M .github/workflows/ci.yml
 M app/src/app/(app)/stammdaten/ansprechpartner/page.tsx
 M app/src/components/masterdata/ContactsClient.tsx
 M app/src/lib/masterdata-actions.ts
 M app/src/lib/masterdata.ts
 M app/src/lib/roles.ts
 M app/supabase/test/run_ap14b_local.ps1
 M app/supabase/test/run_db_tests.sh
?? app/src/app/(app)/stammdaten/funktionen/page.tsx
?? app/src/app/(app)/stammdaten/gewerke/page.tsx
?? app/src/app/(app)/stammdaten/objektarten/page.tsx
?? app/src/components/masterdata/ContactFunctionsClient.tsx
?? app/src/components/masterdata/ObjectTypesClient.tsx
?? app/src/components/masterdata/TradesClient.tsx
?? app/supabase/migrations/0019_hlk_katalog_stammdaten.sql
?? app/supabase/test/26_hlk_kataloge.sql
?? app/test/auftrag6-hlk-kataloge.test.mjs
```

Der übrige Arbeitsbaum trägt weiterhin die aus MELDUNG_4/MELDUNG_5 bekannte,
vorbestehende große Zahl `M`-Einträge außerhalb jedes Auftragsumfangs
(u. a. `.claude/`, `deploy/`, weite Teile von `app/supabase/`) — diese wurden
von mir **nicht** erzeugt und **nicht** angefasst.

**Kein Commit, kein Push, kein Merge, kein Tag, keine Orchestrierung.** Der
Arbeitsbaum bleibt uncommitted zur Prüfung durch den Orchestrator/
Review-Chat.

## Statuspflege

`.claude/automation/status/fortschritt.json` liegt unter der laut AUFTRAG_6
ausdrücklich verbotenen Negativliste (`.claude/**`) und wurde deshalb
**nicht** geändert — dieselbe Abwägung wie in MELDUNG_5 bereits begründet
und dort an den Orchestrator zurückgemeldet.

## Stopppunkt

**Kein Stopppunkt ausgelöst.** Das cable_types-Muster war für Trigger,
RLS-Formulierung und Grant-Stil 1:1 übertragbar; die einzige Abweichung
(keine `code`/`sort_order`-Spalten) ist durch den Auftragswortlaut selbst
vorgegeben (er zählt die Zielspalten der drei neuen Kataloge ausdrücklich
mit `id, label, is_active` auf) und keine eigene Auslegung. Die einzige
offene RLS-/Rechtefrage — ob „schreiben Staff“ admin **und** disponent
gleichrangig meint oder wie beim Fehlalarm-Wächter aus 0018 auf eine engere
Rolle beschränkt sein soll — ist durch den Bestand eindeutig beantwortet:
`cable_types_write` und alle übrigen `*_write`-Policies seit 0007 verwenden
durchgehend `is_staff()` ohne Sonderfall; eine engere Regel wäre eine neue
fachliche Entscheidung, die der Auftrag nicht verlangt. Derselbe Fehler ist
nicht dreimal aufgetreten (die CRLF-Regex-Falle im neuen Unit-Test wurde
beim ersten Lauf erkannt und in einem Schritt für alle drei betroffenen
Fälle korrigiert, kein wiederholtes Scheitern).
