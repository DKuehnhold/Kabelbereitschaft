# AUFTRAG 8: Meldungsliste — Labels, „In Klärung"-Sicht und Gewerk-Spalte

> Stand: 2026-08-17. Verfasst von Claude (Orchestrator/Review, Chat 1).
> Voraussetzung: REVIEW_7 grün. Grundlage: Entscheidungen Dennis (Begriff „Meldung",
> „In Klärung" als Kennzeichen, Excel-Vorbild BA-Blätter).

## Ziel

Die operative Liste und die Detail-Bedienelemente auf den neuen Stand bringen:

1. **Sichtbare Labels** auf der Listen-Seite (`vorgaenge/page.tsx`, `OperationalList.tsx`
   und ggf. dort eingebundene Kopf-/Leertexte): „Meldungen", „Meldung", Einzahl/Mehrzahl
   konsistent. Nur sichtbare Texte dieser Seite(n) — Navigation/AppShell-Menüpunkt
   „Vorgänge" darf mit umbenannt werden, wenn er ein reiner Anzeigetext ist (offenlegen).
2. **„In Klärung"-Kennzeichen sichtbar und bedienbar:**
   - Badge/Kennzeichnung in der Listenzeile (analog zur Fehlalarm-Darstellung, dezent).
   - Filter `klaerung=1|0` exakt nach dem `fehlalarm`-Muster (incident-list.ts,
     incident-list-url.ts, fetchList mit Vorabtypprüfung wie `falseAlarm`, Filter-UI in
     OperationalList).
   - Umschalter im Detail (`IncidentControls.tsx`) analog zum Fehlalarm-Umschalter, aber
     OHNE Rollen-Sichtbarkeitsbeschränkung (Entscheidung Dennis: setzbar von jedem, der die
     Meldung ändern darf — die RLS-Policy entscheidet; 42501 → freundliche Meldung).
     Neue Server-Action `setIncidentInClarification` nach dem exakten Muster von
     `setFalseAlarm`/`setIncidentFalseAlarm` (withUserTransaction, parametrisiert,
     SQLSTATE-Klassifizierung), Feld nur `is_in_clarification`.
3. **Gewerk in der Liste:** Spalte/Anzeige `trade_label` (aus der View, seit 0020) in der
   Listenzeile; leerer Wert = „–". Kein Filter in dieser Scheibe.

## Negativliste

- Keine Migration, kein SQL (0020 liefert alles Nötige), keine Policy-Änderung.
- Keine CSV-/Exportänderung, keine Statusmodell-Änderung, keine globale Umbenennung
  außerhalb der genannten Sichttexte, keine Routenänderung.
- Keine Änderung an `.claude/**`, Läufern, CI, PROJEKT_WISSEN, PROJEKTSTATUS, CHAT_STATUS.
- Kein Commit/Push.

## DoD

- tsc Exit 0; ESLint auf geänderten Dateien Exit 0.
- `node --test test/*.test.mjs` ohne roten Eintrag (Baseline 139; URL-Roundtrip-Tests für
  `klaerung` nach dem Muster von `ap15b-incident-list-url.test.mjs` ergänzen, neue Zahl
  deklarieren).
- FormData-/Query-Verträge des Bestands unverändert (nur additive Parameter).
- `npm run build` ein Versuch (EPERM-Limit bekannt).
- MELDUNG_8.md nach bekanntem Muster.

## Stopppunkt

Anhalten und als BLOCKER melden, wenn: die Listen-Darstellung eine echte Designentscheidung
erzwingt, die über „analog Fehlalarm, dezent" hinausgeht; das setFalseAlarm-Muster nicht
übertragbar ist; oder derselbe Fehler dreimal auftritt.
