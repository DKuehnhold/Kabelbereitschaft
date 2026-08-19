# AUFTRAG_16 — Stammdaten-Übersicht `/stammdaten` als Akkordeon (Pflege inline)

> Erteilt vom Orchestrator/Review-Chat, 2026-08-18. Grundlage:
> `01-Anforderungen/ANFORDERUNG_GUI_RUNDE_2.md` Punkte 4 und 5 sowie die
> **Entscheidung Dennis vom 2026-08-18** (siehe unten). Erste Scheibe des
> Stammdaten-Blocks; der CSV-Import je Stammdatenart ist ausdrücklich **nicht** Teil
> dieses Auftrags (eigene Scheibe AUFTRAG_17).

## Entscheidung Dennis vom 2026-08-18 (verbindlich, wörtlich umzusetzen)

1. **Eine neue Seite `/stammdaten`** mit Akkordeon-Abschnitten; das Aufklappen zeigt die
   **Pflege direkt darin**, kein Seitenwechsel. Die 13 bestehenden Einzelrouten
   **bleiben unverändert bestehen** und weiterhin direkt aufrufbar.
2. **Flache Reihenfolge**, keine Obergruppen: Strecken → Bauabschnitte → Ansprechpartner →
   Rest.

## Ausgangslage (gemessen)

Es gibt heute **13** Stammdaten-Pflegeseiten unter `app/src/app/(app)/stammdaten/*/page.tsx`
und **keine** Übersichtsseite `/stammdaten`. Jede Seite ist eine dünne Server-Hülle (19–35
Zeilen): Sitzungsprüfung, Rollengate `admin`/`disponent`, Datenladung, `PageHeader`, dazu
**genau eine** Client-Komponente aus `app/src/components/masterdata/`. Diese Trennung ist die
Grundlage dieses Auftrags — die 13 Client-Komponenten werden **wiederverwendet, nicht
verändert**.

`radix-ui` (Meta-Paket, `^1.6.7`) liegt bereits als Abhängigkeit vor und enthält
nachgemessen ein `Accordion`-Modul (`node_modules/radix-ui/dist/accordion.*`, Export
`Accordion`). Unter `components/ui/shadcn/` existiert `collapsible.tsx`, aber **kein**
`accordion.tsx`. **Es wird keine neue Abhängigkeit installiert.**

## Ziel

`/stammdaten` ist der eine Ort für die Stammdatenpflege: 13 Abschnitte in der festgelegten
Reihenfolge, jeder aufklappbar, im aufgeklappten Zustand die vollständige, unveränderte
Pflegeoberfläche der jeweiligen Art. Rollengate und Verhalten der Pflege bleiben identisch
zu den Einzelseiten.

## Verbindliche Reihenfolge der 13 Abschnitte

| # | Abschnitt (sichtbarer Titel) | Route (bleibt) | Client-Komponente |
| --- | --- | --- | --- |
| 1 | VzG-Strecken | `/stammdaten/vzg` | `VzgLinesClient` |
| 2 | Bauabschnitte | `/stammdaten/bauabschnitte` | `StagesClient` |
| 3 | Ansprechpartner | `/stammdaten/ansprechpartner` | `ContactsClient` |
| 4 | Kunden | `/stammdaten/kunden` | `CustomersClient` |
| 5 | Monteure | `/stammdaten/monteure` | `TechniciansClient` |
| 6 | Teams | `/stammdaten/teams` | `TeamsClient` |
| 7 | Kabelarten | `/stammdaten/kabelarten` | `CableTypesClient` |
| 8 | Gewerke | `/stammdaten/gewerke` | `TradesClient` |
| 9 | Funktionen | `/stammdaten/funktionen` | `ContactFunctionsClient` |
| 10 | Objektarten | `/stammdaten/objektarten` | `ObjectTypesClient` |
| 11 | Qualifikationen | `/stammdaten/qualifikationen` | `QualificationsClient` |
| 12 | Bereitschaftsnummern | `/stammdaten/bereitschaftsnummern` | `OnCallNumbersClient` |
| 13 | Einstellungen | `/stammdaten/einstellungen` | `SettingsClient` |

Plätze 1–3 sind Dennis' ausdrückliche Vorgabe. Plätze 4–13 („Rest") übernehmen **die
bestehende Reihenfolge aus `lib/roles.ts`** — das ist bewusst keine neue Gestaltung, sondern
die Beibehaltung des Bestands. Die Untertitel der Abschnitte sind **zeichengleich** aus dem
`subtitle` des jeweiligen `PageHeader` der Einzelseite zu übernehmen; keine neuen Texte
erfinden.

## Positivliste (nur diese Pfade)

- **neu** `app/src/components/ui/shadcn/accordion.tsx`
- **neu** `app/src/app/(app)/stammdaten/page.tsx`
- **neu** `app/test/auftrag16-stammdaten-akkordeon.test.mjs`
- **ändern** `app/src/lib/roles.ts` — ausschließlich, um den Eintrag
  `{ href: "/stammdaten", label: "Stammdaten (Übersicht)", roles: ["admin","disponent"] }`
  als **erstes** Element der bestehenden Stammdaten-Gruppe zu ergänzen. Die 13 bestehenden
  Einträge bleiben zeichengleich erhalten.

## Umzusetzen

**1. `accordion.tsx`** als Copy-in im Stil der neun vorhandenen shadcn-Komponenten:
Import aus dem bereits vorhandenen `radix-ui`-Meta-Paket, `type="multiple"` (mehrere
Abschnitte gleichzeitig offen), Styling **ausschließlich** über die bestehenden AP8-Tokens
wie in `collapsible.tsx`/`button.tsx` — keine neuen Farbwerte, keine Hex-Literale, Dark Mode
muss funktionieren. Sichtbarer Fokusring wie bei den Bestandskomponenten.

**2. `app/src/app/(app)/stammdaten/page.tsx`** als Server-Komponente:
- `export const dynamic = "force-dynamic";` wie bei den Einzelseiten.
- `requireSession()`, danach dasselbe Rollengate wie die Einzelseiten
  (`session.role !== "admin" && session.role !== "disponent"` → `<NoAccess />`). Das Gate
  steht **vor** jeder Datenladung.
- **Eine** `Promise.all`-Ladung aller benötigten Listen und Optionslisten. Als Quelle gilt
  die Vereinigung der `Promise.all`-Blöcke der 13 Einzelseiten; jede dieser Seiten ist dafür
  zu lesen. Mehrfach benötigte Optionslisten (z. B. `getActiveStageOptions()`) werden
  **einmal** geladen und mehrfach übergeben.
- `PageHeader title="Stammdaten"` mit einem sachlichen Untertitel, darunter das Akkordeon mit
  den 13 Abschnitten in der Tabellenreihenfolge, jeder mit derselben Client-Komponente und
  denselben Props wie auf der Einzelseite.
- Alle Abschnitte sind beim Aufruf **zugeklappt**.
- Neben jedem Abschnittstitel ein Link auf die zugehörige Einzelroute („Einzelseite öffnen"
  o. ä.), damit die Direktrouten auffindbar bleiben.

**3. Statischer Wächtertest** `app/test/auftrag16-stammdaten-akkordeon.test.mjs` im Stil der
bestehenden `auftrag*`-Tests (lies `app/test/auftrag10-bereitschaftsplan.test.mjs` als
Vorlage). Er liest die neue `page.tsx` als Text und belegt mindestens:
- alle **13** Client-Komponenten sind importiert und verwendet (13 Treffer, keiner fehlt);
- die **Reihenfolge** der 13 Abschnitte entspricht der Tabelle oben (Positionsvergleich, so
  dass ein späteres stilles Umsortieren rot wird);
- das Rollengate `admin`/`disponent` ist vorhanden und steht **vor** der Datenladung;
- `roles.ts` führt den neuen Übersichtseintrag als erstes Element der Stammdaten-Gruppe und
  weiterhin alle 13 Einzelrouten.

## Negativliste (ausdrücklich verboten)

- Jede Änderung an den **13 bestehenden** `stammdaten/*/page.tsx`.
- Jede Änderung an den **13 Client-Komponenten** in `app/src/components/masterdata/`
  (einschließlich `shared.tsx`) und an `app/src/lib/masterdata.ts` /
  `masterdata-actions.ts`. Sollte ein Abschnitt ohne Änderung dort nicht darstellbar sein:
  **stoppen und melden**, nicht umbauen.
- `app/src/app/globals.css` und die AP8-Tokens anfassen, neue Farbwerte oder Hex-Literale
  einführen.
- Eine neue npm-Abhängigkeit installieren oder `package.json` / `package-lock.json` ändern.
- Migrationen, SQL, `app/supabase/**`, `.github/workflows/**`, `.claude/**`, `run-*.ps1`.
- Andere Einträge in `lib/roles.ts` umsortieren, umbenennen oder entfernen.
- Den CSV-Import, Vorlagendateien, den Kontakte-Wizard oder das Entfernen der
  Bereitschaftsnummer aus der Erfassung anfangen — alles eigene Scheiben.
- `git commit`, `push`, `merge`, `tag`, `release`.
- Erfundene Nachweise. `npm run build` und ESLint sind in dieser Umgebung nicht ausführbar
  (OneDrive-/FUSE-Mount) — **nicht versuchen**, nicht behaupten.

## Zeilenenden — zwingend

Alle drei neuen Dateien werden mit **LF** geschrieben, die Änderung an `roles.ts` erhält die
dort vorhandenen Zeilenenden. Hintergrund: `00-Projektsteuerung/BEFUND_CRLF_ARBEITSBAUM.md`
— im Arbeitsbaum liegt bereits eine offene CRLF-Umstellung, die vor dem nächsten Commit
bereinigt werden muss. Kein zusätzlicher CRLF-Eintrag.

## DoD (prüfbar)

1. `git status --porcelain` weist genau **vier** neue bzw. geänderte Dateien der Positivliste
   aus (3 neu, 1 geändert) und **keine** weitere.
2. Aus `app/`: `npx tsc --noEmit` → **Exit 0**, Ausgabe wörtlich melden.
3. Aus `app/`: `node --test test/*.test.mjs` → alle bisherigen **177** weiterhin grün plus
   die neuen Fälle, `fail 0`, **Exit 0**. Zahlen wörtlich melden.
4. `grep -c $'\r'` auf den drei neuen Dateien → jeweils **0**.
5. Nachweis, dass die 13 Client-Komponenten und die 13 Einzelseiten **nicht** im Diff
   erscheinen (`git status --porcelain` genügt).
6. `MELDUNG_16.md` nennt: die vier Dateien, die vollständige Liste der geladenen
   Datenquellen mit der Angabe, welche mehrfach verwendet werden, die Messwerte aus 2–4 mit
   Exit-Codes und die offenen Risiken.

## Stopppunkt

Anhalten und melden, wenn

- ein Abschnitt ohne Änderung an einer Client-Komponente oder an `masterdata.ts` nicht
  darstellbar ist (z. B. weil eine Komponente eine Route oder einen Router-Zustand
  voraussetzt);
- zwei Client-Komponenten kollidieren, wenn sie gleichzeitig auf einer Seite stehen (z. B.
  doppelte DOM-Kennungen, gleichnamige Formularfelder, ein gemeinsamer Modal-Container);
- die gemeinsame Datenladung eine erkennbar unbegrenzte Liste zieht (Verdacht: Ansprechpartner
  und Monteure) — dann Zeilenzahl bzw. fehlende Obergrenze melden, **nicht** eigenmächtig
  paginieren;
- `tsc` nicht Exit 0 ergibt oder ein Bestandstest rot wird;
- derselbe Fehler dreimal in derselben Teilaufgabe auftritt.

## Meldeweg

`00-Projektsteuerung/MELDUNG_16.md`. Danach messt der Orchestrator/Review-Chat selbst nach
und schreibt `REVIEW_16.md`.
