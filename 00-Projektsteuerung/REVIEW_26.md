# REVIEW_26 — Smoke 29: Sollzahl-Korrektur 5 → 6 und Rechenprobe

> Automatiklauf (Chat 2, scheduled task kb-review-zyklus), 2026-08-19, zu MELDUNG_26.md / AUFTRAG_26.md.
> Alle Messwerte in diesem Review sind eigene Erhebungen aus der Sandbox, nicht aus der Meldung übernommen.

## Urteil: **grün** (mit einer stehenden Auflage, siehe unten)

## Eigene Messwerte

| Prüfung | Ergebnis | Exit-Code |
|---|---|---|
| Umfang: `find app -newer 00-Projektsteuerung/AUFTRAG_26.md` (node_modules ausgenommen) | genau **eine** Datei: `app/supabase/test/29_hlk_dispo_board.sql` (mtime 09:53, zwischen AUFTRAG 09:46 und MELDUNG 09:55) | 0 |
| `node --test test/*.test.mjs` (aus app/) | **227/227 pass, 0 fail** — entspricht der Baseline | 0 |
| `npx tsc --noEmit` (aus app/) | keine Fehler | 0 |
| `npm audit --audit-level=high --omit=dev` | 0 vulnerabilities | 0 |
| `$$`-Bilanz der Datei: `grep -c '^do \$\$'` / `grep -c '^\$\$;'` | 16 / 16, ausgeglichen | 0 |

`npm run build` und ESLint laufen in der Sandbox nicht (OneDrive-/FUSE-Mount); Dennis' lokaler Build war am 2026-08-19 Exit 0.

## Inhaltliche Prüfung

**Korrektur 5 → 6 (Datei Zeile 108–110):** selbst nachgelesen und nachgerechnet. Die Fixtures legen
drei Profile (`…0001`–`…0003`, Zeilen 79–84), einen Bauabschnitt (`…00a1`) und zwei Techniker
(`…00a2`, `…00a3`) an; der Zählausdruck (Zeilen 102–106) summiert genau diese drei Mengen.
3 + 1 + 2 = 6. Die neue Fehlermeldung trägt die Herleitung im Text — das erfüllt die
AUFTRAG-Vorgabe, die Zahl gegen künftigen Fixture-Zuwachs abzusichern, und folgt der Wächter-Lehre
(Absicht statt Momentaufnahme).

**Stichproben der Rechenprobe (unabhängig gegengeprüft):**
- Zeile 169 `v_qual_policies <> 2`: Migration 0022 legt für `qualifications` genau 2 Policies an
  (`qualifications_select` Z.120, `qualifications_write` Z.127) — stimmt. Zusätzlich dynamischer
  Vorher/Nachher-Vergleich in derselben Bedingung (Idempotenz), gutes Muster.
- Zeile 172 `v_tq_policies <> 3`: Migration 0022, Zeilen 173/180/187 (`_select`, `_insert`,
  `_delete`) — stimmt.
- Zeile 587 `v_rest <> 0` nach `rollback;` (Zeile 566): strukturell korrekt.
- Fixture-Zählung Zeile 108: siehe oben.

Die 22-Zeilen-Tabelle der MELDUNG_26 ist vollständig, nennt je Stelle Herleitung mit
Fundstellen und weist die dynamischen Vergleiche korrekt als „kein Literal" aus. Kleiner
Schönheitsfehler ohne Folge: die Tabellenzeile zu Zeile 108 zitiert noch den alten Ausdruck
`v_stammdaten <> 5`; das Urteil „korrigiert → 6" und die Datei selbst sind eindeutig.

**Negativliste eingehalten:** keine Migration, kein anderer Smoke, kein app/src berührt
(per Zeitstempel belegt); keine Prüfung abgeschwächt, keine Fixture-Zeile verändert.
Stopppunkte nicht ausgelöst (1 Korrektur < 5).

## Stehende Auflage

Smoke 29 ist mit der Korrektur weiterhin **geschrieben, nicht ausgeführt** — in der Sandbox gibt
es kein PostgreSQL, und die Meldung behauptet zu Recht keinen Lauf. Der Nachweis entsteht erst
mit Dennis' nächstem Datenbanklauf (run_ap14b_local.ps1 bzw. CI-Job `database`). Bis dahin gilt
die Datei ab AA1 als ungelaufen. Kein Korrekturauftrag nötig.

## Kein neuer Auftrag in diesem Zyklus

Bewusste Entscheidung des Automatiklaufs: Chat 1 ist zwar `frei`, hat aber laut CHAT_STATUS als
nächsten Schritt ausdrücklich Dennis' DB-Lauf zu Smoke 29 eingeplant. Ein neuer Auftrag aus der
Themenliste (Dispo-Board Teil 2, CSV-Import, Kontakte-Wizard, …) würde die laufende
Smoke-29-Kette kreuzen, bevor ihr Ergebnis vorliegt. Der interaktive Chat entscheidet nach dem
DB-Lauf über die nächste Scheibe.
