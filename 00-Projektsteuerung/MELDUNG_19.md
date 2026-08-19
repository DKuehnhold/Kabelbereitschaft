# MELDUNG_19 — Wächterzähler selbsttragend gemacht

> Ausführungsagent-Meldung zu AUFTRAG_19. Grundlage: Stopppunkt aus AUFTRAG_18 /
> MELDUNG_18.md (Wächter in `auftrag10-bereitschaftsplan.test.mjs` zählte eine fest
> eingetragene Zahl 4, `assignOnCallRange()` aus AUFTRAG_18 macht 5 Vorkommen daraus).

## Geänderte Datei

**Genau eine Datei geändert:** `app/test/auftrag10-bereitschaftsplan.test.mjs`
(Testfall ab Zeile 172, betroffen war ausschließlich der Block ab dem Kommentar
„AUFTRAG_10: Staff-Allowlist …").

`app/src/lib/on-call-plan-actions.ts` wurde **nur für die Gegenprobe (DoD 4) vorübergehend**
verändert und danach exakt wiederhergestellt — siehe Abschnitt „Gegenprobe" unten. Am Ende
ist der Inhalt byte-identisch zum Stand vor der Gegenprobe (SHA-256 verglichen).

Keine andere Datei wurde angefasst. Der Arbeitsbaum enthält weiterhin 200+ fremde,
unbeteiligte Änderungen (u. a. der bereits vor Auftragsbeginn bestehende Diff auf
`on-call-plan-actions.ts`, 267 Einfügungen / 2 Löschungen laut `git diff --stat`) — diese
stammen nicht aus dieser Aufgabe und wurden nicht angerührt.

## Neuer Prüfansatz

Der Testfall heißt jetzt:
„on-call-plan-actions.ts: jede exportierte Server-Action prüft über dieselbe benannte
Staff-Allowlist" (vorher: vier Namen fest im Titel genannt).

Statt einer fest eingetragenen Zahl (4) zählt der Test jetzt zwei Größen direkt aus dem
Quelltext von `on-call-plan-actions.ts`:

1. Vorkommen von `STAFF_ALLOWED_ROLES.includes(session.role)` (Regex-Match-Zählung).
2. Exportierte Server-Actions über `export\s+async\s+function\s+(\w+)\s*\(` — die Namen
   werden mitgeführt, damit eine rote Meldung sofort zeigt, welche Actions gefunden wurden.

`assert.equal(usages.length, exportedActionNames.length, …)` verlangt Gleichheit beider
Zahlen; die Fehlermeldung nennt beide Werte und alle gefundenen Action-Namen.

Zusätzlich eine **untere Schranke** `assert.ok(usages.length >= 5, …)`, ausdrücklich als
Schranke gegen versehentliches Entfernen bestehender Prüfungen kommentiert (keine
Momentaufnahme-Zahl, die bei jeder neuen Action nachgezogen werden müsste).

Die bestehenden Prüfungen blieben unverändert erhalten:
- `STAFF_ALLOWED_ROLES` exakt `["admin", "disponent"]`,
- Negativlisten-Prüfung (`role === "monteur"` nur als Kommentar zulässig),
- Hinweis „ausdrücklich ein statischer Wächter und kein Verhaltensnachweis" im Kommentarblock,
  jetzt ergänzt um die Herkunft (AUFTRAG_10 → AUFTRAG_14 → AUFTRAG_19, Stopppunkt aus
  AUFTRAG_18).

## Gegenprobe der Wirksamkeit (DoD 4)

1. Baseline vor der Gegenprobe erfasst:
   - `git diff --stat -- app/src/lib/on-call-plan-actions.ts` →
     `1 file changed, 267 insertions(+), 2 deletions(-)`
   - SHA-256: `ec48843d34944488de5936f5b536db98f67507510a7f1196560df6903c7d78b0`

2. In `on-call-plan-actions.ts` **vorübergehend** eine Allowlist-Prüfung entfernt
   (in `assignOnCall`, Zeile 68): aus
   `if (!session || !STAFF_ALLOWED_ROLES.includes(session.role))`
   wurde `if (!session)`.

3. Einzeltest ausgeführt: `node --test test/auftrag10-bereitschaftsplan.test.mjs`
   → **Exit 1**, 18 pass / **1 fail**. Rot-Meldung im Wortlaut:

   ```
   not ok 18 - on-call-plan-actions.ts: jede exportierte Server-Action prueft ueber dieselbe benannte Staff-Allowlist
     error: |-
       on-call-plan-actions.ts: STAFF_ALLOWED_ROLES.includes(session.role) wird 4x verwendet, aber 5 exportierte Server-Action(en) gefunden (assignOnCall, removeOnCall, assignDispo, moveOnCallEntry, assignOnCallRange) - jede exportierte Action muss ueber dieselbe benannte Allowlist pruefen.

       4 !== 5

     code: 'ERR_ASSERTION'
     expected: 5
     actual: 4
   ```

   Der Wächter greift also tatsächlich: er benennt die fehlende Prüfung korrekt anhand der
   Differenz zwischen tatsächlichen Vorkommen (4) und exportierten Actions (5,
   `assignOnCallRange` fehlt in der Aufzählung nicht, aber die Prüfung selbst wurde entfernt).

4. Änderung **vollständig zurückgenommen** (Zeile 68 wieder auf
   `if (!session || !STAFF_ALLOWED_ROLES.includes(session.role))` gesetzt).

5. Danach erneut gemessen:
   - SHA-256 nach Rücknahme: `ec48843d34944488de5936f5b536db98f67507510a7f1196560df6903c7d78b0`
     — **identisch** zur Baseline aus Schritt 1.
   - `git diff --stat -- app/src/lib/on-call-plan-actions.ts` nach Rücknahme:
     `1 file changed, 267 insertions(+), 2 deletions(-)` — **identisch** zur Baseline
     (die dort sichtbaren 267/2 Zeilen stammen aus fremden, vor Auftragsbeginn bestehenden
     Änderungen, nicht aus der Gegenprobe).
   - Gesamtlauf `node --test test/*.test.mjs` → **204 Fälle, 204 grün, fail 0, Exit 0**.

**Bestätigung:** `on-call-plan-actions.ts` ist nach der Gegenprobe unverändert
(Hash-Gleichheit und Diff-Stat-Gleichheit vor/nach belegt).

## Messwerte mit Exit-Codes

| Messung | Ergebnis | Exit |
|---|---|---|
| `node --test test/*.test.mjs` (vor Gegenprobe, nach Testfall-Änderung) | 204 Fälle, 204 pass, 0 fail | 0 |
| `npx tsc --noEmit` (vor Gegenprobe) | keine Ausgabe | 0 |
| `node --test test/auftrag10-bereitschaftsplan.test.mjs` (während Gegenprobe, Prüfung entfernt) | 19 Fälle, 18 pass, **1 fail** (Wächter greift, s. o.) | 1 |
| `node --test test/*.test.mjs` (nach Rücknahme der Gegenprobe) | 204 Fälle, 204 pass, 0 fail | 0 |
| `npx tsc --noEmit` (nach Rücknahme) | keine Ausgabe | 0 |

`npm run build` und ESLint wurden nicht ausgeführt (laut Auftrag nicht ausführbar in dieser
Umgebung) — dazu keine Behauptung.

## Offene Risiken

- Der Wächter zählt Export-Actions über das Muster `export async function name(`. Sollte
  künftig eine schreibende Action anders exportiert werden (z. B. `export const x = async
  () => {}` oder default export), würde sie vom Zähler nicht erfasst und der Wächter bliebe
  fälschlich grün, obwohl die Absicht (Prüfung pro Action) nicht mehr sauber abgebildet wäre.
  Das entspricht dem im Auftrag genannten Stopppunkt-Kriterium; aktuell sind aber alle
  Actions in der Datei konsistent als `export async function` deklariert (durch Grep
  bestätigt: `assignOnCall`, `removeOnCall`, `assignDispo`, `moveOnCallEntry`,
  `assignOnCallRange`), daher kein akuter Handlungsbedarf.
- Die untere Schranke (≥5) ist bewusst eine Mindestgrenze und keine exakte Zahl; sie greift
  nicht, falls jemand gleichzeitig eine Prüfung entfernt UND eine Action löscht, sodass beide
  Zahlen sinken, aber gleich bleiben. Das ist ein bekannter Kompromiss des selbsttragenden
  Ansatzes (Gleichheits-Check kann durch parallèles Entfernen ausgehebelt werden) und wurde
  nicht zusätzlich abgesichert, da der Auftrag genau diesen Ansatz (Gleichheit + untere
  Schranke) vorgibt.
