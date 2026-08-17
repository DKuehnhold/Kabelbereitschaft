# AUFTRAG 10: Bereitschaftsplan (Einsatzplanung) — Datenmodell + Wochenansicht (Migration 0021)

> Stand: 2026-08-17. Grundlage: Excel-Blatt „Einsatzplanung" (Matrix BA × Kalendertag mit
> Mitarbeitern; `99-Anlagen/Bereitschaftsuebersicht_…xlsx`), Entscheidung Dennis
> (Bereitschaftsplan nach Erfassung + Liste, vor Disponentenansicht). Die Excel-Matrix IST
> die Designvorgabe. Voraussetzung: REVIEW_9 grün.

## Ziel

Wer hat wann je Bauabschnitt Bereitschaft — pflegbar in einer Wochenansicht.

## Umfang

1. **Migration `0021_hlk_bereitschaftsplan.sql`** (additiv, idempotent, Muster 0019):
   Tabelle `public.on_call_plan` (id uuid pk, `construction_stage_id` FK
   construction_stages nicht kaskadierend, `plan_date date not null`, `technician_id` FK
   technicians nicht kaskadierend, Audit-Spalten/Trigger wie Bestand,
   `unique (construction_stage_id, plan_date, technician_id)` — mehrere Personen je
   BA/Tag sind zulässig wie in der Excel). RLS: select für Angemeldete, insert/delete für
   Staff (Zuweisungen werden ENTFERNT statt deaktiviert — anders als Kataloge; ein
   `update` ist fachlich nicht nötig, daher weder Policy-Bedarf noch Grant dafür).
   Grants an app_user: select/insert/delete (ausnahmsweise delete — begründet: eine
   Zuweisungszeile ist keine Historie, sondern Planungszustand; Audit-Trigger
   protokolliert das delete). Fail-closed Prüfblöcke wie 0019.
2. **SQL-Smoke `28_hlk_bereitschaftsplan.sql`** (Fallkennung Z): Idempotenz, Unique,
   Rollenmatrix (Monteur liest, schreibt nicht; Staff legt an/entfernt), FKs nicht
   kaskadierend, Audit bei delete. Läufer-Verdrahtung (beide Runner hinter 0020/27),
   CI-Schrittname „0001-0021, Smokes 15-28".
3. **Lib `on-call-plan.ts` + Actions `on-call-plan-actions.ts`** nach Bestandsmustern:
   `listOnCallWeek(weekStartIso)` (7 Tage ab Montag, Europe/Berlin über date-local-
   Konventionen), `assignOnCall(stageId, dateIso, technicianId)`,
   `removeOnCall(entryId)`; Staff-Allowlist wie STAFF_ALLOWED_ROLES-Muster,
   withUserTransaction, parametrisiert, SQLSTATE (23505-Duplikat → freundliche Meldung).
4. **Seite `/bereitschaftsplan`** (Route in der `(app)`-Gruppe, Navigationseintrag
   „Bereitschaftsplan" für alle Rollen sichtbar): Wochenansicht wie die Excel — Zeilen =
   aktive Bauabschnitte, Spalten = Mo–So mit Datum, Zellen = zugewiesene Techniker
   (Kürzel/Name als kleine Badges), Staff kann je Zelle hinzufügen (Select aus aktiven
   Technikern) und entfernen (×); Vor-/Zurück-Navigation je Woche, „Heute"-Sprung;
   Monteure sehen read-only. Mobil: Tageskarten untereinander statt Matrix (gleiehe
   Daten, keine eigene Designentscheidung — schlichtestes Muster der bestehenden
   Mobilkarten der Liste). shadcn-Komponenten verwenden, Touchziele ≥44px.
5. **Tests:** URL-/Datums-Helfer als Unit-Test (Wochenstart Europe/Berlin, DST-Fall);
   statischer Allowlist-Wächter. Neue Gesamtzahl offen deklarieren (Baseline 143).

## Negativliste

- Keine Änderung an incidents-Pfaden, Dashboard, Disponenten-/Detailansichten.
- Keine Kürzel-Logik erfinden (Anzeige = vorhandene Technikernamen; das Excel-Kürzel-
  System kommt ggf. später als eigene Entscheidung).
- Kein `.claude/**`, keine Bestandsmigrationen, kein PROJEKT_WISSEN/PROJEKTSTATUS/
  CHAT_STATUS. Kein Commit/Push.

## DoD

- tsc Exit 0; ESLint Exit 0 (alle neuen/geänderten Dateien); `node --test test/*.test.mjs`
  kein roter Eintrag (neue Zahl deklarieren); LF-normalisiertes `bash -n` auf
  run_db_tests.sh Exit 0; `npm run build` ein Versuch (EPERM-Limit bekannt); SQL-Nachweis
  an CI-Job `database` delegiert und so dokumentiert. MELDUNG_10.md nach Muster.

## Stopppunkt

Anhalten und BLOCKER melden bei: Unklarheit im technicians-Bestandsmodell (z. B. fehlende
Aktiv-Kennzeichnung), Designfrage über „wie die Excel-Matrix, schlichtestes Muster" hinaus,
drittem identischem Fehler.
