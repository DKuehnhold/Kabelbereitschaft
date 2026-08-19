# MELDUNG 16 vom Worker-Chat zu AUFTRAG_16

> Stand: 2026-08-18. Verfasst von Claude (Rolle Worker, Ausführungsagent),
> Antwort auf `00-Projektsteuerung/AUFTRAG_16.md`. Schriftliche Notiz, kein
> Chat-Kanal.

## Ergebnis in Kürze

`/stammdaten` als neue Übersichtsseite umgesetzt: ein Akkordeon
(`type="multiple"`, alle Abschnitte beim Aufruf zugeklappt) mit den 13
Stammdatenarten in der von Dennis vorgegebenen Reihenfolge (VzG-Strecken,
Bauabschnitte, Ansprechpartner, danach die bestehende Reihenfolge aus
`lib/roles.ts`). Jeder Abschnitt bindet dieselbe Client-Komponente mit
denselben Props wie die zugehörige Einzelseite ein und trägt einen Link
„Einzelseite öffnen" auf die unverändert bestehende Route. Neue
Copy-in-Komponente `accordion.tsx` im Stil von `collapsible.tsx`/`button.tsx`
(Import aus dem bereits vorhandenen `radix-ui`-Meta-Paket, ausschließlich
AP8-Tokens, sichtbarer Fokusring, Dark Mode über bestehende `dark:`-Variante).
`roles.ts` um genau einen neuen Eintrag (`/stammdaten`, erstes Element der
Stammdaten-Gruppe) ergänzt, die 13 bestehenden Einträge zeichengleich
belassen. Statischer Wächtertest mit 4 Fällen geschrieben. Die 13
Einzelseiten und die 13 Client-Komponenten (inkl. `shared.tsx`,
`masterdata.ts`, `masterdata-actions.ts`) wurden **nicht** angefasst. `tsc`
und die Unit-Tests laufen grün. Kein Stopppunkt ausgelöst.

## Geänderte/neue Dateien (Positivliste, vollständig)

**Neu (3):**

- `app/src/components/ui/shadcn/accordion.tsx`
- `app/src/app/(app)/stammdaten/page.tsx`
- `app/test/auftrag16-stammdaten-akkordeon.test.mjs`

**Geändert (1):**

- `app/src/lib/roles.ts` — genau ein neuer Eintrag
  `{ href: "/stammdaten", label: "Stammdaten (Übersicht)", roles: ["admin","disponent"] }`
  als erstes Element der Stammdaten-Gruppe (`NAV_GROUPS`). Die 13 bestehenden
  Einträge sind zeichengleich erhalten, keine Umsortierung/Umbenennung/
  Entfernung.

Damit genau **vier** Dateien der Positivliste (3 neu, 1 geändert) — keine
weitere Datei wurde von mir erzeugt oder geändert (Ausnahme: eine
Umgebungsnebenwirkung, siehe „Offene Risiken" unten).

Die 13 bestehenden `stammdaten/*/page.tsx` und die 13 Client-Komponenten unter
`app/src/components/masterdata/` (inkl. `shared.tsx`) sowie
`app/src/lib/masterdata.ts`/`masterdata-actions.ts` erscheinen **nicht** in
meinem Diff (per `git status --porcelain` geprüft).

## Vollständige Liste der geladenen Datenquellen (`/stammdaten/page.tsx`)

Eine gemeinsame `Promise.all`-Ladung, Vereinigung der 13 Einzelseiten-Blöcke
(alle 13 Einzelseiten wurden dafür gelesen):

| Funktion | Herkunftsseite(n) | Mehrfach verwendet? |
| --- | --- | --- |
| `listVzgLines()` | vzg | nein |
| `getActiveStageOptions()` | vzg, ansprechpartner | **ja — 2×** (vzg, ansprechpartner) |
| `listStages()` | bauabschnitte | nein |
| `getActiveOnCallOptions()` | bauabschnitte, einstellungen | **ja — 2×** (bauabschnitte, einstellungen) |
| `listContacts()` | ansprechpartner | nein |
| `getActiveCustomers()` | ansprechpartner, einstellungen | **ja — 2×** (ansprechpartner, einstellungen) |
| `getActiveContactFunctionOptions()` | ansprechpartner | nein |
| `listCustomers()` | kunden | nein (bewusst getrennt von `getActiveCustomers()` — andere Datenmenge, alle vs. aktive) |
| `listTechnicians()` | monteure | nein |
| `listProfileOptions()` | monteure | nein |
| `listQualifications()` | monteure, qualifikationen | **ja — 2×** (monteure, qualifikationen) |
| `listTechnicianQualificationLinks()` | monteure | nein |
| `listTeams()` | teams | nein |
| `getActiveTechnicians()` | teams | nein |
| `listCableTypes()` | kabelarten | nein |
| `listTrades()` | gewerke | nein |
| `listContactFunctions()` | funktionen | nein |
| `listObjectTypes()` | objektarten | nein |
| `listOnCallNumbers()` | bereitschaftsnummern | nein |
| `getAppSettings()` | einstellungen | nein |

20 Aufrufe insgesamt, davon 4 mehrfach verwendete Optionslisten
(`getActiveStageOptions`, `getActiveOnCallOptions`, `getActiveCustomers`,
`listQualifications`) — jede davon genau einmal geladen und an alle
betroffenen Abschnitte weitergereicht (z. B. `stageOptions` an VzG-Strecken
UND Ansprechpartner). Die abgeleiteten Werte `qualificationIdsByTechnician`
(Monteure) und `technicianOptions` (Teams) werden wie auf den Einzelseiten
aus den geladenen Rohdaten berechnet, nicht separat geladen.

## Prüfergebnisse (tatsächlich erhoben, aus `app/`)

- `npx tsc --noEmit`: **Exit 0**, keine Ausgabe (nur die npm-Versionshinweis-
  Zeilen von `npm notice`, keine Diagnosezeilen).
- `node --test test/*.test.mjs`: **Exit 0, 181 Einträge, 181 pass, 0 fail, 0
  skipped, 0 cancelled.** Baseline 177 → **neu 181** (+4, alle vier in
  `auftrag16-stammdaten-akkordeon.test.mjs`; kein bestehender Testfall
  verändert oder entfernt).
- `grep -c $'\r'` auf allen drei neuen Dateien: **jeweils 0** (LF, kein
  zusätzlicher CRLF-Eintrag im ohnehin offenen CRLF-Problem).
- `npm run build` und ESLint: **nicht ausgeführt** (laut Auftrag in dieser
  Umgebung nicht möglich, OneDrive-/FUSE-Mount) — keine Behauptung dazu.
- Kein PostgreSQL verfügbar — keine Datenbanknachweise erhoben oder behauptet
  (dieser Auftrag ändert ohnehin keine SQL/Migrationen).

## Wächtertest (`auftrag16-stammdaten-akkordeon.test.mjs`, 4 Fälle)

1. Alle 13 Client-Komponenten sind aus `@/components/masterdata/<Name>`
   importiert und genau 1× als JSX-Tag verwendet (kein Import ohne
   Verwendung, keine fehlt).
2. Die Reihenfolge der 13 `<Komponente ...>`-Vorkommen im Quelltext
   entspricht exakt der AUFTRAG_16-Tabelle (Positionsvergleich per
   `indexOf`/`search`, sodass ein späteres stilles Umsortieren rot wird).
3. Das Rollengate `session.role !== "admin" && session.role !== "disponent"`
   ist vorhanden und steht textlich **vor** dem `await Promise.all([`-Block;
   zusätzlich `export const dynamic = "force-dynamic";` geprüft.
4. `roles.ts`: der neue Eintrag `/stammdaten` steht als erstes Element der
   Stammdaten-Gruppe, alle 13 Einzelrouten sind weiterhin vorhanden, und die
   Gruppe hat genau 14 Einträge (1 Übersicht + 13 Einzelrouten) — kein
   zusätzlicher, kein fehlender.

Ausdrücklich ein statischer Wächter (Textprüfung), kein Verhaltensnachweis
(kein Render/JSDOM in dieser Sandbox vorgesehen).

## Stilentscheidungen `accordion.tsx`

- Copy-in-Muster identisch zu `collapsible.tsx`: `"use client"`, Import
  `{ Accordion as AccordionPrimitive } from "radix-ui"` (bereits vorhandenes
  Meta-Paket, keine neue Abhängigkeit, `package.json`/`package-lock.json`
  unverändert).
- `AccordionTrigger` nutzt denselben Fokusring wie `button.tsx`
  (`focus-visible:border-ring focus-visible:ring-[3px]
  focus-visible:ring-ring/50`) und dieselben Farbtokens (`text-muted-foreground`,
  `text-foreground` usw.) — keine neuen Farbwerte, keine Hex-Literale,
  `globals.css` unverändert.
- Auf-/Zuklapp-Animation über `animate-accordion-down`/`-up`: diese
  Utilities kommen bereits aus dem in `globals.css` importierten Paket
  `tw-animate-css` (Zeile 5, `@import "tw-animate-css"`, seit AUFTRAG_3 für
  `dialog.tsx`/`select.tsx`) — keine neuen Keyframes ergänzt.
- Chevron-Icon `ChevronDownIcon` aus `lucide-react` (bereits Abhängigkeit,
  bereits in `select.tsx` verwendet).

## Geprüfte Stopppunkt-Kriterien (alle unauffällig, kein Stopp ausgelöst)

- **DOM-Kollisionen zwischen den 13 Client-Komponenten:** geprüft (alle
  `id`/`htmlFor`-Attribute in `components/masterdata/*.tsx` durchsucht).
  Jede Komponente, die Formularfeld-IDs vergibt, nutzt ein eigenes,
  unverwechselbares Präfix (`ct_`, `cf_`, `k_`, `c_`, `ot_`, `oc_`, `qual_`,
  `set_`, `s_`); `TeamsClient`, `TechniciansClient`, `TradesClient`,
  `VzgLinesClient` vergeben gar keine statischen IDs. Bei gleichzeitig
  geöffneten Abschnitten (möglich, da `type="multiple"`) entstehen keine
  doppelten IDs oder Formularfeldnamen.
- **Unbegrenzte Listen (Verdacht Ansprechpartner/Monteure):** `listContacts()`
  und `listTechnicians()` in `masterdata.ts` haben **kein** `LIMIT` — das ist
  jedoch identisch zum bisherigen Zustand der Einzelseiten (`stammdaten/
  ansprechpartner/page.tsx` und `stammdaten/monteure/page.tsx` riefen dieselben
  Funktionen bereits ungebremst auf). Dieser Auftrag führt also **kein neues**
  Skalierungsrisiko ein, verlagert aber auch keins — siehe „Offene Risiken".
- **`tsc`/Bestandstests:** `tsc --noEmit` Exit 0, alle 177 Bestandstests
  weiterhin grün (siehe Prüfergebnisse oben).
- **Wiederholter Fehler:** keiner ist auch nur zweimal identisch aufgetreten.

## Offene Risiken

1. **Datenmenge Ansprechpartner/Monteure auf der Sammelseite.** `/stammdaten`
   lädt jetzt zusätzlich zu den bereits bestehenden Einzelseiten dieselben
   ungebremsten Listen (`listContacts()`, `listTechnicians()`) — das ist kein
   neu eingeführtes Risiko (siehe oben), aber die Sammelseite macht die
   Summe aller 20 Ladeaufrufe auf einmal sichtbar/spürbar. Sollte die
   Datenmenge real wachsen, wäre eine spätere Paginierung/Begrenzung eine
   eigene Entscheidung — laut Auftrag ausdrücklich **nicht** eigenmächtig
   vorgenommen.
2. **Layout/Optik ungeprüft im Browser.** `npm run build` und ein visueller
   Test sind in dieser Sandbox nicht möglich; die Flex-Anordnung von Titel/
   Untertitel/„Einzelseite öffnen"-Link in `AccordionSection` (page.tsx) ist
   nur gegen `tsc` und die vorhandenen Tokens geprüft, nicht gerendert
   gesehen. Eine kurze Sichtprüfung durch Dennis in der laufenden App wird
   empfohlen.
3. **Umgebungsnebenwirkung (kein Auftragsbestandteil):** Beim Ermitteln der
   Testergebnisse ist wegen fehlendem Schreibzugriff auf `/tmp` versehentlich
   die Datei `app/testout.log` in diesem Arbeitsbaum entstanden. Sie wurde
   auf 0 Byte geleert, konnte aber wegen derselben OneDrive-/FUSE-Beschränkung,
   die laut Auftrag auch `npm run build`/ESLint verhindert (`EPERM` beim
   Löschen/Umbenennen), **nicht entfernt** werden. Sie gehört **nicht** zur
   Positivliste dieses Auftrags und enthält keine Nutzdaten (0 Byte). Bitte
   außerhalb dieser Sandbox (z. B. im Windows-Explorer) manuell löschen.

## Git-Status (nur eigener Umfang, nur lesende Befehle)

Eigener Umfang (Positivliste, 4 Dateien):

```
 M app/src/lib/roles.ts
?? app/src/app/(app)/stammdaten/page.tsx
?? app/src/components/ui/shadcn/accordion.tsx
?? app/test/auftrag16-stammdaten-akkordeon.test.mjs
```

Zusätzlich (Umgebungsnebenwirkung, siehe „Offene Risiken" Punkt 3, nicht
Teil der Positivliste, nicht durch mich beabsichtigt):

```
?? app/testout.log   (0 Byte, konnte wegen OneDrive-/FUSE-EPERM nicht gelöscht werden)
```

Der komplette `git status --porcelain` weist daneben eine sehr große Zahl
bereits vorbestehender, unverändert von mir gelassener Änderungen aus
AUFTRAG_11–14 und der CRLF-Umstellung aus (u. a. `.claude/**`, `app/supabase/**`,
`.github/workflows/**`, sowie – bereits vor diesem Auftrag als `M`/`??`
sichtbar – `app/src/app/(app)/stammdaten/monteure/page.tsx`,
`app/src/components/masterdata/TechniciansClient.tsx`,
`app/src/components/masterdata/QualificationsClient.tsx`,
`app/src/app/(app)/stammdaten/qualifikationen/`). Diese wurden von mir
**nicht** erzeugt und **nicht** angefasst; laut Auftrag wird der eigene
Umfang ausschließlich anhand der oben genannten vier Dateien beurteilt.

**Kein Commit, kein Push, kein Merge, kein Tag, kein Rebase, kein Reset,
kein Stash.** Nur lesende `git`-Befehle (`git status`) wurden verwendet. Der
Arbeitsbaum bleibt uncommitted zur Prüfung durch den Orchestrator/
Review-Chat.

## Statuspflege

`.claude/automation/status/fortschritt.json` liegt unter der Negativliste
(kein `.claude/**`) und wurde deshalb **nicht** geändert — dieselbe Abwägung
wie in MELDUNG_14.md.

## Stopppunkt

**Kein Stopppunkt ausgelöst.** Im Einzelnen begründet siehe Abschnitt
„Geprüfte Stopppunkt-Kriterien" oben.
