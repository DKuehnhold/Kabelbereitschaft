# AP15-3 CI-Korrektur: nanoid-Produktionsaudit

## Ausgangsbefund

Der gepushte AP15-3-Commit `0f3d0bdba30934ac503dde766789e602b0225529` hat Container-Image `31273906147` erfolgreich abgeschlossen. Im CI-Lauf `31273906163` sind `database`, `container` und `objectstore` grün; nur `verify` ist im Schritt `npm audit --audit-level=high --omit=dev` rot. Der echte Joblog nennt `nanoid <3.3.17`, Severity high, GHSA-2v37-7h3g-55p8, Pfad `node_modules/postcss/node_modules/nanoid`. Lokal belegt: `next@16.2.12 -> postcss@8.5.24 (override) -> nanoid@3.3.16`; die PostCSS-Metadaten erlauben `nanoid ^3.3.16`, und `nanoid@3.3.17` ist verfügbar.

## Ziel

Behebe ausschließlich diesen belegten Produktionsauditfehler durch die kleinste reproduzierbare Lockfile-Aktualisierung innerhalb der bereits erlaubten Abhängigkeitsrange. Keine neue direkte Abhängigkeit und keine Produktänderung.

## Rollenmodell

Claude ist alleiniger ausführender Orchestrator. Höchstens ein Schreiber. Jeder Agentenauftrag enthält Positivliste, Negativliste, Definition of Done, Stopppunkt und Evidence. Kein Agent darf Git-Schreiboperationen, Releases, Agentenorchestrierung oder Scope-Erweiterung ausführen.

## Positivliste

- `app/package-lock.json`
- `PROJEKT_WISSEN.md` und `PROJEKTSTATUS.md` nur für eine knappe, wahrheitsgemäße Ergänzung des roten AP15-3-CI-Befunds und der lokalen Korrekturevidence; noch keinen grünen Folgelauf behaupten.
- `.claude/automation/status/fortschritt.json` nur operativ und gitignoriert.
- Diese Auftragsdatei darf als unversionierter AP15-3-Nachweis im Arbeitsbaum verbleiben.

## Negativliste

- `app/package.json` darf nicht geändert werden. Keine neue direkte Abhängigkeit und kein Override.
- Keine Änderung an Produktcode, Workflow, Tests, Konfiguration, SQL, Migrationen, Runnern, Deploy-Dateien oder übrigen Dokumenten.
- Die drei fremden unversionierten Dateien unter `00-Projektsteuerung/` und `07-Betrieb/` sind strikt tabu.
- Keine Git-Schreiboperation, kein Commit, Push, Merge, Tag oder Release; keine Löschung, Verschiebung, Umbenennung oder Archivierung.

## Arbeitsauftrag

1. Erzeuge ausgehend vom bestehenden `app/package.json` die kleinste Lockfile-only-Aktualisierung, sodass die transitive PostCSS-Abhängigkeit mindestens `nanoid@3.3.17` auflöst. Verwende eine reproduzierbare npm-Operation mit deaktivierten Lifecycle-Skripten; `package.json` muss bytegleich bleiben.
2. Prüfe den vollständigen `package-lock.json`-Diff. Akzeptabel ist nur die für nanoid erforderliche transitive Auflösung und unmittelbar technisch notwendige Lock-Metadaten. Wenn npm weitere Pakete aktualisieren will, stoppen und Rohbefund melden statt den Scope zu erweitern.
3. Ergänze die Leitdokumente knapp: AP15-3-Commit `0f3d0bd` wurde gepusht; Container-Image `31273906147` sowie CI-Jobs `database`, `container`, `objectstore` sind grün; CI `31273906163` ist wegen des belegten nanoid-Produktionsaudits rot. Dokumentiere die lokale Korrekturevidence, aber behaupte keinen grünen Folgelauf.

## Definition of Done

- `app/package.json` ist bytegleich zu `HEAD`.
- `npm ci --ignore-scripts` reproduziert die Lockdatei.
- `npm ls nanoid postcss --omit=dev --all` zeigt die korrigierte transitive Auflösung ohne neue direkte nanoid-Abhängigkeit.
- `npm audit --audit-level=high --omit=dev` Exit 0; keine high/critical Produktionslücke.
- Unit 97/97, TypeScript, ESLint und Produktions-Build Exit 0.
- `git diff --check` Exit 0; nur Positivliste durch diesen Lauf geändert; keine temporären Artefakte.

## Evidence

- Exakte Befehle, Exit-Codes, aufgelöste Paketversionen und Audit-Zusammenfassung.
- Mechanischer Hashvergleich `app/package.json` gegen `HEAD`.
- Vollständiger Lockfile-Diff und Falsifikation auf unerwartete Paketupdates.
- `git status --short` und Nachweis der Artefaktbereinigung.

## Stopppunkt

Sofort stoppen bei erforderlicher `package.json`-Änderung, zusätzlichen Paketupdates, Scope-Konflikt, zweitem Schreiber, notwendiger Änderung außerhalb der Positivliste oder dreimal demselben Fehler; Rohbefund an Codex.
