# REVIEW 13 (Lesbarkeit Eingabefelder + Anmeldeseite auf Rot/Schwarz): **grün**

> Stand: 2026-08-17. Verfasst von Claude (Orchestrator/Review, Chat 1).

## Selbst geprüft

- `color-scheme: light` bzw. `dark` in beiden Modus-Blöcken gesetzt — das war die **wahre
  Ursache** des Lesbarkeitsproblems (der Browser durfte bei System-Dark-Mode eigene
  Feldfarben wählen, Ergebnis war hell auf hell). Die Analyse des Agenten geht damit über
  meine Vorab-Vermutung (`.input`-Token zu blass) hinaus und trifft das Problem an der
  Wurzel — richtig so.
- Neue Tokens `--field-bg`/`--field-fg`/`--field-placeholder` vorhanden, generische
  `input/textarea/select`-Basisregel deckt auch shadcn-Varianten ab, `-webkit-autofill`
  behandelt.
- `LoginForm.tsx`: **0** Treffer für `blue-` (vorher 3 Fundstellen) — Anmeldeseite läuft
  vollständig über Tokens.
- **Selbst gemessen:** `node --test test/*.test.mjs` **162/162, 0 fail**.
- Kontrastwerte plausibel und dokumentiert (Eingabetext ~17:1 hell / ~16:1 dunkel;
  Platzhalter 7,7:1 / 9,1:1) — Zielwerte des Auftrags erfüllt.

## Bewusst offen (nachvollziehbar begründet, kein Blocker)

- Primärbutton im Dark Mode: weiß auf `#dc2626` ≈ **3,9:1** — für großen Fetttext nach WCAG
  zulässig, für normalen Text unter dem Ideal. Merkposten für den Formular-Durchgang mit
  Dennis: entweder dunkleres Rot im Dark Mode oder schwarze Buttonschrift.
- Status-/Prioritäts-Badges, StatCard-/Timeline-Akzente bleiben mehrfarbig (bewusste
  Legenden-Farbigkeit) — Umstellung wäre eine eigene Designentscheidung.
- `NavLinks.tsx`/`AppHeader.tsx` bleiben totes Markup (Aufräum-Merkposten aus REVIEW_11_12).

## Ergebnis

**Grün.** Kein Commit, kein Push. Nächste Scheibe: AUFTRAG_14 (Dispo-Board), danach der
gemeinsame Formular-Durchgang mit Dennis.
