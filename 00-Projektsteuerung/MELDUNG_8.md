# MELDUNG 8 vom Worker-Chat zu AUFTRAG_8

> Stand: 2026-08-17. Verfasst von Claude (Rolle Worker, Ausführungsagent
> „kb-implementierung"), Antwort auf `00-Projektsteuerung/AUFTRAG_8.md`.
> Schriftliche Notiz, kein Chat-Kanal.

## Geänderte/neue Dateien

**Neu (1):**

- `app/test/auftrag8-klaerung-list-url.test.mjs`

**Geändert (8):**

- `app/src/lib/incident-list.ts`
- `app/src/lib/incident-list-url.ts`
- `app/src/lib/incidents.ts`
- `app/src/lib/incident-actions.ts`
- `app/src/lib/roles.ts`
- `app/src/components/incidents/IncidentControls.tsx`
- `app/src/components/incidents/list/OperationalList.tsx`
- `app/src/app/(app)/vorgaenge/page.tsx`

Keine Migration/SQL, keine Policy-Änderung, keine CSV-/Exportänderung, keine
Statusmodell-Änderung, keine Routenänderung. Keine Änderung an `.claude/**`,
Läufern, CI, PROJEKT_WISSEN.md, PROJEKTSTATUS.md, CHAT_STATUS.md. Kein
Commit/Push.

## Diff-Kurzbeschreibung

### `app/src/lib/incident-list.ts`

`IncidentListFilters` um `inClarification?: boolean` ergänzt (exakter
Kommentar-/Musterstil wie `falseAlarm`). Der Kommentar an `IncidentListRow`
(`is_in_clarification`/`trade_id`/`trade_label`, additiv aus AUFTRAG_7) wurde
aktualisiert: die dort angekündigte Verdrahtung „folgt mit AUFTRAG_8" ist jetzt
vollzogen, keine Typänderung nötig (Typen waren bereits vollständig additiv
erweitert).

### `app/src/lib/incident-list-url.ts`

`klaerung=1|0` exakt nach dem `fehlalarm`-Muster ergänzt: `parseIncidentListQuery`
liest `get("klaerung")` in `filters.inClarification` (`"1"` → `true`, `"0"` →
`false`, sonst `undefined`); `buildIncidentListParams` schreibt denselben Wert
über `set("klaerung", …)` direkt hinter `fehlalarm` zurück. Bestehende
Parameter/Reihenfolge unverändert (rein additiv).

### `app/src/lib/incidents.ts`

- `LIST_SELECT`: additiv um `is_in_clarification, trade_id, trade_label` aus
  `incident_list_view` (Migration 0020) ergänzt — ohne diese Erweiterung wären
  die drei seit AUFTRAG_7 typisierten Felder in den zurückgegebenen Zeilen
  `undefined` gewesen.
- `fetchList()`: Vorabtypprüfung `if (f.inClarification !== undefined &&
  typeof f.inClarification !== "boolean") return { rows: [], total: 0 }`
  unmittelbar nach der bestehenden Fehlalarm-Prüfung (identisches Risiko:
  22P02 bei Nicht-Booleschem, stille Dauer-Unwahrheit bei SQL-`NULL`) sowie die
  Filterbedingung `is_in_clarification = $n::boolean`, exakt nach dem
  `falseAlarm`-Muster.
- `IncidentRow` (Detail-Projektion) um `is_in_clarification: boolean` ergänzt;
  `INCIDENT_ROW_COLUMNS` um `i.is_in_clarification` ergänzt — nötig, damit
  `IncidentControls.tsx` den aktuellen Wert anzeigen/umschalten kann (dieselbe
  Notwendigkeit wie seinerzeit bei `is_false_alarm`/AP15B).
- Neue Funktion `setIncidentInClarification(incidentId, value)`: exaktes
  Muster von `setIncidentFalseAlarm` (`withUserTransaction`, ein
  parametrisiertes `update … set is_in_clarification = $2::boolean where id =
  $1::uuid returning id`, SQLSTATE-Klassifizierung `42501` →
  Fachmeldung „Sie dürfen die „In Klärung"-Kennzeichnung für diese Meldung
  nicht ändern."). Unterschied zu `setIncidentFalseAlarm` ausdrücklich im
  Kommentar festgehalten: **kein** zusätzlicher Datenbank-Wächter (0018 kennt
  `tg_incident_guard_false_alarm`, 0020 ausdrücklich nicht) — `42501` deckt
  hier ausschließlich eine RLS-Verweigerung ab, keine Rollen-Sonderregel.

### `app/src/lib/incident-actions.ts`

Neue Server-Action `setInClarification(fd)`: liest `id`/`value` wie
`setFalseAlarm`, ruft `setIncidentInClarification()` auf und verwirft ihr
`FormState` bewusst (identisches Muster, void-Aktion). **Einziger fachlicher
Unterschied zu `setFalseAlarm`:** keine vorgelagerte Rollenprüfung
(`session.role !== "disponent"` entfällt) — Entscheidung Dennis (AUFTRAG_8):
setzbar von jedem, der die Meldung per RLS ändern darf, die Policy
`incidents_update` entscheidet.

### `app/src/components/incidents/IncidentControls.tsx`

Neuer Umschalter-Block direkt unter dem bestehenden, weiterhin
`role === "disponent"`-gebundenen Fehlalarm-Block, aber **ohne** eigene
Rollenbedingung (unconditional gerendert): identische Formstruktur (`<input
type="hidden" name="id">`, `<input type="hidden" name="value">` mit
umgekehrtem Zielwert, Statusanzeige „In Klärung: Ja/Nein", Umschaltbutton),
gebunden an die neue Action `setInClarification`.

### `app/src/components/incidents/list/OperationalList.tsx`

- **Filter:** neuer `Segmented`-Filter „In Klärung" (Alle/Ja/Nein) exakt nach
  dem Fehlalarm-Segmented, neuer Filter-Chip „In Klärung: Ja/Nein" exakt nach
  dem Fehlalarm-Chip.
- **Zeilen-Badge (dezent):** neue Spalte „In Klärung" in der Desktop-Tabelle
  (`<Badge tone="info">In Klärung</Badge>` bei `true`, sonst „—" — dieselbe
  Struktur wie die bestehende „Offene Aufgabe"-Spalte, aber Ton `info` statt
  `warning`, da es sich um ein neutrales Kennzeichen und nicht um eine Warnung
  handelt); in der Mobile-Karte wird der Badge zusammen mit „Offene Aufgabe"
  bedingt gerendert.
- **Gewerk-Spalte:** neue Spalte „Gewerk" in der Desktop-Tabelle
  (`{r.trade_label ?? "–"}`) sowie eine eigene Zeile „Gewerk: …" in der
  Mobile-Karte. Kein Filter dazu (wie im Auftrag verlangt).
- `colSpan` der „Keine Meldungen gefunden."-Zeile von 16 auf 18 angepasst (zwei
  neue Spalten: Gewerk, In Klärung).
- **Label:** „Keine Vorgänge gefunden." → „Keine Meldungen gefunden." (Desktop-
  und Mobile-Leertext).

### `app/src/app/(app)/vorgaenge/page.tsx`

Sichtbare Labels: `title="Vorgänge"` → `title="Meldungen"`,
`+ Vorgang anlegen` → `+ Meldung anlegen`. `subtitle="Operative Arbeitsliste"`
unverändert (enthält den Begriff „Vorgang" nicht). Route/Pfad (`/vorgaenge`,
`/vorgaenge/neu`) unverändert — nur Anzeigetexte.

### `app/src/lib/roles.ts`

Navigationslabels der beiden `/vorgaenge`-Einträge geändert: `"Vorgänge"` →
`"Meldungen"`, `"Vorgang anlegen"` → `"Meldung anlegen"` (`href` unverändert).
**Offenlegung wie im Auftrag verlangt:** diese Einträge sind reiner
Anzeigetext (`NavItem.label`, gerendert von `NavLinks.tsx` ausschließlich als
Linktext) ohne fachliche Bedeutung — die Umbenennung ist vom Auftrag
ausdrücklich erlaubt („Navigation/AppShell-Menüpunkt „Vorgänge" darf mit
umbenannt werden, wenn er ein reiner Anzeigetext ist").

**Bewusst NICHT umbenannt (Abgrenzungsentscheidung, kein Stopppunkt):**
Vorkommen von „Vorgang/Vorgänge" außerhalb der Listen-Seite und ihrer
Kopf-/Leertexte — u. a. die Massenaktions-Meldungen in `OperationalList.tsx`
(„Massenaktionen sind auf … Vorgänge begrenzt", „Vorgänge der aktuellen
Seite"), `IncidentsTable.tsx`, `dashboard/page.tsx`, `export/page.tsx`,
`vorgaenge/neu/page.tsx`. Der Auftrag beschränkt die Umbenennung ausdrücklich
auf „Nur sichtbare Texte dieser Seite(n)" (`vorgaenge/page.tsx`,
`OperationalList.tsx` und deren Kopf-/Leertexte) und verbietet eine globale
Umbenennung außerhalb der genannten Sichttexte — die Massenaktions-Meldungen
sind funktionale Statusmeldungen, keine Label/Kopf-/Leertexte der Liste.

### `app/test/auftrag8-klaerung-list-url.test.mjs` (neu, 4 Fälle)

Exaktes Strukturmuster von `ap15b-incident-list-url.test.mjs` (eigene Datei
wegen prozessweiter `registerHooks()`, gleicher `@/`-Resolve-Hook, gleiche
Begründung zu `import type`): `klaerung=1` → `true` + Roundtrip, `klaerung=0`
→ `false` + Roundtrip, `klaerung` fehlt → kein Filter, sowie ein zusätzlicher
vierter Fall, der `klaerung` und `fehlalarm` gleichzeitig gesetzt prüft (beide
Filter bleiben unabhängig, korrekte Parameterreihenfolge im Roundtrip).

**Testzahl-Änderung: Baseline 139 → neu 143 (+4), alle grün.**

## Prüfergebnisse (tatsächlich erhoben, aus `app/`)

- `node ./node_modules/typescript/bin/tsc --noEmit --incremental false`:
  **Exit 0**.
- `node ./node_modules/eslint/bin/eslint.js` auf allen 8 geänderten Dateien
  sowie der neuen Testdatei (`incident-list.ts`, `incident-list-url.ts`,
  `incidents.ts`, `incident-actions.ts`, `roles.ts`, `IncidentControls.tsx`,
  `OperationalList.tsx`, `vorgaenge/page.tsx`,
  `auftrag8-klaerung-list-url.test.mjs`): **Exit 0**, keine Ausgabe.
- `node --test test/*.test.mjs`: **Exit 0, 143 Einträge, 143 pass, 0 fail, 0
  skipped** (Baseline 139 + 4 neue Fälle aus
  `auftrag8-klaerung-list-url.test.mjs`).
- `npm run build`: **ein Versuch** (wie im Auftrag verlangt, nicht
  wiederholt) — Build-Fehler `EPERM: operation not permitted, unlink
  '…/.next/.fuse_hidden0000026d00000001'`. Identisches Bild wie in
  MELDUNG_3–7 dokumentiert: derselbe bekannte, umgebungsbedingte
  OneDrive-Mount-Blocker, keine neue Ursache. Lokale Gegenprüfung durch
  Dennis (`npm run dev`/`npm run build`) bleibt erforderlich.

## Git-Status (nur eigener Umfang)

`.git/index.lock` existiert (Zeitstempel des heutigen Tages,
vorbestehend/fremd erzeugt) und wurde wie in AUFTRAG_8 vorgegeben
**ignoriert** — nicht angelegt, nicht entfernt, nicht angefasst.
Ausschließlich lesende `git`-Befehle (`git status --porcelain`, `git diff -w
--stat`) verwendet.

`git status --porcelain` auf genau den 9 Dateien dieses Auftrags:

```
 M app/src/app/(app)/vorgaenge/page.tsx
 M app/src/components/incidents/IncidentControls.tsx
 M app/src/components/incidents/list/OperationalList.tsx
 M app/src/lib/incident-actions.ts
 M app/src/lib/incident-list-url.ts
 M app/src/lib/incident-list.ts
 M app/src/lib/incidents.ts
 M app/src/lib/roles.ts
?? app/test/auftrag8-klaerung-list-url.test.mjs
```

`git diff -w --stat` auf den 8 geänderten Dateien:

```
 app/src/app/(app)/vorgaenge/page.tsx               |  4 +-
 app/src/components/incidents/IncidentControls.tsx  | 14 ++++
 .../components/incidents/list/OperationalList.tsx  | 29 ++++++--
 app/src/lib/incident-actions.ts                    | 53 ++++++++++++++-
 app/src/lib/incident-list-url.ts                   |  6 ++
 app/src/lib/incident-list.ts                       | 13 ++++
 app/src/lib/incidents.ts                           | 77 +++++++++++++++++++++-
 app/src/lib/roles.ts                                | 10 ++-
 8 files changed, 192 insertions(+), 14 deletions(-)
```

`database.types.ts` wurde **nicht** angefasst: die dort seit AUFTRAG_7
hinterlegten Typen (`Incident.is_in_clarification`,
`IncidentListView.is_in_clarification/trade_id/trade_label`) waren bereits
vollständig additiv vorhanden und genügten unverändert.

Der übrige Arbeitsbaum trägt weiterhin die aus MELDUNG_4–7 bekannte,
vorbestehende große Zahl `M`-Einträge außerhalb jedes Auftragsumfangs (u. a.
`.claude/`, `deploy/`, weite Teile von `app/supabase/`, sowie aus AUFTRAG_5/6/7
uncommittete Änderungen) — diese wurden von mir **nicht** erzeugt und **nicht**
angefasst.

**Kein Commit, kein Push, kein Merge, kein Tag, keine Orchestrierung.** Der
Arbeitsbaum bleibt uncommitted zur Prüfung durch den Orchestrator/
Review-Chat.

## Statuspflege

`.claude/automation/status/fortschritt.json` liegt unter der laut AUFTRAG_8
ausdrücklich verbotenen Negativliste (`.claude/**`) und wurde deshalb
**nicht** geändert — dieselbe Abwägung wie in MELDUNG_5/6/7 bereits begründet
und dort an den Orchestrator zurückgemeldet.

## Stopppunkt

**Kein Stopppunkt ausgelöst.** Im Einzelnen geprüft:

- **Keine echte Designentscheidung über „analog Fehlalarm, dezent" hinaus:**
  Fehlalarm selbst hat in der Listenzeile bislang KEIN eigenes Badge (nur
  Filter-Chip/Segmented/Detail-Umschalter) — als Vorbild für „Badge in der
  Zeile, dezent" diente deshalb das bereits vorhandene Muster der
  „Offene Aufgabe"-Spalte (bedingter `Badge`, sonst „—"), mit dem neutralen
  Ton `info` statt `warning`, um die geforderte Dezenz gegenüber einer
  Warnung abzubilden. Das ist eine unmittelbare Übertragung eines
  bestehenden, gleichartigen Zeilen-Musters, keine neue Gestaltungsfrage.
- **`setFalseAlarm`-Muster war 1:1 übertragbar:** einzige bewusste Abweichung
  ist die im Auftrag selbst vorgeschriebene fehlende Rollenprüfung in der
  Server-Action; die Datenbankfunktion (`withUserTransaction`, parametrisiertes
  UPDATE, SQLSTATE-Klassifizierung) folgt unverändert demselben Muster.
- **Abgrenzung der Label-Umbenennung** (siehe Diff-Abschnitt zu `roles.ts`)
  ist eine Scoping-Entscheidung nach dem Auftragswortlaut („Nur sichtbare
  Texte dieser Seite(n)"), keine Designfrage und kein technisches Problem —
  daher kein Stopppunkt, aber ausdrücklich offengelegt.
- Kein Fehler ist auch nur zweimal aufgetreten (tsc, ESLint und Testlauf liefen
  jeweils im ersten Durchgang grün).
