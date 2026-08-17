# AUFTRAG 7: Anrufdaten an der Meldung + „In Klärung"-Kennzeichen (Migration 0020)

> Stand: 2026-08-17. Verfasst von Claude (Orchestrator/Review, Chat 1). Grundlage:
> `01-Anforderungen/ANFORDERUNG_DISPO_METADATEN.md` (Excel-Blöcke „Meldung"/„Bearbeitung")
> und Entscheidungen Dennis vom 2026-08-16. Voraussetzung: REVIEW_6 grün.

## Fachliche Festlegungen (verbindlich für diesen Auftrag)

- **Annahme = Anlage.** Die Excel führt Anrufzeit UND Annahmezeit, weil sie ein Papierfluss
  ist. In der App ist die Annahme der Anlagezeitpunkt: `created_at`/`created_by` existieren
  bereits und bilden „Annahme Datum/Uhrzeit/Mitarbeiter" ab. Es werden KEINE Spalten
  `accepted_at`/`accepted_by` angelegt.
- **Anrufzeitpunkt** ist neu: `incidents.reported_at timestamptz` (nullable, kein Default —
  Bestandsmeldungen bleiben NULL; die Erfassung belegt das Feld vor, editierbar).
- **Anrufender:** neue Spalte `incidents.caller_contact_id uuid` (nullable, FK auf
  `contacts(id)`, nicht kaskadierend). Die bestehenden Freitext-Fallbacks
  `caller_name`/`caller_contact` bleiben unverändert bestehen.
- **Gewerk an der Meldung:** `incidents.trade_id uuid` (nullable, FK auf `trades(id)`,
  nicht kaskadierend), optionales Auswahlfeld in der Erfassung (Störungs-Spalte).
- **„In Klärung":** `incidents.is_in_clarification boolean not null default false`
  (Namensschema wie `is_false_alarm`; idempotente Herstellung exakt nach dem
  0018-Abschnitt-1-Muster 1a–1e sinngemäß, hier ohne Wächter). KEIN Wächter-Trigger, KEINE
  Rollenbeschränkung über die bestehende `incidents_update`-Policy hinaus (Entscheidung
  Dennis: Kennzeichen, kein Status; setzbar von jedem, der die Meldung ändern darf).
  UI-Umschalter dafür kommt mit der Listen-/Detailscheibe (AUFTRAG_8), NICHT hier.

## Umfang

1. **Migration `0020_hlk_meldung_anrufdaten.sql`** (additiv, idempotent): die vier Spalten
   wie oben; `incident_list_view` neu definieren mit `is_in_clarification`, `trade_id` und
   `trade_label` (Join auf `trades`) **ausschließlich ans ENDE der Spaltenliste angehängt**
   (Regel aus 0018: bestehende Spalten behalten Position); fail-closed Prüfblöcke
   (Spalten vorhanden inkl. NOT-NULL/Default-Zustand von `is_in_clarification`, FKs nicht
   kaskadierend, View enthält die neuen Spalten am Ende).
2. **SQL-Smoke `27_hlk_anrufdaten.sql`** (Fallkennung Y): Idempotenz-Doppellauf,
   Spaltenzustände, FK-Verhalten, View-Spalten, RLS-Gegenprobe (Monteur sieht/ändert nur
   gemäß bestehender Policies — keine Policy-Änderung!). Läufer-Verdrahtung (beide Runner
   hinter 0019/26) + CI-Schrittname „0001-0020, Smokes 15-27".
3. **Datenpfad:** `createIncident()` (`incident-actions.ts`) nimmt `reported_at`
   (datetime-local, Europe-Berlin-korrekt über die bestehenden Konventionen),
   `caller_contact_id` und `trade_id` als optionale FormData-Felder entgegen
   (parametrisiert, SQLSTATE-Klassifizierung wie Bestand); `incidents.ts`-Insert um die
   drei Spalten ergänzen; Detail-/Listen-Datentypen (`database.types.ts`, `incident-list.ts`
   Row-Typ) additiv erweitern. CSV-Exporte: NICHT anfassen (eigene Scheibe).
4. **Erfassung (`NewIncidentForm.tsx`):** neuer Block „Anruf" im Pflichtbereich der
   Zuordnungs-Spalte: Anrufzeit (datetime-local, vorbelegt mit jetzt, editierbar, optional),
   Anrufender als Auswahl über den BESTEHENDEN `ContactSelector` (falls er dafür geeignet
   ist — sonst einfaches Select über die bestehende Kontaktliste; Freitext-Fallbacks bleiben
   im optionalen Abschnitt), Gewerk-Select (optional) in der Störungs-Spalte. Layout
   Variante A beibehalten.
5. **Unit-Tests:** Erweiterung nach Bedarf (FormData-Wächter analog ap15b-callers-Muster);
   neue Gesamtzahl offen deklarieren (aktuelle Baseline 122).

## Negativliste

- Keine Policy-/Wächter-Änderungen, keine Statusmodell-Änderung (Fehlalarm-Status-Ablösung
  ist eine SPÄTERE eigene Scheibe), keine CSV-/Exportänderung, keine Änderung an
  Bestandsmigrationen, keine Listen-/Detail-UI (nur Erfassung).
- Keine Änderung an `.claude/**`, `run-orchestrator.ps1`/`run-programmer.ps1`,
  PROJEKT_WISSEN, PROJEKTSTATUS, CHAT_STATUS. Kein Commit/Push.

## DoD

- tsc Exit 0; ESLint auf allen geänderten Dateien Exit 0; `node --test test/*.test.mjs`
  ohne roten Eintrag (Baseline 122, neue Zahl deklarieren); `bash -n` auf dem
  LF-normalisierten Läufer Exit 0; `npm run build` ein Versuch (EPERM-Limit bekannt);
  SQL-Nachweis ausdrücklich an den CI-Job `database` delegiert und so dokumentiert.
- MELDUNG_7.md nach bekanntem Muster.

## Stopppunkt

Anhalten und als BLOCKER melden, wenn: die View-Neudefinition bestehende Spaltenpositionen
verändern müsste; `createIncident` strukturell umgebaut werden müsste (mehr als additive
Felder); der ContactSelector nicht passt UND kein einfaches Select mit Bestandsmitteln
möglich ist; oder derselbe Fehler dreimal auftritt.
