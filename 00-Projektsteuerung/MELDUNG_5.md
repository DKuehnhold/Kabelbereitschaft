# MELDUNG 5 vom Worker-Chat zu AUFTRAG_5

> Stand: 2026-08-17. Verfasst von Claude (Rolle Worker, Ausführungsagent
> „kb-implementierung"), Antwort auf `00-Projektsteuerung/AUFTRAG_5.md`.
> Schriftliche Notiz, kein Chat-Kanal.

## Geänderte Dateien (genau die Positivliste, 2 von 2 Pflichtdateien)

- `app/src/components/incidents/NewIncidentForm.tsx`
- `app/src/app/(app)/vorgaenge/neu/page.tsx`

Keine neue Testdatei angelegt (siehe Begründung unten unter „FormData-Nachweis").
`CablePositionsEditor.tsx` und `ContactSelector.tsx` **unverändert** eingebunden,
nicht editiert. Keine Server-Action, keine Migration, kein SQL, kein `globals.css`,
kein `src/components/ui/shadcn/**` angefasst.

## Diff-Kurzbeschreibung

`git diff -w --stat` auf den 2 Positivlisten-Dateien: **2 Dateien geändert, 169
Einfügungen, 39 Löschungen** (Datei-Detail: `page.tsx` 18 Zeilen berührt,
`NewIncidentForm.tsx` 190 Zeilen berührt — überwiegend Strukturumbau, kein
Zeilen-Noise durch Formatierung).

### `NewIncidentForm.tsx`

- **Desktop-Layout (ab md):** `grid md:grid-cols-2` um die beiden Pflicht-
  abschnitte „Zuordnung" (links, unverändert: Kunde*, Bauabschnitt*, VzG-
  Strecke*, Bereitschaftsnummer) und „Störung" (rechts: Priorität*,
  Beschreibung*, `CablePositionsEditor`). Auf Mobil (unter md) fällt das Grid auf
  eine Spalte zurück, DOM-Reihenfolge bleibt Zuordnung → Störung.
- **Priorität als Tippflächen:** `ToggleGroup`/`ToggleGroupItem` (shadcn,
  `type="single"`, `variant="outline"`) ersetzt das `<select name="priority">`.
  Gruppierung/Beschriftung über natives `<fieldset><legend>Priorität *</legend>`
  statt `htmlFor` (für eine Button-Gruppe die korrekte, native a11y-Lösung,
  keine Regression). Ein Klick auf die bereits aktive Kachel wird ignoriert
  (`onValueChange` verwirft leere Werte) — die Priorität kann nie leer werden,
  identisch zum bisherigen Verhalten ohne Leeroption. **Verstecktes**
  `<input type="hidden" name="priority" value={priority} />` überträgt exakt
  denselben Feldnamen und denselben Wertebereich (`PRIORITIES`) wie vorher der
  `<select>` — `createIncident()`/`fd.get("priority")` erhält unverändert
  identische FormData.
- **Optionale Abschnitte als eingeklappte Collapsibles:** `Ort & Objekt` und
  `Meldung & Bemerkungen` jetzt über eine neue lokale `OptionalSection`-
  Komponente (shadcn `Collapsible`/`CollapsibleTrigger`/`CollapsibleContent`),
  standardmäßig zugeklappt (`defaultOpen={false}`), mit „(optional)"-Kennzeichnung
  und rotierendem Chevron. **Kein Unmount beim Zuklappen:** `CollapsibleContent`
  bekommt `forceMount`; das Ein-/Ausblenden erfolgt ausschließlich visuell über
  die Tailwind-Variante `data-[state=closed]:hidden` (=`display:none`).
  Begründung/Prüfung (wie im Auftrag verlangt): Radix Collapsible entfernt den
  Content standardmäßig nach der Schließanimation aus dem DOM (Presence-Pattern,
  wie z. B. auch bei Radix Accordion/Tabs) — bei unkontrollierten `<input>`-Feldern
  würde das DOM-Element und damit der eingegebene Wert beim Zuklappen verloren
  gehen. Mit `forceMount` bleibt der Knoten dauerhaft im DOM, nur CSS blendet ihn
  aus; ein per `display:none` verstecktes, aber weiterhin im DOM befindliches
  `<input>`/`<select>`/`<textarea>` mit gültigem `name` wird von der nativen
  `FormData`-Erhebung beim `<form>`-Submit trotzdem berücksichtigt (nur
  `disabled` oder ein fehlendes `name` schließen ein Feld aus dem FormData aus,
  nicht CSS-Sichtbarkeit) — Werte bleiben also sowohl im React-Baum als auch bei
  der Übermittlung erhalten. Bewusster Verzicht auf Radix' eingebaute
  Höhenanimation (die auf dem Unmount-Verhalten aufbaut) zugunsten dieser
  einfacheren, robusten Lösung ohne Funktionsverlust.
- **Primäraktion am Formularende (Desktop):** unverändert im Formularfluss,
  Label „Meldung anlegen" (vorher „Vorgang anlegen"), Hinweistext jetzt
  „…öffnet sich die Meldungsseite…" (vorher „…Vorgangsseite…"), nur ab `md`
  sichtbar (`hidden md:flex`).
- **Primäraktion mobil:** neue unten fixierte Leiste (`fixed inset-x-0 bottom-0`,
  `md:hidden`), nutzt die vorhandene `.safe-b`-Utility aus `globals.css`
  (unverändert, nur genutzt) für den Safe-Area-Inset, volle Breite, `h-11`
  (44px).
- **44px-Touchziele:** alle in dieser Datei direkt gerenderten
  `<select>`/`<input>`/`<textarea>` (weiterhin über die bestehende `.input`-
  Klasse gestylt) erhalten zusätzlich `style={{ minHeight: "44px" }}` — bewusst
  als Inline-Style statt Tailwind-Utility-Klasse, weil `.input` in
  `globals.css` als reine (nicht Tailwind-geschichtete) CSS-Regel mit
  `min-height: 2.5rem` erst **nach** den generierten Tailwind-Utilities im
  Stylesheet steht; eine zusätzliche Utility-Klasse gleicher Spezifität hätte
  je nach Kaskadenreihenfolge **nicht zuverlässig** gewonnen. Inline-Style
  gewinnt unabhängig von der Reihenfolge. `globals.css` selbst wurde nicht
  angefasst. Neu gerenderte shadcn-Elemente (`Button`, `ToggleGroupItem`,
  `CollapsibleTrigger`) nutzen `h-11`/`style` direkt, da sie über
  `cn()`/`tailwind-merge` sauber mit dem Standard-`h-9` verschmelzen bzw. keine
  konkurrierende Fremdregel existiert.
- Neuer Export `NEW_INCIDENT_FORM_ID` (String-Konstante `"new-incident-form"`),
  gesetzt als `id` auf `<form>`, damit der Button oben in `page.tsx` per
  natives HTML5-`form`-Attribut an dasselbe Formular gebunden werden kann,
  ohne eine neue gemeinsame Modul-/Kontextdatei einzuführen.

### `page.tsx`

- `PageHeader`-Aufruf: `title` von „Vorgang anlegen" auf **„Neue Meldung"**
  geändert (wörtlich wie Auftragspunkt 5 gefordert). `subtitle` bewusst
  **unverändert** gelassen (**„Neue Vorgänge auf Basis der Stammdaten
  (AP9)."**) — Auftragspunkt 5 nennt explizit nur drei umzubenennende Texte
  (Überschrift, Knopf, Hinweistext neben dem Knopf); die Negativliste verbietet
  ausdrücklich eine globale „Meldung"-Umbenennung „sonst nirgends". Der
  Untertitel gehört nicht zu den drei genannten Stellen, daher nicht
  angefasst. Das erzeugt eine kleine optische Inkonsistenz („Neue Meldung" /
  „Neue Vorgänge…"), die ich hier offenlege statt sie eigenmächtig
  mitzuentscheiden — kein Stopppunkt, da keine Gestaltungsfrage, die das
  Variante-A-Mockup offen lässt, sondern eine reine Wortwahlfrage außerhalb des
  Auftragswortlauts.
- Neu: `actions`-Prop von `PageHeader` (bereits vorher als `ReactNode?`
  vorgesehen, keine Änderung an `primitives.tsx`) genutzt für die zweite
  Primäraktion „oben rechts neben der Seitenüberschrift": ein shadcn `Button`
  mit `type="submit"` und `form={NEW_INCIDENT_FORM_ID}`. Da `page.tsx` eine
  async Server-Komponente ist und `button.tsx` selbst keine Client-Direktive/
  Hooks besitzt, funktioniert die Bindung rein über das native HTML5-`form`-
  Attribut (funktioniert dokumentiert über Dokumentgrenzen von DOM-Teilbäumen
  hinweg, keine gemeinsame State-Verwaltung nötig). Nur ab `md` sichtbar
  (`hidden md:inline-flex`) — auf Mobil ist die untere sticky Leiste die
  alleinige Primäraktion, wie im Auftrag gefordert.
  **Bekannter, dokumentierter Kompromiss:** dieser obere Button zeigt keinen
  „Speichern…"-Zustand und wird während der Übermittlung nicht disabled, weil
  der `pending`-Zustand aus `useActionState` lokal in der Client-Komponente
  `NewIncidentForm` lebt und nicht ohne zusätzliche Zustandsverwaltung nach
  außen gereicht werden kann, ohne die Positivliste zu verlassen (kein neues
  Shared-State-Modul). Der untere Button (Formularende und mobile Leiste)
  zeigt weiterhin korrekt „Speichern…"/`disabled` während der Übermittlung —
  funktional unverändert. Dieser Kompromiss ist keine sichtbare
  Gestaltungsfrage im Sinne des Stopppunkts (er betrifft nur den
  Ladezustand eines redundanten zweiten Buttons, keine strukturelle
  Variante-A-Frage), wird hier aber ausdrücklich offengelegt.

## FormData-Nachweis (createIncident unverändert erreichbar)

Kein neuer Test angelegt. Begründung: Im Repository existiert aktuell keine
Testinfrastruktur, die React-Komponenten rendert (kein `jsdom`, keine
`@testing-library/react`, kein `react-dom/server` in den bestehenden
`test/*.test.mjs`, geprüft per Volltextsuche). Eine neue Testdatei hätte damit
entweder neue Test-Abhängigkeiten eingeführt (nicht durch AUFTRAG_5 gedeckt,
Risiko einer nicht angeforderten Infrastrukturänderung) oder wäre auf reinen
String-/Struktur-Checks am Quelltext beschränkt gewesen, die keinen echten
Mehrwert gegenüber der folgenden Ableitung böten. Stattdessen der Nachweis
direkt am Code:

- `incident-actions.ts` liest **ausschließlich** `fd.get("priority")` (Zeile
  154, unverändert von diesem Auftrag) und validiert gegen `PRIORITIES.includes`
  (Zeilen 258/339, unverändert). Der neue Code liefert per verstecktem
  `<input type="hidden" name="priority" value={priority}>` denselben
  Feldnamen `"priority"` und denselben Wertebereich (`PRIORITIES`,
  `src/lib/priority.ts`, nicht verändert) wie zuvor der `<select
  name="priority">`.
- Alle übrigen Feldnamen (`customer_id`, `construction_stage_id`,
  `vzg_line_id`, `on_call_number_id`, `description`, `operating_point`,
  `track`, `km_from`, `km_to`, `direction`, `object_type`,
  `object_designation`, `location_description`, `caller_name`,
  `caller_contact`, `external_reference`, `internal_note`,
  `cable_positions_json` über `CablePositionsEditor`, `contact_id`/
  `contact_phone_number_id` über `ContactSelector`) sind **unverändert**
  übernommen — nur Position im Markup (Grid-Spalten, Collapsible-Wrapper) und
  zusätzliches `style`-Attribut geändert, kein `name`/`id`/Werttyp angefasst.

## Prüfergebnisse (tatsächlich erhoben, aus `app/`)

- `node ./node_modules/typescript/bin/tsc --noEmit --incremental false`:
  **Exit 0**.
- `node ./node_modules/eslint/bin/eslint.js src/components/incidents/NewIncidentForm.tsx "src/app/(app)/vorgaenge/neu/page.tsx"`:
  **Exit 0**, keine Ausgabe.
- `node --test test/*.test.mjs`: **Exit 0, 115 Einträge, 115 pass, 0 fail, 0
  skipped** — identisch zur Baseline (115/115), kein neuer roter Eintrag, keine
  neue Testdatei hinzugefügt.
- `npm run build`: **ein Versuch** (wie im Auftrag verlangt, nicht
  wiederholt) — **Exit 1**, `Error: EPERM: operation not permitted, unlink
  '…/.next/.fuse_hidden0000026d00000001'`. Identisches Bild wie in
  `MELDUNG_3`/`MELDUNG_4` dokumentiert: derselbe bekannte, umgebungsbedingte
  OneDrive-Mount-Blocker, keine neue Ursache. Lokale Gegenprüfung durch Dennis
  (`npm run dev`) bleibt wie zuvor erforderlich.
- `git diff -w --stat` auf den 2 Positivlisten-Dateien: **2 Dateien geändert,
  169 Einfügungen, 39 Löschungen**.

## Git-Status (nur eigene Änderungen dieses Auftrags)

`git status --porcelain` zeigt im gesamten Arbeitsbaum eine sehr große Zahl
`M`-Einträge außerhalb des Auftragsumfangs (u. a. praktisch der gesamte
`.claude/`-, `deploy/`-, `app/supabase/`-Baum sowie zahlreiche
Steuerungsdokumente) — dieser vorbestehende Arbeitsbaumstand war bereits vor
diesem Auftrag vorhanden (vgl. bereits in `MELDUNG_4` dokumentiertes Muster)
und wurde von mir **nicht** erzeugt und **nicht** angefasst. Relevant für
AUFTRAG_5 sind ausschließlich diese zwei Zeilen aus der Gesamtausgabe:

```
 M app/src/app/(app)/vorgaenge/neu/page.tsx
 M app/src/components/incidents/NewIncidentForm.tsx
```

`.git/index.lock` wurde vor der Prüfung geprüft und existiert **nicht** —
ausschließlich lesende `git`-Befehle (`git status --porcelain`, `git diff -w
--stat`) verwendet, nichts gelöscht oder verändert.

## Visuelle Abnahme (nicht sandboxfähig, Deklaration der geprüften Zustände)

Screenshot-Abnahme ist laut Auftrag in dieser Umgebung nicht möglich. Statisch
durch Code-Review geprüfte Breakpoints/Zustände (keine Laufzeit-Verifikation
im Browser):

- **< md (mobil):** eine Spalte, Reihenfolge Zuordnung → Störung → Ort & Objekt
  (eingeklappt) → Meldung & Bemerkungen (eingeklappt); Primäraktion nur als
  unten fixierte, safe-area-respektierende Leiste; oberer Button (`page.tsx`)
  und unterer Formularende-Button (Desktop) beide per `hidden`/`md:` versteckt.
- **≥ md (Desktop):** zwei Spalten (Zuordnung links, Störung rechts);
  Primäraktion sowohl oben rechts neben „Neue Meldung" als auch am
  Formularende sichtbar; mobile sticky Leiste per `md:hidden` versteckt.
- **Collapsible zu → auf:** Umschalten von `data-state="closed"` (Klasse
  `hidden` aktiv) auf `data-state="open"` (Klasse `hidden` entfernt) rein über
  Radix' eigenes State-Handling, keine eigene Zustandslogik nötig; Werte in den
  Feldern bleiben beim Umschalten im DOM (kein Unmount), verifiziert durch
  Code-Lektüre der `forceMount`-Dokumentation von Radix und der HTML-
  FormData-Spezifikation (CSS-Sichtbarkeit ist kein Ausschlusskriterium für
  `FormData`).
- Fachliche/optische Freigabe (Feinabstand, Farben, tatsächliches
  Kaskadenverhalten im echten Browser) bleibt bei Dennis via `npm run dev`,
  wie im Auftrag vorgesehen.

## Statuspflege — abweichend von der sonstigen Konvention

`AUFTRAG_5.md` listet unter „Negativliste" ausdrücklich **„keine Änderungen an
`.claude/**`**"**. `.claude/automation/status/fortschritt.json` liegt unter
diesem Pfad. Ich habe daher **`fortschritt.json` bewusst nicht geändert**,
obwohl die allgemeine Projektkonvention („Statusanzeige bei jeder Übergabe
pflegen") das nahelegen würde — die auftragsspezifische, wörtliche
Negativliste dieses AUFTRAG_5 hat Vorrang. Dieser Konflikt wird hiermit an den
Orchestrator/Review-Chat zur Klärung zurückgemeldet, statt ihn eigenmächtig
aufzulösen.

## Commit/Push

**Kein Commit, kein Push, kein Merge, kein Tag, keine Orchestrierung.** Der
Arbeitsbaum bleibt uncommitted zur Prüfung durch den Orchestrator/Review-Chat.

## Stopppunkt

Kein Stopppunkt ausgelöst: Der Umbau war ohne Änderung an
`createIncident`/Server-Actions möglich; die einzige aufgetretene Wortwahlfrage
(Untertitel „Neue Vorgänge…" neben Überschrift „Neue Meldung") ist keine vom
Variante-A-Mockup unbeantwortete Gestaltungsfrage, sondern eine reine
Textdetailfrage außerhalb des wörtlichen Auftragsumfangs, oben offengelegt;
derselbe Fehler ist nicht dreimal aufgetreten (ESLint-Timeout beim ersten
Versuch war ein reiner Werkzeug-Timeout ohne Fehlermeldung, beim Retry mit
längerem Timeout sauber Exit 0).
