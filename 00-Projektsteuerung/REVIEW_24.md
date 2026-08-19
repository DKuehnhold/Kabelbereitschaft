# REVIEW_24 — Build-Blocker `MAX_RANGE_DAYS` in einer `"use server"`-Datei

> Verfasst vom Orchestrator/Review-Chat, 2026-08-18. Grundlage: `AUFTRAG_24.md`,
> `MELDUNG_24.md`, **Dennis' lokaler Build** und eigene Messungen.

## Ergebnis: **grün**, mit **einer** Auflage — der abschließende Nachweis ist Dennis' Build

## Der Fehler, und warum ihn hier niemand sehen konnte

Dennis' `npm run build` brach mit 13 Fehlern ab, alle aus **einer** Ursache:
`app/src/lib/on-call-plan-actions.ts` trägt `"use server"`, und Next.js lässt dort
**ausschließlich `async function`-Exporte** zu (Typ-Exporte sind unschädlich, sie werden beim
Übersetzen entfernt). Der in AUFTRAG_18 ergänzte Wert-Export `export const MAX_RANGE_DAYS = 92;`
verletzt das; Turbopack verwirft daraufhin **alle** Exporte des Moduls — daher zusätzlich die
zwölf Folgemeldungen „Export … doesn't exist" und „The module has no exports at all" für die
vier bestehenden Server-Actions, die selbst völlig in Ordnung sind.

**Das ist eine Lücke in meiner Prüfkette, nicht ein Ausrutscher des Agenten.** Es ist eine
Next.js-/Turbopack-Regel, keine TypeScript-Regel: Dennis' eigene Läufe zeigen `npx eslint .`
still, `npx tsc --noEmit` still und `npm run test:unit` **226/226 grün** — und den Build rot.
Ich hatte AUFTRAG_18 auf genau diese drei Prüfungen gestützt und in REVIEW_18_bis_22 als grün
geführt. Die Einschränkung „`npm run build` läuft in der Sandbox nicht" stand zwar in jedem
Review als Auflage, aber ich habe die **Fehlerklasse** nicht benannt, die dadurch unentdeckt
bleibt. Das ist jetzt nachgeholt — siehe „Absicherung".

## Behebung (selbst nachgemessen)

`MAX_RANGE_DAYS` liegt jetzt in dem neuen, seiteneffektfreien Modul
`app/src/lib/on-call-plan-limits.ts` **ohne** `"use server"`; sowohl die Actions-Datei als auch
die Client-Komponente importieren von dort.

| Prüfung | Ergebnis | Exit |
| --- | --- | --- |
| Wert-Exporte in `"use server"`-Dateien (eigene Suche über alle Dateien mit der Direktive in den ersten fünf Zeilen) | **keine** | 0 |
| Zahl `92` als Wert | steht **genau einmal**, in `on-call-plan-limits.ts:20`; die übrigen Treffer sind Kommentartexte | 0 |
| Import in beiden Verbrauchern | `on-call-plan-actions.ts:9` und `OnCallPlanClient.tsx:10`, beide `from "@/lib/on-call-plan-limits"` | 0 |
| `on-call-plan-limits.ts` trägt keine Direktive | bestätigt — die drei Treffer auf „use server" sind der erklärende Kommentar | 0 |
| `npx tsc --noEmit` | keine Ausgabe | **0** |
| `node --test test/*.test.mjs` | `# tests 227 / # pass 227 / # fail 0` | **0** |
| Umfang (Dateizeitstempel) | genau `on-call-plan-limits.ts` (neu), `on-call-plan-actions.ts`, `OnCallPlanClient.tsx`, `auftrag18-dispo-zeitraum.test.mjs` | 0 |

Das Verhalten ist unverändert: `assignOnCallRange()` und die beiden Grenzprüfungen sind
inhaltlich nicht angefasst, es ist eine reine Verlagerung der Konstanten.

## Absicherung — damit diese Fehlerklasse nicht mehr erst im Build auffällt

Neuer Wächterfall in `auftrag18-dispo-zeitraum.test.mjs`: er sammelt **alle** Dateien unter
`app/src`, deren erste fünf Zeilen die Direktive `"use server"` tragen, und verlangt, dass jeder
`export` dort `export async function` oder ein Typ-Export ist. Die Erkennung ist korrekt
gebaut — `on-call-plan-limits.ts` erwähnt die Direktive nur im Kommentar und wird richtig
**nicht** mitgezählt (eigene Gegenprobe über die erste nicht-leere Zeile jeder Datei bestätigt
dieselbe Einteilung: neun Dateien mit Direktive, die Limits-Datei ohne).

**Nachbesserung, von mir angestoßen:** der Wächter enthielt zunächst `assert.equal(…, 9)` —
also erneut eine feste Zahl, exakt die Bruchstelle, die heute schon zweimal einen
Korrekturauftrag ausgelöst hat (AUFTRAG_19: Anzahl 4; AUFTRAG_22: wörtliche Zeichenkette). Eine
künftige, völlig legitime neue Actions-Datei hätte ihn zwangsläufig rot gemacht. Ersetzt durch
eine **untere Schranke** `>= 9`, begründet kommentiert: sie schützt davor, dass der Dateiscan
ins Leere läuft und der Test stillschweigend nichts mehr prüft.

**Wirksamkeit gegengeprobt** (Muster aus AUFTRAG_19/22): Wegwerfdatei mit `"use server"` und
`export const WEGWERF_WERT = 42;` angelegt → Test **rot** mit

> `"use server"-Dateien mit einem Export, der weder async function noch Typ ist (Turbopack
> verwirft dort ALLE Exporte): …/__auftrag24-wegwerf-test.ts: export const WEGWERF_WERT = 42;`

→ Datei entfernt → wieder grün. Von mir nachgeprüft: die Wegwerfdatei existiert nicht mehr
(`ls` ohne Treffer), und der Umfang umfasst weiterhin nur die vier genannten Dateien.

## Auflage (offen, zwingend)

**Dennis muss `npm run build` erneut laufen lassen.** Ich kann diesen Nachweis nicht führen —
und genau darum ging es hier. Erwartung: Build ohne Fehler. Erst danach ist der Stand
committierbar.

## Konsequenz für die weitere Arbeit (in PROJEKT_WISSEN nachgetragen)

`tsc`, ESLint und die Unit-Tests decken die Next.js-Direktiven **nicht** ab. Jede neue Ausgabe
in oder aus einer `"use server"`-Datei ist damit erst nach einem lokalen Build bewiesen. Der
neue Wächter schließt genau diese eine Fehlerklasse; andere Direktiv-Regeln (etwa
`"use client"`-Grenzen) bleiben weiterhin nur im Build sichtbar. Ein grünes Review aus dieser
Umgebung ist deshalb ausdrücklich **ein Review ohne Build** — das gehört so in jede
Abschlussmeldung, nicht als Fußnote.
