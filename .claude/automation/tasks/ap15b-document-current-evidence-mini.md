# AP15B – Projektwissen knapp auf aktuellen Nachweisstand bringen

## Positivliste

- `PROJEKT_WISSEN.md`

## Auftrag

Aktualisiere ausschließlich den knappen AP15B-Abschnitt in `PROJEKT_WISSEN.md`.
Halte fest: Die nicht-visuellen AP15B-Codepfade (Fehlalarm-Markierung,
Fehlalarm-Filter, Datumslogik und Vollmengen-Export) sind im Arbeitsbaum
implementiert; Codex hat unabhängig `npm test` mit TypeScript, ESLint und 114
Unit-Tests mit Exit 0 geprüft. Der PostgreSQL-18-/Docker-Nachweis ist in der
aktuellen Codex-Umgebung noch offen, weil die Docker-CLI dort nicht verfügbar
ist. Behaupte keinen grünen DB-/CI-Lauf und keine RC1-Freigabe. Commit, Push,
Merge, Tag und Release sind verboten.

## Negativliste

- Keine Code-, Test-, CI- oder Migrationsänderungen.
- Keine Änderungen an historischen Evidenzabschnitten außer einer knappen,
  klar als aktuell gekennzeichneten Ergänzung.
- Keine erfundenen Nachweise, keine Freigabe und keine GUI-Entscheidung.

## Definition of Done / Stopppunkt

`PROJEKT_WISSEN.md` ist quellentreu, knapp und nennt den offenen Docker-/DB-
Nachweis. Bei Widerspruch oder unklarer Historie stoppen und melden.

## Evidence

Nenne die geänderte Datei sowie den exakten Dokumentationsinhalt in der
Übergabe. Kein Testlauf ist aus diesem Auftrag zu behaupten.
