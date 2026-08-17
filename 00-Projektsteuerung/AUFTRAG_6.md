# AUFTRAG 6: Pflegbare Stammdaten-Kataloge Gewerk, Funktion, Objektart (Migration 0019)

> Stand: 2026-08-17. Verfasst von Claude (Orchestrator/Review, Chat 1). Grundlage:
> Entscheidungen Dennis vom 2026-08-16 (zweiter Block, PROJEKT_WISSEN.md) und
> `01-Anforderungen/ANFORDERUNG_DISPO_METADATEN.md`. Ausführung durch Sonnet-Agent
> unter Chat-1-Orchestrierung. Voraussetzung: REVIEW_5 grün.

## Ziel

Drei neue, von der Dispo pflegbare Kataloge nach dem bestehenden Muster der
Stammdaten (Vorbild: Kabelarten/`cable_types`):

1. **Gewerke** — Startwerte: 50 Hz, LST, TK, OSE, LWL-LST, LWL-TK, Unbekannt.
2. **Funktionen** (des Anrufenden/Ansprechpartners) — Startwerte: BÜW, LBÜW, örtl. LST.
3. **Objektarten** (Anlagen, inkl. LST-Elemente) — Startwerte: BÜ, LSW.

Dazu: **Funktion am Ansprechpartner** — neue optionale Spalte an `contacts`
(FK auf Funktionen-Katalog) plus Auswahlfeld in der bestehenden Pflegeseite
`stammdaten/ansprechpartner`.

## Umfang

1. **Migration `0019_hlk_katalog_stammdaten.sql`** (additiv, idempotent im Stil von 0018
   Abschnitt 1): drei Tabellen nach dem Muster von `cable_types` (id, label, is_active,
   Audit-Spalten/Trigger wie im Bestand), RLS-Policies exakt nach dem Muster der bestehenden
   Stammdatentabellen (lesen alle Rollen, schreiben Staff), Grants NUR an `app_user`
   (select/insert/update, KEIN delete — Deaktivierung über `is_active`), Seed der Startwerte
   idempotent (`on conflict do nothing` bzw. Existenzprüfung), Spalte
   `contacts.function_id` (nullable, FK, `on delete` NICHT kaskadierend), fail-closed
   Prüfblöcke am Ende (Positiv-/Negativrechte) wie in 0014/0015.
2. **SQL-Smoke `26_hlk_kataloge.sql`** (Fallkennung X): Idempotenz-Doppellauf der Migration,
   Seeds vorhanden, Rollenmatrix (Monteur darf lesen, nicht schreiben; Disponent/Admin
   schreiben; app_user kein delete), FK-Verhalten von `contacts.function_id`.
3. **Läufer-Verdrahtung:** 0019 und Smoke 26 in `app/supabase/test/run_db_tests.sh` UND
   `run_ap14b_local.ps1` hinter 0018/25 einketten (gleiche Konvention); CI-Schrittname in
   `.github/workflows/ci.yml` auf „0001-0019, Smokes 15-26" anpassen.
4. **`masterdata.ts`/`masterdata-actions.ts`:** list/save-Funktionen für die drei Kataloge
   nach dem exakten Muster der bestehenden (withUserTransaction, Identität aus
   getSessionProfile, parametrisiertes SQL, SQLSTATE-Klassifizierung, Rollen-Allowlist wie
   Bestand); Ansprechpartner-Funktionen um `function_id` erweitern.
5. **Drei Pflegeseiten** `stammdaten/gewerke`, `stammdaten/funktionen`,
   `stammdaten/objektarten` nach dem exakten Muster der Kabelarten-Seite (Liste +
   anlegen/umbenennen/aktiv-inaktiv); Ansprechpartner-Seite um Funktions-Auswahl (Select,
   optional) erweitern; Navigation/Übersicht der Stammdaten um die drei Einträge ergänzen.
6. **Unit-Tests:** mindestens ein statischer Wächtertest nach dem Muster von
   `ap15b-callers.test.mjs` (Allowlist statt Negativliste in den neuen Actions) — offen
   deklarieren, wie sich die Testzahl ändert.

## Negativliste

- Keine Änderung an `incidents`-Tabellen/-Pfaden (Gewerk-Feld an der Meldung kommt mit
  AUFTRAG_7), keine bestehende Migration ändern, keine Policy des Bestands lockern.
- Keine Änderung an `.claude/**`, `run-orchestrator/run-programmer.ps1`, PROJEKT_WISSEN,
  PROJEKTSTATUS, CHAT_STATUS. Kein Commit/Push.

## DoD

- tsc Exit 0; ESLint auf allen neuen/geänderten Dateien Exit 0; `node --test test/*.test.mjs`
  ohne roten Eintrag (Baseline 115, neue Zahl offen deklarieren).
- Migration/Smoke syntaktisch geprüft (mindestens `bash -n` für Läufer; SQL-Lauf gegen echte
  DB ist in der Sandbox nicht möglich → wird durch den CI-Job `database` nach Dennis' Commit
  erbracht, das ausdrücklich so dokumentieren).
- `npm run build`: ein Versuch, Ergebnis dokumentieren (EPERM-Mount-Limit bekannt).
- MELDUNG_6.md nach bekanntem Muster.

## Stopppunkt

Anhalten und als BLOCKER melden, wenn: das cable_types-Muster nicht 1:1 übertragbar ist
(z. B. abweichende Audit-Trigger), eine RLS-/Rechtefrage nicht durch den Bestand beantwortet
ist, oder derselbe Fehler dreimal auftritt.
