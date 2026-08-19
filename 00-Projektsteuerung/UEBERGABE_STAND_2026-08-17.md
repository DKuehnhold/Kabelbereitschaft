# Übergabestand 2026-08-17 (Ende Chat 1, für den Nachfolgechat)

> Verfasst von Claude (Orchestrator/Review). Dieser Chat wurde sehr lang; Dennis wechselt in
> einen neuen. Alles Nötige steht im Vault — dieser Zettel ist die Kurzfassung.

## Einstieg für den neuen Chat (in dieser Reihenfolge lesen)

1. `PROJEKT_WISSEN.md` — maßgeblich. Besonders: „Entscheidungen Dennis vom 2026-08-16"
   (drei Nachtragsblöcke) und der Abschnitt zum Referenzstand `986f891`.
2. `01-Anforderungen/ANFORDERUNG_GUI_RUNDE_2.md` — Dennis' offene Wunschliste vom 17.08.
3. `01-Anforderungen/ANFORDERUNG_DISPO_METADATEN.md` — Excel-Auswertung (Bereitschaftsübersicht).
4. `AGENTS.md` / `CLAUDE.md` — Rollen und Grenzen.
5. `00-Projektsteuerung/AUFTRAG_*.md`, `MELDUNG_*.md`, `REVIEW_*.md` — die Arbeitskette
   (Stand: 1–14 abgeschlossen und grün reviewt).

## Arbeitsmodell (Stand 2026-08-17, geändert!)

- Der frühere zweite Cowork-Chat („Worker") ist **stillgelegt**. Chat 1 (Orchestrator/Review)
  formuliert Aufträge, startet **Sonnet-Ausführungsagenten** über das Agent-Werkzeug und
  prüft deren Ergebnisse selbst nach (eigene Messläufe, nicht nur Selbstberichte).
- `CHAT_STATUS.md` bleibt die Einzelschreiber-Absicherung.
- `.claude/automation/status/fortschritt.json` kann aus Cowork nicht geschrieben werden
  (Pfad gesperrt) — Stand dort ist ab MELDUNG_4 eingefroren, führend sind PROJEKT_WISSEN und
  PROJEKTSTATUS.
- Ein scheduled task „kb-review-zyklus" (alle 10 Min) existiert noch aus dem Zwei-Chat-Modell.
  Er sucht MELDUNG-Dateien ohne REVIEW. Falls er störend Aufträge anlegt: anpassen oder
  deaktivieren.

## Was heute gebaut wurde (AUFTRAG 5–14, alle grün reviewt, alles uncommitted außer 3c1343f)

- **5** Erfassung „Neue Meldung" nach Variante A (Desktop zweispaltig, mobil Daumenleiste,
  optionale Abschnitte eingeklappt, Priorität als Tippflächen).
- **6** Migration **0019**: Kataloge `trades`, `contact_functions`, `object_types` +
  `contacts.function_id`, drei Pflegeseiten.
- **7** Migration **0020**: `incidents.reported_at`, `caller_contact_id`, `trade_id`,
  `is_in_clarification`; RPC `create_incident_ap12` um drei optionale Parameter erweitert
  (DROP+CREATE, Rechte neu vergeben); Anruf-Block in der Erfassung.
- **8** Meldungsliste: Labels „Meldungen", Filter `klaerung=1|0`, Badge, Umschalter, Gewerk-Spalte.
- **9** npm-Skripte `dev`/`build`/`start` auf direkte node-Aufrufe (wegen `&` im OneDrive-Pfad).
- **10** Migration **0021**: `on_call_plan` + Wochenansicht `/bereitschaftsplan`.
- **11** Farbkonzept **Rot/Schwarz** über Tokens; Navigation neu: horizontale Topbar mit Icons +
  Burger-Menü rechts (alte Seitenleiste entfällt; `AppHeader.tsx`/`NavLinks.tsx` sind jetzt
  totes Markup — Aufräum-Merkposten).
- **12** Dennis' Logo (`WuS_DE_Logo_Gruppe_schw.svg`) eingebaut über zentrale `Logo.tsx`
  (hochkant 176×132, `dark:invert`), PWA-`theme_color` `#7f1d1d`.
- **13** Lesbarkeit behoben — Ursache war **fehlendes `color-scheme`** (Browser rendete bei
  System-Dark-Mode hell auf hell); neue Tokens `--field-bg/-fg/-placeholder`, Autofill
  behandelt; Anmelde-/Passwortseite und 16 weitere Blau-Reste auf Tokens umgestellt.
- **14** Migration **0022**: `qualifications`, `technician_qualifications`,
  `on_call_plan.assignment_kind` ('bereitschaft'|'dispo', zwei partielle Unique-Indizes,
  `construction_stage_id` nullable); Dispo-Board mit Wochen-/Monatsumschalter, rechter
  Monteurliste (Farbe = höchste Qualifikation), Dispo-Zeile, HTML5-DnD **plus** Klick-Ebene.

**Unit-Tests: 177/177 grün** (Baseline-Entwicklung heute: 115 → 177).

## Nachweislage

- **NEU am 2026-08-17 (wichtig):** Dennis hat 0019–0022 **lokal gegen echtes PostgreSQL 18
  eingespielt — alle vier ohne Fehler.** Damit ist die größte offene Auflage der Reviews 6, 7,
  10 und 14 erledigt. Die SQL-Smokes 26–29 und der CI-Job `database` sind damit noch **nicht**
  gelaufen — CI-Nachweis bleibt offen.
- `npm run build` und ESLint sind in den Cowork-Sandboxes nicht durchführbar (OneDrive-/FUSE-Mount:
  EPERM `.fuse_hidden`, ESLint >175 s). **Prüfung immer lokal durch Dennis.**
- Letzter gepushter Commit: `3c1343f`. **Alles aus AUFTRAG 11–14 ist noch uncommitted.**
  Dennis meldete CI-Fehlermeldungen zu einem Lauf; der Text lag bis Chatende nicht vor, GitHub
  war aus der Sitzung nicht abrufbar. **Erste Aufgabe im neuen Chat: CI-Fehler klären.**

## Offen aus ANFORDERUNG_GUI_RUNDE_2 (nächste Aufträge)

1. **Stammdaten:** Akkordeon-Darstellung; Reihenfolge Streckennummern → Bauabschnitte →
   Kontakte → Rest; **CSV-Import je Art mit Vorlagendateien** (`99-Anlagen/CSV-Vorlagen/`,
   Semikolon + UTF-8-BOM, Vorschau, fail-closed in einer Transaktion); Kontakte-Wizard
   („wenn nicht zu viel Arbeit").
2. **Bereitschaftsnummer** aus der Erfassung entfernen (bleibt Stammdatum).
3. **Formular-Durchgang mit Dennis** — er geht alle Formulare durch, Änderungen werden dann
   geschnitten. Merkposten dafür: Primärbutton im Dark Mode nur ~3,9:1 Kontrast;
   Qualifikations-Startwerte und -Farben pflegt Dennis.
4. Danach: Disponentenansicht, Doku-Nachzüge (ADR-011 Dateisystem-Bildspeicher, LISTENKONZEPT
   20000er-Export, ROLLEN_UND_RECHTE admin+disponent), Fehlalarm-Umbauten (Wächter 0018 auf
   admin+disponent; Statuswert `fehlalarm` durch Kennzeichen ablösen), Bildspeicher-Umbau
   MinIO→Dateisystem, AP14 Betrieb/Abnahme.

## Lokale Testumgebung von Dennis (nicht im Repo)

Datenbank `kb_dev` auf lokalem PostgreSQL 18; Server-Passwort `PgLokal2026`; App-Login
`kuehnhold@wus-technik.com` / `HlkTest2026lokal`; `app/.env.local` mit S3-Platzhaltern
(Bild-Uploads lokal daher ohne Funktion — Bildspeicher wird ohnehin umgebaut).
Start: `npm run dev` im Ordner `app` (nach Dateiänderungen vorher `.next` löschen).
