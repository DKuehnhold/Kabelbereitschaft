# AUFTRAG 2 an den Worker-Chat: Exportberechtigung als Positivliste (Befund F10)

> Stand: 2026-08-16. Verfasst von Claude (Rolle Orchestrator/Review, Cowork-Chat 1).
> Voraussetzung: `REVIEW_1.md` ist grün; Einzelschreiberregel beachten — während dieses Auftrags
> schreibt nur der Worker im Vault.

## Ziel

Die CSV-Exportberechtigung in `app/src/lib/incident-list-actions.ts` von der Negativliste
(`!session || session.role === "monteur"` → abweisen) auf eine **ausdrückliche Allowlist**
umstellen — **ohne Verhaltensänderung**: erlaubt bleiben exakt `admin` und `disponent`, die
sichtbaren Meldungstexte bleiben unverändert. Eine künftig ergänzte vierte Rolle darf nicht
länger durch Schweigen exportberechtigt sein.

**Vorbild ist die bereits freigegebene F1-Korrektur** in `inventory-actions.ts`
(`createMovement()`: Allowlist `admin`/`disponent` statt Verbotsliste `monteur`, Meldungstext
unverändert — siehe `PROJEKT_WISSEN.md`, Abschnitt „Reviewkorrektur Rollenprüfung (F1)").

**Ausdrücklich NICHT Teil dieses Auftrags:** die offene Rollenfrage, ob der Disponent überhaupt
exportieren darf (`ROLLEN_UND_RECHTE.md` nennt nur den Administrator) — das ist eine Entscheidung
von Dennis. Dieser Auftrag konserviert das heutige Verhalten nur in sicherer Form.

## Positivliste

- `app/src/lib/incident-list-actions.ts` (alle Export-/Listen-Rollenprüfungen dieser Datei,
  die heute als Negativliste formuliert sind — nach jetzigem Stand die Prüfungen in
  `exportIncidentList`, `exportIncidentListFull` und den beiden Bulk-Aktionen um Zeile 172/212)
- Falls für die Prüfung nötig: **eine** neue oder erweiterte Unit-Testdatei unter `app/test/`
  (z. B. Erweiterung von `app/test/ap15b-callers.test.mjs` oder eine neue
  `ap15b-export-allowlist.test.mjs` nach dem `registerHooks()`-Muster aus AUFTRAG_1)

## Negativliste

- Keine Änderung an der **Menge** der erlaubten Rollen (heute: `admin`, `disponent`) und an
  sichtbaren Meldungstexten.
- Keine Änderung an `incidents.ts`, Migrationen, SQL, RLS, `incident-list.ts`, UI-Komponenten.
- Keine Änderung an `.claude/**`, `run-*.ps1`, `PROJEKT_WISSEN.md`, `PROJEKTSTATUS.md`.
- Kein Commit, kein Push, kein Merge/Tag/Release.

## Abnahmekriterium (DoD)

- Rollenprüfungen der Datei als Allowlist (`admin` | `disponent`), keine Negativliste mehr;
  idealerweise eine gemeinsame, benannte Konstante/Hilfsfunktion statt Mehrfachvergleichen.
- `node --test test/*.test.mjs` (aus `app/`): kein neuer roter Eintrag; Baseline 64 Einträge,
  63 pass, einzig `ap14b-auth.test.mjs` rot (umgebungsbedingt). Neue/erweiterte Tests grün und
  in der Gesamtzahl offen deklariert.
- `npx tsc --noEmit` bzw. `npm run typecheck` und ESLint auf der geänderten Datei: Exit 0.
- Tatsächlich erhobene Ausgaben mit Exit-Codes in der Meldung; keine behaupteten Werte.

## Stopppunkt

Anhalten und melden, wenn: sich herausstellt, dass weitere Dateien geändert werden müssten;
die heutige erlaubte Rollenmenge doch nicht `admin`+`disponent` ist; derselbe Fehler dreimal
auftritt; oder ein anderer Schreibzugriff im Vault bemerkt wird.

## Meldeweg

`00-Projektsteuerung/MELDUNG_2.md` (Konvention wie MELDUNG_1: geänderte Dateien, Diff-Kurzform,
exakte Prüfergebnisse, git-status-Auszug, Aussage „kein Commit, kein Push"). Danach stoppen —
Review durch Chat 1 als `REVIEW_2.md`.
