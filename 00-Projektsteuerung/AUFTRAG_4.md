# AUFTRAG 4 an den Worker-Chat: Branding „Bereitschaftsapp HLK"

> Stand: 2026-08-16. Verfasst von Claude (Rolle Orchestrator/Review, Cowork-Chat 1).
> Grundlage: Entscheidung Dennis vom 2026-08-16 (PROJEKT_WISSEN.md, „Entscheidungen Dennis
> vom 2026-08-16": App-Name „Bereitschaftsapp HLK"). Voraussetzung: REVIEW_3 ist grün
> (mit Auflage Build-Gegenprüfung lokal — betrifft diesen Auftrag mit, s. DoD).
> Einzelschreiberregel beachten.

## Ziel

Den sichtbaren App-Namen von „Kabelbereitschaft" auf **„Bereitschaftsapp HLK"** umstellen —
ausschließlich sichtbare Titel/Labels und PWA-Metadaten. Keine technischen Bezeichner,
keine Routen, keine Datenbank-/Code-Namen.

## Umfang (vollständige Fundstellenliste, vom Review-Chat per grep erhoben)

1. `src/app/layout.tsx`: `title`, `description`, `applicationName`, `appleWebApp.title`
   (Zeilen 10–14). Beschreibungstext sinngemäß anpassen (z. B. „Bereitschaftsapp HLK –
   Erfassung und Dokumentation von Bereitschaftsvorgängen").
2. `src/app/manifest.ts`: `name` (und `short_name`, falls vorhanden). Ein sinnvoller
   `short_name` (≤ 12 Zeichen, z. B. „HLK") darf gewählt werden — offenlegen.
3. `src/components/AppHeader.tsx`: sichtbarer Titel (Zeile 20).
4. `src/app/login/LoginForm.tsx`: sichtbarer Titel (Zeile 30).
5. `src/app/offline/page.tsx`: Seitentitel (Zeile 4).

**Nicht anfassen:** `src/lib/database.types.ts` (nur Code-Kommentar, nicht sichtbar) und
alle weiteren Vorkommen in Nicht-UI-Dateien. Die Umbenennung „Vorgang" → „Meldung" ist
**nicht** Teil dieses Auftrags (eigene Arbeitsscheibe).

## Positivliste

- `app/src/app/layout.tsx` (nur die Metadata-Strings)
- `app/src/app/manifest.ts` (nur Namens-Strings)
- `app/src/components/AppHeader.tsx` (nur der sichtbare Titelstring)
- `app/src/app/login/LoginForm.tsx` (nur der sichtbare Titelstring)
- `app/src/app/offline/page.tsx` (nur der Titelstring)

## Negativliste

- Keine Änderung an Routen, API-Bezeichnern, `incidents`-Namensraum, Datenbank, Tests
  bestehender Fachlogik, `proxy.ts`, Service Worker, Logo-Grafik/Dateien.
- Keine Layout-/Struktur-/Styländerungen — reiner Stringtausch.
- Keine Änderung an `.claude/**`, `run-*.ps1`, `PROJEKT_WISSEN.md`, `PROJEKTSTATUS.md`.
- Kein Commit, kein Push.

## Abnahmekriterium (DoD)

- `grep -rn "Kabelbereitschaft" src` liefert außerhalb von `database.types.ts`
  (Kommentar) keine sichtbaren UI-/Metadata-Treffer mehr.
- `tsc --noEmit --incremental false`: Exit 0. ESLint auf den geänderten Dateien: Exit 0.
- Gesamtlauf `node --test test/*.test.mjs`: **115 Einträge, 115 pass, 0 fail** (neue
  Baseline lt. REVIEW_3) — kein neuer roter Eintrag.
- `npm run build` ist in beiden Sandboxes umgebungsbedingt blockiert (EPERM/`.fuse_hidden`
  im OneDrive-Mount, siehe REVIEW_3) — **nicht erneut mehrfach versuchen**; ein Versuch ist
  zulässig, Ergebnis offen deklarieren. Die lokale Gegenprüfung liegt bei Dennis.
- `git diff -w --stat`: ausschließlich die fünf Positivlisten-Dateien zusätzlich verändert.

## Stopppunkt

Anhalten und melden, wenn: weitere sichtbare Branding-Fundstellen auftauchen, die eine
Gestaltungs- oder Formulierungsentscheidung erfordern (z. B. E-Mail-Texte, CSV-Kopfzeilen,
Dokumenttitel); derselbe Fehler dreimal auftritt; ein fremder Schreibzugriff bemerkt wird.
CSV-Export-Inhalte und Fachtexte sind ausdrücklich NICHT umzubenennen — im Zweifel stoppen.

## Meldeweg

`00-Projektsteuerung/MELDUNG_4.md` (Konvention wie bisher). Danach stoppen — Review durch
Chat 1 als `REVIEW_4.md`.
