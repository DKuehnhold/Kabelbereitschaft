# Abschlusskorrektur: aktive Anweisungs- und Architekturkonsistenz

## Zweck

Das finale Review hat eine aktive Anweisungsabweichung und veraltete
Architektureinstiege gefunden. Behebe ausschließlich diese Punkte, ohne
Historie umzuschreiben. Kein App-Code, keine Migration, keine GUI, kein
ManagementOS. Kein Commit, Push, Merge, Tag oder Release.

## Positivliste

- `.claude/automation/tasks/ap14b-data-incidents-tasks-sync.md`
- `00-Projektsteuerung/ADR-011-postgres-eigenplattform.md`
- `00-Projektsteuerung/ARCHITEKTEN_UEBERSICHT.md`
- `00-Projektsteuerung/ROADMAP_AP12_AP15_ENTWURF.md`
- `PROJEKT_WISSEN.md`
- `PROJEKTSTATUS.md`

## 1. AP14B-Agentenvertrag korrigieren

Im aktiven AP14B-Auftrag darf `kb-tests-evidence` keine versionierte Testdatei
ändern. Ersetze die abweichende Aussage durch:

- Tests/Evidence arbeitet an versionierten Projektdateien strikt read-only.
- Nötige Teständerungen werden als Befund an Claude gemeldet.
- Claude delegiert sie anschließend als getrennten sequenziellen Schreibauftrag
  an `kb-implementierung`.
- Keine Shell-Umleitung als Ersatz für fehlende Edit-/Write-Werkzeuge.

Der fachliche AP14B-Scope bleibt unverändert.

## 2. ADR-011-Status eindeutig machen

Dennis hat die Zielplattform verbindlich entschieden:
PostgreSQL 18 + Auth.js v5 + MinIO + Container hinter internem Reverse-Proxy;
Supabase Cloud und selbst gehostetes Supabase sind ausgeschlossen.

Ändere den Kopfstatus von ADR-011 von „Entwurf“ auf **„angenommen /
verbindlich“** mit Datum 2026-07-30. Technische Umsetzung ist noch nicht
vollständig; das ist als Umsetzungsstand zu benennen, nicht als Grund, die
Architekturentscheidung weiter „Entwurf“ zu nennen.

## 3. Veraltete Einstiegstexte kennzeichnen

Füge in `ARCHITEKTEN_UEBERSICHT.md` direkt am Kopf einen kurzen, auffälligen
Aktualitätshinweis ein:

- Stand 2026-07-25 ist historisch.
- Für Zielplattform und aktuellen Arbeitsstand gelten ADR-011,
  `PROJEKT_WISSEN.md` und `PROJEKTSTATUS.md`.
- Supabase-Aussagen beschreiben den AP1–AP13-Altbestand und sind keine
  Zielarchitektur.

Ziehe den Kopf der Roadmap minimal auf 2026-07-30 nach:

- AP14B ist die laufende schrittweise Ablösung des Supabase-Altbestands.
- Die früher geplante Supabase-Stage/-Abnahme ist durch ADR-011 aufgehoben.
- Historische Abschnitte bleiben als Historie erhalten und sind nicht erneut
  auszuführen.

## 4. Aktive Restformulierungen in Führungsdokumenten

Korrigiere nur gegenwärtige Plan-/Offen-/Definitionstexte in
`PROJEKT_WISSEN.md` und `PROJEKTSTATUS.md`, die noch Test-Supabase oder eine
reale Supabase-Abnahme als zukünftige Voraussetzung nennen.

Verbindlicher Ersatz:

- öffentliche Browsertests lokal/CI ohne externes Backend,
- authentifizierte `@app`-E2E später gegen die PostgreSQL/Auth.js-Testumgebung
  mit synthetischen Daten,
- keine Supabase-Stage und kein Supabase-Zugang beschaffen.

Historische AP1–AP13-Nachweise und Änderungsverläufe nicht umschreiben.

## Arbeitsweise

Claude orchestriert:

1. read-only Konsistenzanalyse,
2. genau einen sequenziellen Dokumentations-Schreibauftrag,
3. unabhängige read-only Endprüfung.

Jeder Agentenauftrag enthält Positivliste, Negativliste, DoD und Stopppunkt.

## Nachweise und DoD

- null aktive Treffer, die Supabase als Zielplattform, nächste Abnahme oder
  benötigte Testumgebung ausgeben;
- historische Supabase-Erwähnungen bleiben erkennbar historisch;
- ADR-011 eindeutig angenommen/verbindlich;
- AP14B-Testagent strikt read-only;
- `git diff --check` Exit 0;
- vollständiger Git-Status;
- keine Änderung außerhalb der Positivliste dieses Laufs.

Bei nötiger Scope-Erweiterung, widersprüchlichem Git-Zustand oder dreimal
demselben Fehler stoppen und mit Rohbefund an Codex übergeben.
