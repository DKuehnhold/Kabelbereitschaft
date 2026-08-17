# REVIEW 6 zu AUFTRAG_6 / MELDUNG_6 (Stammdaten-Kataloge, Migration 0019): **grün**

> Stand: 2026-08-17. Verfasst von Claude (Orchestrator/Review, Chat 1); Ausführung durch
> Sonnet-Agent unter Chat-1-Orchestrierung.

## Eigene Prüfung

- **Migration 0019 vollständig gegengelesen:** Identitätsquelle korrekt
  `app.current_user_id()` (inkl. zutreffender Begründung, warum `auth.uid()` seit 0013 nicht
  mehr existiert); RLS auf allen drei Tabellen mit select-(angemeldet) und
  write-(is_staff)-Policies nach Bestandsmuster; Grants nur an `app_user`, ausdrücklich kein
  delete; Seeds idempotent über `on conflict (label)`; FK `contacts.function_id` nullable und
  nicht kaskadierend, per Prüfblock belegt; vier fail-closed Abschlussprüfungen
  (Positiv-/Negativrechte, RLS+Policy-Anzahl, Seeds, FK-Typ). Bewusste, offengelegte
  Abweichung (kein `code`/`sort_order`) ist durch den Auftragswortlaut gedeckt.
- **Selbst gemessen:** `node --test test/*.test.mjs` **122/122, 0 fail** (Baseline 115 + 7
  neue Wächter-/Kassentests, offen deklariert).
- CRLF-Befund an `run_db_tests.sh` (bash -n Exit 2 auf der Arbeitsbaumdatei): reine
  Zeilenenden-Konvertierung des OneDrive-Arbeitsbaums, LF-normalisiert Exit 0. Unkritisch,
  weil Dennis' git bei Commits nach LF normalisiert (belegt: CI-Lauf zu `986f891` war grün,
  derselbe Läufer lief dort fehlerfrei).

## Auflagen / Merkposten

- **Der DB-Nachweis für 0019 + Smoke 26 steht aus** und wird durch den CI-Job `database`
  nach Dennis' nächstem Commit erbracht — in der Sandbox nicht möglich. Bis dahin: keine
  fachliche Abnahme der Migration, nur Code-Review grün.
- Kleinigkeit (kein Blocker): benennt die Dispo einen Seed-Wert um, würde ein erneuter
  Migrationslauf den Ursprungswert wieder einfügen (`on conflict` greift nur bei identischem
  Label). Produktiv läuft jede Migration genau einmal — als Hinweis dokumentiert.

## Ergebnis

**Grün** (mit CI-Auflage wie oben). Kein Commit, kein Push. Nächste Scheibe: AUFTRAG_7
(Anrufdaten + „In Klärung", Migration 0020).
