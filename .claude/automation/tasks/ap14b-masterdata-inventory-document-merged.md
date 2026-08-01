# AP14B Stammdaten/Inventar – verifizierten Merge dokumentieren

## Ziel

Dokumentiere ausschließlich den tatsächlich verifizierten Abschluss der
AP14B-Datenmigration für Stammdaten und Inventar. Dies ist ein reiner
Dokumentationsauftrag nach abgeschlossenem Code-/SQL-Gate und grüner CI.

Lies vollständig `AGENTS.md`, `CLAUDE.md`, `PROJEKT_WISSEN.md`,
`PROJEKTSTATUS.md`, `00-Projektsteuerung/ROADMAP_AP12_AP15_ENTWURF.md`, den
Git-Stand, die Aufgaben `ap14b-data-masterdata-inventory.md` und
`ap14b-masterdata-inventory-review-fixes.md` sowie diese Datei.

## Bestätigte Tatsachen

- `main` = `origin/main` =
  `79d88449f9e481b1148f902e175f46f9d07ef35d`
  (`feat: migrate masterdata and inventory to PostgreSQL`).
- Fast-Forward von `cb8bb888280b5509ae2c273789183767e3b7b4db`,
  kein Force-Push und kein Merge-Commit.
- Feature-Branch `feat/ap14b-data-masterdata-inventory` steht ebenfalls auf
  `79d8844`.
- Vier Zieldateien `masterdata.ts`, `masterdata-actions.ts`, `inventory.ts`,
  `inventory-actions.ts` enthalten keine Supabase-Importe und keine
  `supabase.`-Zugriffe.
- Migration `0015_ap14b_masterdata_inventory_grants.sql`, Smoke 21 und die
  Stammdaten-/Inventar-Integrationstests sind enthalten.
- Die drei Codex-Reviewbefunde sind korrigiert: explizite Allowlist nur
  `admin`/`disponent` für allgemeine Lagerbewegungen; fehlendes Material wird
  in allen vier Buchungswegen fail-closed vor dem Insert abgewiesen; die
  vorgangsbezogenen Bewegungen sperren die RLS-sichtbare Vorgangszeile vor
  Prüfung/Insert, wodurch parallele Rückgaben desselben Vorgangs serialisiert
  werden.
- Unabhängige Codex-Prüfungen am 2026-08-01: TypeScript Exit 0, ESLint Exit 0,
  41/41 Einheitentests, Next.js-Produktions-Build Exit 0 und
  `git diff --check` Exit 0.
- Vollständiger unabhängiger lokaler PostgreSQL-18-Lauf Exit 0:
  Migrationen 0001–0015; Smokes 15–21 einschließlich 19a; 30/30
  Plattform-Integrationstests; 31/31 Stammdaten-/Inventar-Integrationstests
  einschließlich Rollen-Allowlist, fehlendem Material, fremdem Vorgang und
  echter Parallelrückgabe. Abschlusszeile vorhanden. Temporäres Cluster,
  Datenbank, Rolle, Port und Arbeitsverzeichnis nachweislich entfernt; der
  vorhandene PostgreSQL-Dienst blieb unverändert.
- GitHub CI-Lauf `30677465341`: `completed/success`.
- GitHub Container-Image-Lauf `30677465340`: `completed/success`.
- Supabase ist noch nicht vollständig entfernt: Bilder/Uploads sowie die
  dafür benötigten Clientdateien und Pakete bleiben bis zum MinIO-Paket.
- AP14 insgesamt, V1, RC1, Tag und Release sind nicht abgeschlossen. Branding
  bleibt separat; GUI-/Designarbeit wartet auf Dennis.

## Positivliste

- `PROJEKT_WISSEN.md`
- `PROJEKTSTATUS.md`
- `00-Projektsteuerung/ROADMAP_AP12_AP15_ENTWURF.md`
- `.claude/automation/status/fortschritt.json`

## Negativliste

Keine andere Datei ändern. Insbesondere kein Fachcode, SQL, Test, Runner,
Workflow, Paket, Bildpfad, MinIO-Code, Branding oder ManagementOS. Kein Commit,
Push, Merge, Branchwechsel, Tag oder Release.

## Anforderungen

1. Entferne bzw. ersetze in den drei Dokumenten alle Aussagen, Stammdaten und
   Inventar seien uncommittet, ungepusht, nur auf dem Feature-Branch oder noch
   über Supabase angebunden.
2. Halte den verbleibenden Supabase-Scope exakt auf Bilder/Uploads und die
   dafür noch benötigten Clientdateien/Pakete begrenzt.
3. Korrigiere die Rechtematrixbeschreibung wahrheitsgemäß; die
   Zuordnungstabellen besitzen objektgenau auch notwendige Leserechte.
4. Dokumentiere die drei Korrekturen und die oben genannten unabhängigen
   Nachweise knapp, ohne Rohprotokolle zu duplizieren.
5. Roadmap: Version um genau eine Stufe erhöhen, Datum 2026-08-01, genau einen
   Historieneintrag. AP14 nicht als insgesamt abgeschlossen markieren.
6. Dashboard: Staffelstab am Ende `Codex`; AP14/B Stammdaten+Inventar `fertig`;
   nächstes Todo MinIO-Bilder/Uploads. Gesamtprozent nur konservativ und als
   Schätzung, nicht als Messwert.

## Definition of Done

- Genau die drei versionierten Dokumente sind geändert; Dashboard bleibt
  gitignored.
- Keine widersprüchliche Commit-/CI-/Supabase-Aussage.
- `git diff --check` Exit 0.
- Vollständige Übergabe mit geänderten Dateien, Prüfung und Git-Status.
- Ausdrücklich kein Commit und kein Push.
