# AUFTRAG 9: npm-Skripte pfadsicher machen (dev/build/start)

> Stand: 2026-08-17. Verfasst von Claude (Orchestrator/Review, Chat 1).
> Anlass: `npm run dev`/`build`/`start` scheitern auf Dennis' Rechner am `&` im
> OneDrive-Pfad („W & S Technik GmbH") — bekanntes cmd-Shim-Problem. `typecheck` und
> `lint` sind bereits auf direkte node-Aufrufe umgestellt (Vorbild).

## Ziel

In `app/package.json` die drei Skripte auf direkte node-Aufrufe umstellen:

- `"dev": "node ./node_modules/next/dist/bin/next dev"`
- `"build": "node ./node_modules/next/dist/bin/next build"`
- `"start": "node ./node_modules/next/dist/bin/next start"`

Kommentar ist in JSON nicht möglich — Begründung gehört in die MELDUNG, nicht in die Datei.

## Zusatzpunkt (gleiche Scheibe, Branding-Rest aus REVIEW zu AUFTRAG_4)

In `app/public/branding/logo.svg` den Textinhalt „Kabelbereitschaft" durch
„Bereitschaftsapp HLK" ersetzen (nur der `<text>`-Inhalt; Platzhalter-Charakter und
Hinweiszeile „Logo-Platzhalter · bitte ersetzen" bleiben — das echte Logo liefert Dennis
später, Branding bleibt separat).

## Positivliste

- `app/package.json` (nur die drei Skriptzeilen)
- `app/public/branding/logo.svg` (nur der eine Textinhalt)

## Negativliste

- Keine anderen Skripte, keine Abhängigkeiten, kein Lockfile-Umbau (ein durch npm selbst
  nachgezogenes Lockfile wäre offenzulegen), nichts sonst. Kein Commit/Push.

## DoD

- `npm run build` startet den Next-Build ohne „Cannot find module …\next" (der Build darf
  am bekannten EPERM-Mount-Limit scheitern — entscheidend ist, dass Next korrekt startet
  und kompiliert; „Compiled successfully" im Log genügt als Nachweis, ein Versuch).
- `node --test test/*.test.mjs`: unverändert kein roter Eintrag (Baseline 143).
- MELDUNG_9.md kurz (Mini-Scheibe).
