# REVIEW_18 bis 22 — „von–bis"-Dialog, zwei Wächterkorrekturen, Browser-Schutz, Logo im Dark Mode

> Verfasst vom Orchestrator/Review-Chat, 2026-08-18. Grundlage: `AUFTRAG_18`–`AUFTRAG_22`,
> `MELDUNG_18`–`MELDUNG_22` und **eigene Messungen**. Agentenaussagen sind nicht als Nachweis
> übernommen. Ergänzt `REVIEW_18_19_20.md` und `REVIEW_21_22.md` (beide aus dem inzwischen
> deaktivierten scheduled task, siehe `BEFUND_SCHEDULED_TASK_DOPPELSCHREIBER.md`) und geht ihnen
> bei Abweichungen vor.
>
> **Unabhängige Bestätigung:** `REVIEW_21_22.md` entstand um 13:22 aus einem noch laufenden
> Task-Durchgang und kommt bei AUFTRAG_21/22 unabhängig zum selben Urteil (**grün**, Baseline
> **208/208, fail 0**, `tsc` Exit 0, `npm audit` 0 Schwachstellen, ESLint zweimal am Zeitlimit
> abgebrochen) und stellt ebenfalls fest, dass AUFTRAG_20K durch AUFTRAG_22 erledigt ist. Zwei
> getrennt erhobene Messreihen mit demselben Ergebnis — das stützt den Stand.

## Gesamturteil

| Auftrag | Gegenstand | Urteil |
| --- | --- | --- |
| 18 | „von–bis"-Dialog + Server-Action `assignOnCallRange` | **grün**, Stopppunkt korrekt gemeldet |
| 19 | Wächterzähler selbsttragend (Folge von 18) | **grün**, Wirksamkeit gegengeprobt |
| 20 | 92-Tage-Grenze **vor** dem Aufbau der Tagesliste | **grün**, Stopppunkt korrekt gemeldet |
| 21 | Logo im Dark Mode weiß (Ursache: `dark:`-Variante) | **grün**, Darstellung nicht prüfbar → Sichtprüfung |
| 22 | Wächter prüft Absicht statt Zeichenkette (Folge von 20) | **grün**, Wirksamkeit gegengeprobt |

## Eigene Abschlussmessung (aus `app/`, nach AUFTRAG_22)

| Prüfung | Ergebnis | Exit |
| --- | --- | --- |
| `node --test test/*.test.mjs` | `# tests 208 / # pass 208 / # fail 0` | **0** |
| `npx tsc --noEmit` | keine Ausgabe | **0** |
| Umfang (Dateizeitstempel, letzte 60 min unter `app/`) | `OnCallPlanClient.tsx`, `on-call-plan-actions.ts`, `globals.css`, `Logo.tsx`, `test/auftrag10-…`, `test/auftrag18-…`, `test/auftrag21-…` — **keine** weitere Produktivdatei | 0 |
| `grep -c $'\r'` neue Testdateien (18, 21) | je 0 (LF) | 0 |

Testentwicklung dieser Kette: 192 → 204 (AUFTRAG_18) → 208 (AUFTRAG_21). Baseline zu
Sitzungsbeginn war 177.

## AUFTRAG_18 — „von–bis"-Dialog

**Verhalten geprüft.** Alle **drei** Neuzuweisungspfade öffnen den Dialog (Drop, Klick Woche,
Klickpfad Monat — Zeilen 488, 499, 585); der **Verschiebepfad** geht unverändert ohne Dialog
durch `handleDropOrClickAssign()` (Zeile 485). Damit ist Punkt 6 („Verschieben bleibt
einzeltägig") eingehalten und der Dialog erscheint **vor** dem Schreiben — es gibt keinen
Zwischenzustand mit halb geschriebenem Tag.

**`assignOnCallRange()` — Serverpfad korrekt.** Gleiche Rollen-Allowlist
(`STAFF_ALLOWED_ROLES`), gleiche Eingabeprüfungen (`isUuid`, `isIsoCalendarDate`) wie die
Bestandsactions, kein abweichender Prüfpfad. Beide Grenzen (Bis vor Von, 92 Tage) sind
serverseitig **wiederholt** — die Oberfläche ist ausdrücklich keine Sicherung. Eine
`withUserTransaction`, darin je Tag ein `insert … on conflict … do nothing`.

**`on conflict`-Formulierung selbst gegengeprüft** — das war der fachlich heikelste Punkt:

```
dispo:        on conflict (plan_date, technician_id) where assignment_kind = 'dispo'
bereitschaft: on conflict (construction_stage_id, plan_date, technician_id)
                                                  where assignment_kind = 'bereitschaft'
```

gegen die Indexköpfe aus `0022_hlk_dispo_board.sql:245–254`:

```
on_call_plan_bereitschaft_uq (construction_stage_id, plan_date, technician_id)
  where assignment_kind = 'bereitschaft'
on_call_plan_dispo_uq        (plan_date, technician_id)
  where assignment_kind = 'dispo'
```

Spaltenlisten **und** Prädikate stimmen jeweils überein — die Arbiter-Inferenz auf einen
partiellen Unique-Index verlangt genau das. Ein bereits belegter Tag wird damit übersprungen
statt die Transaktion mit `23505` zu sprengen. `MAX_RANGE_DAYS` ist **eine** Quelle (in der
Action definiert, in der Oberfläche importiert) — kein zweiter, unabhängig gepflegter
Zahlenwert.

**Wortlaute** (aus dem Code gelesen, nicht aus der Meldung übernommen):

- Zeitraum-Rückfrage: `<Name> ist im gewählten Zeitraum an <N> Tag(en) bereits andernorts
  eingeplant: <Tage…>. Trotzdem einplanen?` — bei mehr als fünf Tagen gekürzt mit
  `… und N weitere`.
- Ergebnis: `<N> Tag(e) eingeplant, <M> Tag(e) waren bereits vergeben.` bzw. bei null angelegten
  Tagen `0 Tage eingeplant (alle <M> Tag(e) im gewählten Zeitraum waren bereits vergeben).`

**Grenze erneut offengelegt** — die Doppelbelegungsprüfung läuft über **alle** Tage des
Zeitraums (Zeile 409–411), aber nur gegen die **geladenen** Plandaten. Reicht der Zeitraum über
die angezeigte Woche bzw. den Monat hinaus, sieht sie außerhalb liegende Dubletten nicht. Das
steht im Quelltext und in `MELDUNG_18.md`. Richtig so — und ausdrücklich **keine** Zusicherung.

**Ein Kompromiss, den ich benenne:** die Erfolgsmeldung nutzt dieselbe Fläche wie die
Fehlermeldung, damit keine neue Farbklasse entsteht (Auftrag verbot das). Eine gelungene
Zeitraum-Anlage erscheint dadurch optisch wie ein Fehler. Der Agent hat das offen gemeldet
statt es zu verstecken. Gehört in die Bedienmängel-Scheibe.

## AUFTRAG_19 und 22 — zweimal derselbe Musterfehler in Wächtertests

Beide Aufträge korrigieren **keinen Produktivcode**, sondern statische Wächter, die eine
Momentaufnahme des Quelltextes festschrieben statt der Regel:

- **19:** `auftrag10-bereitschaftsplan.test.mjs` zählte die Allowlist-Prüfungen gegen die feste
  Zahl **4**. Die fünfte schreibende Action aus AUFTRAG_18 machte ihn zwangsläufig rot. Jetzt
  vergleicht er die Anzahl der Prüfungen mit der Anzahl der **exportierten** Actions und trägt
  eine untere Schranke — selbsttragend.
- **22:** `auftrag18-dispo-zeitraum.test.mjs` suchte die Grenzprüfung als **Zeichenkette**
  (`"days.length > MAX_RANGE_DAYS"`), die AUFTRAG_20 ersetzen musste. Jetzt prüft er den
  Vergleich als Muster **und** verlangt zusätzlich die Reihenfolge (Vergleich **vor**
  `isoDatesInRange(`) — also mehr als vorher.

**Beide Wirksamkeiten sind gegengeprobt**, wie beauftragt: Prüfung bzw. Reihenfolge
vorübergehend zurückgedreht → Test rot mit sprechender Meldung → Änderung zurückgenommen →
wieder grün, jeweils mit Hash- bzw. `git diff --stat`-Vergleich, der belegt, dass die
Produktivdatei am Ende unverändert ist. Das ist der Nachweis, den ein statischer Wächter
braucht — ohne ihn ist ein grüner Wächter wertlos.

**Review-Lehre, zweimal in einer Sitzung aufgetreten:** ein statischer Wächter darf keine
wörtliche Formulierung des Quelltextes festschreiben. Er muss die **Absicht** prüfen (Anzahl
gegen Anzahl, Muster statt Zeichenkette, Reihenfolge statt Vorkommen), sonst wird er bei der
nächsten sachlich richtigen Änderung rot und erzeugt einen Korrekturauftrag, der nichts
verbessert. Beide betroffenen Wächter sind jetzt so gebaut; bei künftigen Wächtern ist das von
Anfang an zu beachten.

## AUFTRAG_20 — Browser-Schutz der 92-Tage-Grenze

**Befund war meiner**, nicht der des Agenten: `isoDatesInRange()` baute die Tagesliste in einer
unbegrenzten Schleife auf, **bevor** die Grenze geprüft wurde. Ein Tippfehler im Jahr
(`2926-08-24`, ein `<input type="date">` nimmt das an) hätte rund **330.000** Durchläufe erzeugt
und den Tab eingefroren — genau der Fall, gegen den die Grenze schützen soll.

Behoben durch einen früh abbrechenden Zähler **vor** dem Listenaufbau, plus ein Sicherheitsnetz
in `isoDatesInRange()` selbst (nie mehr als `MAX_RANGE_DAYS + 1` Einträge). Nachweis des Agenten
rechnerisch geführt (Wegwerfskript unter `/tmp`, nicht im Vault): **92 statt ~330.000 Schritte**,
`count = 93`. Der Serverpfad war nie betroffen.

## AUFTRAG_21 — Logo im Dark Mode

**Die Ursache lag nicht am Logo.** `Logo.tsx` trug schon seit AUFTRAG_12 `dark:invert` — die
Absicht war richtig. Kaputt war die Variantendefinition in `globals.css:9`: sie band `dark:`
**ausschließlich** an `[data-theme="dark"]`. Bei Themewahl **„System"** und dunklem
Betriebssystem setzt aber niemand dieses Attribut; die Farben kommen dort aus
`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) … }`. Ergebnis: Fläche
dunkel, `dark:`-Utilities aus — schwarzes Logo auf dunklem Grund.

Neue Fassung, selbst gelesen:

```css
@custom-variant dark {
  &:where([data-theme="dark"], [data-theme="dark"] *) { @slot; }
  @media (prefers-color-scheme: dark) {
    &:where(:root:not([data-theme="light"]), :root:not([data-theme="light"]) *) { @slot; }
  }
}
```

Der zweite Zweig ist **deckungsgleich** mit dem bestehenden Tokenblock — kein neu erfundener
Selektor. Der Ausschluss `:not([data-theme="light"])` ist zwingend: ohne ihn zeigte ein
ausdrücklich helles Theme auf dunklem Betriebssystem ein weißes Logo auf weißem Grund.
Gegengeprüft, dass **kein Tokenwert** berührt wurde: die drei Farbblöcke (`:root`,
`[data-theme="dark"]`, `@media (prefers-color-scheme: dark)`) sind unverändert vorhanden, und
der Diff gegen eine `/tmp`-Kopie (in `MELDUNG_21.md` wörtlich) betrifft nur Variante und
Kommentar. Der Agent hat die Blockform zusätzlich über einen echten PostCSS-Lauf unter `/tmp`
verifiziert — sie erzeugt die zwei erwarteten Selektoren.

**Erwarteter Nebeneffekt, für die Sichtprüfung wichtig:** in `app/src/` liegen **20**
`dark:`-Utilities in 8 Dateien. Zwei sind das Logo, **18** weitere (überwiegend Ring- und
Feldfarben in den shadcn-Copy-ins: `dark:ring-destructive/40`, `dark:bg-input/30`, …) waren
unter „System = dunkel" ebenfalls unwirksam und werden jetzt aktiv. Das ist gewollt, bedeutet
aber eine sichtbare Veränderung an Formularfeldern und Fokusringen in genau diesem Modus.

## Auflagen (offen, nicht durch mich erbringbar)

1. **Sichtprüfung durch Dennis, in allen vier Theme-Zuständen** (Dunkel / System+dunkles OS /
   System+helles OS / Hell+dunkles OS): Logo weiß bzw. schwarz, und die 18 nun aktiven
   `dark:`-Stellen. Ein Browser steht hier nicht zur Verfügung — die Darstellung ist **nicht**
   nachgemessen.
2. **`npm run build` und ESLint lokal.** Der scheduled task hat ESLint zweimal versucht, beide
   Läufe brachen am Zeitlimit (~178 s) ab — kein Befund, aber auch kein Nachweis.
3. **SQL-/CI-Nachweis** unverändert offen (Smokes 26–29, Job `database`), zusätzlich weiterhin
   die **CRLF-Bereinigung vor dem Commit** (`BEFUND_CRLF_ARBEITSBAUM.md`).

## Kein Commit, kein Push

Weder durch einen Ausführungsagenten noch durch mich.
