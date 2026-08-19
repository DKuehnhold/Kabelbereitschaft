# REVIEW 14 (Dispo-Board, Migration 0022): **grün**

> Stand: 2026-08-17. Verfasst von Claude (Orchestrator/Review, Chat 1).

## Selbst geprüft

- **Unique-Umbau ohne Bestandsrisiko:** zwei **partielle** Unique-Indizes —
  `(construction_stage_id, plan_date, technician_id) where assignment_kind='bereitschaft'`
  und `(plan_date, technician_id) where assignment_kind='dispo'`. Damit bleibt die
  Bereitschafts-Eindeutigkeit exakt wie in 0021, und die Dispo-Zeile ohne Bauabschnitt ist
  je Tag/Techniker eindeutig. `assignment_kind` mit Default `'bereitschaft'` und
  Check-Constraint; `construction_stage_id` per `drop not null` idempotent nullable.
  Der Stopppunkt „Gefahr für Bestandsdaten" war damit zu Recht nicht ausgelöst.
- **Beide Bedienebenen vorhanden** (Auftragspflicht): 10 DnD-Handles (`draggable`,
  `onDragStart`, `onDrop`) **und** 16 `onClick`-Bedienpfade in
  `components/on-call-plan/OnCallPlanClient.tsx` — die Klick-Ebene ist nicht wegoptimiert
  worden, das Board bleibt auf Touch benutzbar.
- Qualifikationen: Farbe nur als **Palettenschlüssel** in der DB (Check-Constraint), Tokens
  additiv — bestehende Farben unberührt. Keine erfundenen Startwerte (leerer Katalog).
- **Selbst gemessen:** `node --test test/*.test.mjs` **177/177, 0 fail** (Baseline 162 + 15).
- CI-Namenswächter jetzt Regex-tolerant — der Merkposten aus REVIEW_10 ist damit erledigt.

## Bewusst nicht umgesetzt (akzeptiert)

„Mehrere Tage auf einmal" — laut Meldung strukturelle Erweiterung; der Auftrag hatte das
ausdrücklich unter „nur wenn ohne Umbau möglich" gestellt. Bleibt Wunschposten für den
Formular-Durchgang; die Mehrfachzuweisung ist heute über wiederholtes Ziehen/Klicken möglich.

## Offene Nachweise

- **DB-Nachweis 0022 + Smoke 29** → CI-Job `database` nach dem nächsten Commit. Zusammen mit
  0019/0020/0021 sind damit **vier** Migrationen ohne echten DB-Lauf — der nächste CI-Lauf ist
  entsprechend wichtig.
- `npm run build` erneut ohne Ergebnis (Sandbox-Zeitlimit) → lokal durch Dennis.

## Ergebnis

**Grün** (mit CI-/Build-Auflage). Kein Commit, kein Push. Damit ist Abschnitt D der
GUI-Runde 2 abgearbeitet. Offen aus Runde 2: Stammdaten (Akkordeon, Reihenfolge, CSV-Import
mit Vorlagen, Kontakte-Wizard), Bereitschaftsnummer aus der Erfassung entfernen — und danach
der gemeinsame Formular-Durchgang mit Dennis.
