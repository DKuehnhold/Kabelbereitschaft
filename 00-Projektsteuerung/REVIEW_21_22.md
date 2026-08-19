# REVIEW_21_22 — Dark-Variante repariert, Wächter prüft Absicht

> Erstellt vom Orchestrator/Review-Chat, 2026-08-18 (automatisierter Lauf, 13:22). Prüft
> `MELDUNG_21.md` (AUFTRAG_21: Logo im Dark Mode weiß) und `MELDUNG_22.md` (AUFTRAG_22:
> Wächter prüft Absicht statt Zeichenkette). Alle Messwerte unten sind vom Review-Chat
> SELBST erhoben, nicht aus den Meldungen übernommen.

## Gesamturteil

| Meldung | Urteil |
| --- | --- |
| MELDUNG_21 (Dark-Variante `@custom-variant` beide Dunkelfälle) | **grün** — mit offener Auflage Sichtprüfung (siehe unten) |
| MELDUNG_22 (Wächter auf Absicht/Reihenfolge umgestellt) | **grün** — Baseline wieder vollständig: **208/208, fail 0** |

Damit ist auch der Korrekturauftrag **AUFTRAG_20K erledigt**: AUFTRAG_22 behandelte
denselben Befund (roter Wächtertest 10 aus `auftrag18-dispo-zeitraum.test.mjs`) mit
identischem Ziel; MELDUNG_22 erfüllt inhaltlich beide Aufträge. 20K braucht keine
eigene Meldung mehr.

## Selbst erhobene Messwerte (aus `app/`, 2026-08-18 ~13:10–13:20)

| Prüfung | Ergebnis | Exit |
| --- | --- | --- |
| `node --test test/*.test.mjs` | **208 Tests, 208 pass, fail 0** | 0 |
| `node --test test/auftrag21-dark-variante.test.mjs` | 4/4 pass | 0 |
| `npx tsc --noEmit` | keine Ausgabe | 0 |
| `npm audit --audit-level=high --omit=dev` | found 0 vulnerabilities | 0 |
| `npx eslint` (gesamt und dateiscoped) | **nicht abgeschlossen** — 2× Abbruch am Tool-Zeitlimit (~178 s) auf dem OneDrive-Mount; bekanntes, in REVIEW_18_19_20 dokumentiertes Umgebungslimit. Lint-Nachweis lokal/CI. | — |
| `grep -c $'\r' test/auftrag21-dark-variante.test.mjs` | 0 (LF) | — |
| `npm run build` | nicht ausgeführt — bekannter OneDrive-Mount-Blocker (EPERM/.fuse_hidden); Build-Nachweis macht Dennis lokal (zuletzt grün 2026-08-16, Next 16.2.12) | — |

## Prüfung MELDUNG_21 (selbst gegengelesen)

- `globals.css`: die `@custom-variant dark`-Blockform enthält beide Zweige —
  `[data-theme="dark"]` und `@media (prefers-color-scheme: dark)` mit
  `:root:not([data-theme="light"])` — deckungsgleich zu den beiden bestehenden
  Tokenblöcken. Der zwingende `:not([data-theme="light"])`-Ausschluss (Tabelle
  Zeile 4 des Auftrags: helles Theme auf dunklem OS = schwarzes Logo) ist da.
- Kein Tokenwert berührt: `:root`, `[data-theme="dark"]` und der
  `@media`-Tokenblock sind unverändert vorhanden (Wächtertest 4/4 grün, selbst
  ausgeführt). `Logo.tsx` trägt weiterhin `dark:invert`, nur der Kommentar wurde
  nachgezogen — selbst gegengelesen.
- Umfang: Dateizeitstempel bestätigen genau die drei Positivlisten-Dateien
  (12:52–12:54). `color-scheme` (AUFTRAG_13) unangetastet.
- Der Kompilier-Nachweis (Tailwind 4.3.3 via PostCSS, isoliert in /tmp) ist als
  Ersatznachweis akzeptiert; der Worker hat korrekt und ausdrücklich deklariert,
  dass die **Darstellung** hier nicht prüfbar ist.

**Offene Auflage (kein Blocker):** Sichtprüfung durch Dennis in allen vier
Tabellenzeilen aus AUFTRAG_21 — dabei beachten, dass unter „System = dunkel"
auch die 18 übrigen `dark:`-Utilities (Ring-/Feldfarben der shadcn-Copy-ins)
erstmals wirksam werden; sichtbare Veränderungen dort sind gewollt.

## Prüfung MELDUNG_22 (selbst gegengelesen)

- Wächtertest 10 sucht jetzt `/>\s*MAX_RANGE_DAYS/` (Absicht statt Wortlaut),
  verlangt den Vergleich **vor** `isoDatesInRange(` (sprechende Fehlermeldung
  vorhanden) und **vor** `runRangeAction(`, prüft „Bis vor Von" unverändert und
  sichert das Sicherheitsnetz in `isoDatesInRange` (`MAX_RANGE_DAYS` im Rumpf)
  — exakt der Auftragszuschnitt, Zeilen 185–240 selbst gegengelesen.
- Produktivcode unverändert: `sha256sum src/components/on-call-plan/OnCallPlanClient.tsx`
  → `6fd58c51…af6a71`, **identisch** mit dem in MELDUNG_22 dokumentierten
  Vorher-Hash; kein `GEGENPROBE`-Rest im Quelltext (grep leer). Die neuere
  mtime (13:04) erklärt sich aus der zurückgenommenen Gegenprobe — der
  Hashvergleich ist das stärkere Kriterium und stimmt.
- Die Gegenprobe der Wirksamkeit (rot bei gekippter Reihenfolge, wieder grün
  nach Rücknahme) ist nachvollziehbar belegt.
- Aktuelle Reihenfolge im Produktivcode selbst verifiziert:
  `countDaysInRange(…) > MAX_RANGE_DAYS` (Zeile 422) vor
  `isoDatesInRange(fromIso, rangeToIso)` (Zeile 429); Sicherheitsnetz
  `days.length > MAX_RANGE_DAYS` in `isoDatesInRange` (Zeile 376).

Das vom Worker benannte Restrisiko (statischer Wächter, umgehbar durch Auslagern
der Prüfungen aus dem geschnittenen Funktionskörper) bestand strukturell schon
vorher und ist akzeptiert.

## Nächste Scheibe

**AUFTRAG_23** (Bedienmängel Dispo-Board — die in MELDUNG_18 dokumentierten,
zurückgestellten Schulden: Erfolgsmeldung erscheint in der roten Fehlerbox;
toter `kind:"new"`-Zweig in `handleDropOrClickAssign`). Entspricht der in
REVIEW_18_19_20 angekündigten Reihenfolge.

## Hinweise an Dennis

1. **Sichtprüfung Logo/Dark-Mode** steht aus (vier Fälle aus AUFTRAG_21, plus
   erwartete Nebenwirkung der 18 weiteren `dark:`-Utilities unter „System = dunkel").
2. Testbaseline ist jetzt **208/208 grün** (Exit 0) — erstmals seit AUFTRAG_20
   wieder ohne roten Bestandstest.
3. ESLint/`npm run build` bleiben in der Sandbox nicht messbar (OneDrive-Mount) —
   Nachweis wie gehabt lokal bzw. in der CI.
