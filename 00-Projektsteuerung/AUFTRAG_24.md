# AUFTRAG_24 — Build-Blocker: `MAX_RANGE_DAYS` darf nicht aus einer `"use server"`-Datei exportiert werden

> Erteilt vom Orchestrator/Review-Chat, 2026-08-18, aus dem **lokalen Build von Dennis**.
> Höchste Priorität: der Produktions-Build scheitert, alles andere wartet.

## Befund (Dennis' Lauf, wörtlich)

```
> node ./node_modules/next/dist/bin/next build
▲ Next.js 16.2.12 (Turbopack)
> Build error occurred
Error: Turbopack build failed with 13 errors:
./src/lib/on-call-plan-actions.ts:275:1
Only async functions are allowed to be exported in a "use server" file.
> 275 | export const MAX_RANGE_DAYS = 92;
```

Folgefehler (12 weitere): `The export … was not found in module … on-call-plan-actions.ts`
für `MAX_RANGE_DAYS`, `assignOnCall`, `assignDispo`, `removeOnCall`, `moveOnCallEntry` und
`assignOnCallRange`, jeweils in der Client- und der SSR-Variante, mit dem Zusatz
**„The module has no exports at all."**

**Ursache.** `app/src/lib/on-call-plan-actions.ts` trägt `"use server"`. Next.js lässt in einer
solchen Datei **ausschließlich `async function`-Exporte** zu (Typ-Exporte sind unschädlich, sie
werden beim Übersetzen entfernt). Der in AUFTRAG_18 ergänzte Wert-Export
`export const MAX_RANGE_DAYS = 92;` verletzt das. Turbopack verwirft daraufhin **alle** Exporte
des Moduls — deshalb 13 Fehler statt einem, und deshalb sehen auch die vier Server-Actions
plötzlich wie „nicht vorhanden" aus. Es ist **ein** Defekt, nicht dreizehn.

**Warum das hier niemand gesehen hat.** Es ist eine Next.js-/Turbopack-Regel, keine
TypeScript-Regel: `npx tsc --noEmit` ergibt Exit 0, ESLint meldet nichts, und die 226 Unit-Tests
sind grün — alle drei Prüfungen kennen die Direktive nicht. Nur `npm run build` findet es, und
der läuft in den Cowork-Sandboxes umgebungsbedingt nicht (OneDrive-/FUSE-Mount). Dennis' Läufe
bestätigen das: ESLint still, `tsc` still, **226/226 grün** — und der Build rot.

**Gegenprobe, bereits gelaufen:** dieselbe Suche über **alle neun** `"use server"`-Dateien des
Projekts (`login/actions.ts`, `passwort-aendern/actions.ts`, `image-actions.ts`,
`incident-actions.ts`, `incident-list-actions.ts`, `inventory-actions.ts`,
`masterdata-actions.ts`, `on-call-plan-actions.ts`, `task-actions.ts`) ergibt **genau einen**
Treffer — Zeile 275. Es gibt keine weitere Stelle dieser Art.

## Ziel

Der Produktions-Build läuft wieder durch. `MAX_RANGE_DAYS` bleibt **eine** Quelle für Oberfläche
und Server-Action; es entsteht **kein** zweiter Zahlenwert.

## Positivliste (nur diese Pfade)

- `app/src/lib/on-call-plan-limits.ts` (**neu**)
- `app/src/lib/on-call-plan-actions.ts`
- `app/src/components/on-call-plan/OnCallPlanClient.tsx`
- `app/test/auftrag18-dispo-zeitraum.test.mjs`

## Umzusetzen

1. **Neues Modul** `app/src/lib/on-call-plan-limits.ts` — **ohne** `"use server"`, ohne Import,
   ohne Seiteneffekt, mit ausschließlich der Konstanten `MAX_RANGE_DAYS = 92` und dem
   bestehenden Begründungskommentar (Herkunft, „ein Quartal", Schutz gegen den Tippfehler im
   Jahr). Zusätzlich ein kurzer Vermerk, **warum** die Konstante hier und nicht in der
   Actions-Datei steht (Next-Regel für `"use server"`), damit sie niemand zurückschiebt.
2. `on-call-plan-actions.ts`: den Export in Zeile 275 entfernen und die Konstante stattdessen
   aus dem neuen Modul **importieren**. Die serverseitigen Grenzprüfungen in
   `assignOnCallRange()` bleiben inhaltlich **unverändert**. Prüfen und in `MELDUNG_24.md`
   ausdrücklich bestätigen, dass danach **jeder** Export dieser Datei entweder
   `export async function` oder ein reiner Typ-Export ist.
3. `OnCallPlanClient.tsx`: `MAX_RANGE_DAYS` aus dem neuen Modul importieren statt aus
   `on-call-plan-actions`. Die übrigen Importe (die vier bzw. fünf Actions und die Typen)
   bleiben unverändert. Es darf **kein** zweiter Zahlenwert entstehen.
4. `auftrag18-dispo-zeitraum.test.mjs`: die beiden Fälle, die heute `MAX_RANGE_DAYS` **in
   `on-call-plan-actions.ts`** verorten bzw. den Import **aus** `on-call-plan-actions` verlangen,
   auf das neue Modul umstellen. Die **Absicht** bleibt und ist beizubehalten: der Wert ist 92,
   und Oberfläche **und** Action beziehen ihn aus **derselben** Quelle — es gibt kein zweites
   Zahlenliteral. Keine wörtliche Pfadsuche einbauen, die beim nächsten Verschieben wieder
   bricht (Projektlehre aus AUFTRAG_19/22).
5. **Neuer Wächterfall** in derselben Testdatei, der genau diesen Build-Fehler künftig
   abfängt, ohne dass ein Build nötig ist: über **alle** Dateien in `app/src`, die
   `"use server"` tragen, prüfen, dass jeder Export entweder `export async function` oder ein
   Typ-Export ist. Das ist die eigentliche Absicherung — ohne sie fällt derselbe Fehler beim
   nächsten Mal wieder erst im Build auf.

## Negativliste (ausdrücklich verboten)

- `MAX_RANGE_DAYS` in einer der beiden Dateien **doppeln** oder die Zahl 92 ein zweites Mal
  schreiben.
- Die Grenzprüfungen, den „von–bis"-Dialog, die Doppelbelegungsprüfung, die Wortlaute oder
  irgendein Verhalten aus AUFTRAG_17/18/23 ändern. Dies ist **ausschließlich** eine Verlagerung
  der Konstanten.
- `"use server"` aus `on-call-plan-actions.ts` entfernen oder die Konstante in eine andere
  bestehende Datei mit Serverbezug (`on-call-plan.ts`, `masterdata.ts`, `db/**`) legen — der
  Client importiert sie, sie darf nichts Serverseitiges nach sich ziehen.
- Andere Produktivdateien, andere Testdateien, `globals.css`, `app/supabase/**`, `.claude/**`,
  `.github/workflows/**`.
- Neue npm-Abhängigkeit.
- `git commit`, `push`, `merge`, `tag`, `release`.

## DoD (prüfbar)

1. Geändert/neu sind **genau** die vier Dateien der Positivliste (Dateizeitstempel).
2. Aus `app/`: `npx tsc --noEmit` → **Exit 0**.
3. Aus `app/`: `node --test test/*.test.mjs` → die bisherigen **226** weiterhin grün plus der
   neue Wächterfall, `fail 0`, **Exit 0**.
4. `grep -n "92"` auf `on-call-plan-limits.ts`, `on-call-plan-actions.ts` und
   `OnCallPlanClient.tsx` → die Zahl steht **genau einmal**, im neuen Modul. Ausgabe wörtlich
   melden.
5. Nachweis, dass in `on-call-plan-actions.ts` jeder `export` entweder `export async function`
   oder `export type` ist — die verwendete Suche und ihre Ausgabe wörtlich melden.
6. Derselbe Nachweis über **alle neun** `"use server"`-Dateien (der neue Wächterfall aus Punkt 5
   der Umsetzung deckt das ab) — Ergebnis melden.
7. `MELDUNG_24.md` nennt: die vier Dateien, die Verlagerung, die Messwerte mit Exit-Codes und
   den ausdrücklichen Hinweis, dass **`npm run build` hier nicht ausführbar ist** und der
   endgültige Nachweis Dennis' lokaler Build bleibt.

## Stopppunkt

Anhalten und melden, wenn

- der Client die Konstante nicht ohne weiteren Import beziehen kann;
- `tsc` nicht Exit 0 ergibt oder ein Bestandstest rot wird;
- der neue Wächterfall in einer der acht **übrigen** `"use server"`-Dateien einen weiteren
  Verstoß findet — dann **melden**, nicht miterledigen (fremder Scope).

## Meldeweg

`00-Projektsteuerung/MELDUNG_24.md`.
