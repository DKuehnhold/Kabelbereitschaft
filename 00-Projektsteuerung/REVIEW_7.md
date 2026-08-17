# REVIEW 7 zu AUFTRAG_7 / MELDUNG_7 (Anrufdaten + „In Klärung", Migration 0020): **grün**

> Stand: 2026-08-17. Verfasst von Claude (Orchestrator/Review, Chat 1); Ausführung durch
> Sonnet-Agent unter Chat-1-Orchestrierung.

## Eigene Prüfung (Schwerpunkte)

- **RPC-Umbau `create_incident_ap12`:** DROP+CREATE ist korrekt gehandhabt — alte
  21-Parameter-Signatur explizit gedroppt, neue Fassung `security invoker` mit
  `set search_path = public`, drei neue Parameter mit `default null`
  (rückwärtskompatibel), danach `revoke all … from public, anon, authenticated` und
  gezieltes `grant execute … to app_user`. Pflichtfeldprüfung unverändert. Einziger
  Aufrufer ist `incident-actions.ts` (positionale Bindung $22–$24, selbst verifiziert).
- **Zeitzonenbehandlung:** `reported_at` wird serverseitig über
  `parseBerlinDatetimeLocal()` fail-closed geprüft (unbrauchbarer Wert → freundliche
  Fehlermeldung, kein DB-Durchgriff) — konsistent zur bestehenden
  Europe/Berlin-Konvention.
- **View:** neue Spalten (`is_in_clarification`, `trade_id`, `trade_label`) ausschließlich
  am Ende angehängt (0018-Regel eingehalten).
- **Selbst gemessen:** `node --test test/*.test.mjs` **139/139, 0 fail** (Baseline 122 + 17
  neue, offen deklariert).
- ContactSelector-Nichteignung (Feldnamenkollision) sauber offengelegt, Lösung über
  unabhängiges Select ist im Auftragsrahmen („sonst einfaches Select").

## Auflagen

- **DB-Nachweis 0020 + Smoke 27 steht aus** → CI-Job `database` nach Dennis' nächstem
  Commit (Sandbox ohne PostgreSQL). Gleiche Auflage wie REVIEW_6 für 0019/26.
- Visuelle Abnahme des „Anruf"-Blocks und des Gewerk-Selects durch Dennis (`npm run dev`).

## Ergebnis

**Grün** (mit CI-Auflage). Kein Commit, kein Push. Nächste Scheibe: AUFTRAG_8
(Meldungsliste: Labels, In-Klärung-Sicht, Gewerk-Spalte).
