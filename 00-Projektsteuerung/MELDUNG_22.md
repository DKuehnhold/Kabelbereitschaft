# MELDUNG_22 — Wächter prüft Absicht statt Zeichenkette (AUFTRAG_22)

## Geänderte Datei

Genau eine Datei dauerhaft geändert:

- `app/test/auftrag18-dispo-zeitraum.test.mjs`
  (mtime 2026-08-18 13:02:18 +0200; einzige inhaltliche Änderung dieses Auftrags)

`app/src/components/on-call-plan/OnCallPlanClient.tsx` wurde **nur für die Gegenprobe unter
Punkt 4 der DoD vorübergehend verändert und danach exakt zurückgenommen** (Beleg siehe
Hashvergleich unten). Kein Produktivcode ist am Ende verändert. Keine weitere Datei wurde
angefasst.

## Neuer Prüfansatz (statt Zeichenkettensuche)

Der Testfall „Bis vor Von und die 92-Tage-Obergrenze werden im Dialog VOR jedem Schreibvorgang
geprüft“ (`test/auftrag18-dispo-zeitraum.test.mjs`, ab Zeile 184) sucht jetzt:

1. **Absicht statt Wortlaut**: `/>\s*MAX_RANGE_DAYS/` statt der wörtlichen Zeichenkette
   `"days.length > MAX_RANGE_DAYS"` — erkennt sowohl die alte Formulierung als auch die von
   AUFTRAG_20 eingeführte (`countDaysInRange(...) > MAX_RANGE_DAYS`) und jede künftige
   gleichwertige Umformulierung.
2. **Verschärfte Reihenfolge**: der gefundene Vergleich gegen `MAX_RANGE_DAYS` muss **vor** dem
   Aufruf von `isoDatesInRange(` stehen (nicht nur vor `runRangeAction(`). Kippt die Reihenfolge,
   schlägt der Test mit einer sprechenden Meldung fehl („... greift erst NACH dem Aufbau der
   vollständigen Tagesliste ... bei einem Tippfehler im Jahr würde der Browser erst die riesige
   Liste aufbauen, bevor die Grenze überhaupt geprüft wird, statt vorher abzubrechen“).
3. **Sicherheitsnetz-Nachweis**: zusätzlich wird per `sliceFunction` der Rumpf von
   `isoDatesInRange` isoliert und geprüft, dass darin `MAX_RANGE_DAYS` vorkommt (AUFTRAG_20
   Punkt 3 bleibt abgesichert).
4. Unverändert erhalten: Prüfung auf „Bis vor Von“ (`rangeToIso < fromIso`) und dass beide
   Grenzprüfungen vor `runRangeAction(` stehen.
5. Der Kommentar über dem Testfall wurde auf den neuen Ansatz nachgezogen (Herkunft AUFTRAG_22,
   Stopppunkt aus AUFTRAG_20 / MELDUNG_20, Begründung: Zeichenketten-Wächter hätte jede
   gleichwertige Umformulierung fälschlich als Regressionsbruch gemeldet).

## Gegenprobe der Wirksamkeit (DoD Punkt 4)

**Hash vorher** (vor jeder Änderung an `OnCallPlanClient.tsx`):
```
6fd58c51b5bd4623f5b78eb1d37c02fb3edc3f85d1a24d630d56871c31af6a71  src/components/on-call-plan/OnCallPlanClient.tsx
```

Vorübergehende Änderung: die Obergrenzenprüfung (`countDaysInRange(...) > MAX_RANGE_DAYS`) in
`handleAssignRange` hinter den Aufruf von `isoDatesInRange(fromIso, rangeToIso)` verschoben
(Reihenfolge absichtlich gekippt), mit Kommentar „GEGENPROBE AUFTRAG_22 (TEMPORAER, wird
zurückgenommen)“ markiert.

Einzeltestlauf mit gekippter Reihenfolge — **rot, wie erwartet**:
```
not ok 10 - Bis vor Von und die 92-Tage-Obergrenze werden im Dialog VOR jedem Schreibvorgang
            geprüft (kein Schreiben bei Verstoß)
  error: 'die 92-Tage-Obergrenzenprüfung (Vergleich gegen MAX_RANGE_DAYS) greift erst NACH dem
          Aufbau der vollstaendigen Tagesliste (isoDatesInRange) - bei einem Tippfehler im Jahr
          wuerde der Browser erst die riesige Liste aufbauen, bevor die Grenze ueberhaupt
          geprueft wird, statt vorher abzubrechen'
# tests 12 / pass 11 / fail 1
```
Exit-Code des Laufs: **1**.

Änderung vollständig zurückgenommen (Diff exakt rückgängig gemacht).

**Hash nachher** (nach vollständiger Rücknahme):
```
6fd58c51b5bd4623f5b78eb1d37c02fb3edc3f85d1a24d630d56871c31af6a71  src/components/on-call-plan/OnCallPlanClient.tsx
```

**Hashvergleich**: vorher == nachher (identisch, `6fd58c5...af6a71`) → `OnCallPlanClient.tsx` ist
nach der Gegenprobe **rückstandsfrei** wiederhergestellt. Die (durch das temporäre Schreiben
zwangsläufig veränderte) Datei-mtime ist dabei kein Widerspruch — der Hashvergleich ist genau
deshalb das verlangte, stärkere Kriterium.

Erneuter Einzeltestlauf nach Rücknahme — **wieder grün**:
```
# tests 12 / pass 12 / fail 0
```
Exit-Code: **0**.

## Messwerte (nach endgültiger Rücknahme der Gegenprobe)

| Prüfung | Kommando | Ergebnis | Exit-Code |
|---|---|---|---|
| Einzeltest (grün, vor Gegenprobe) | `node --test test/auftrag18-dispo-zeitraum.test.mjs` | 12/12 grün | 0 |
| Einzeltest (rot, während Gegenprobe) | `node --test test/auftrag18-dispo-zeitraum.test.mjs` | 11/12 grün, 1 rot (Fall 10, erwartete Meldung) | 1 |
| Einzeltest (grün, nach Rücknahme) | `node --test test/auftrag18-dispo-zeitraum.test.mjs` | 12/12 grün | 0 |
| Gesamtlauf (nach Rücknahme) | `node --test test/*.test.mjs` | **208/208 grün, fail 0**, duration_ms ≈ 4915 | 0 |
| TypeScript | `npx tsc --noEmit` | keine Ausgabe/Fehler | 0 |

## Offene Risiken

- Der Wächter bleibt weiterhin ein statischer Text-/Reihenfolge-Wächter (kein
  Verhaltensnachweis per Browser/JSDOM) — konsistent mit dem in der Testdatei dokumentierten
  Grundmuster. Ein grundlegend anderer Umbau von `handleAssignRange` (z. B. Verschieben der
  Prüfungen in eine ausgelagerte Hilfsfunktion außerhalb des per `sliceFunction` isolierten
  Funktionskörpers) könnte den Wächter theoretisch umgehen, ohne dass die Ersatzstelle geprüft
  wird — dieses Risiko bestand strukturell schon vorher und ist durch AUFTRAG_22 nicht neu.
- Keine Abweichung von Positiv-/Negativliste, kein `git commit`/`push`/etc. ausgeführt.
- Keine Hilfsdateien im Vault hinterlassen; alle Zwischenstände lagen ausschließlich unter
  `/tmp/wstest/` in der isolierten Shell-Umgebung.
