# Dashboard-Fortschritt verbindlich und lesbar machen

## Entscheidung von Dennis

Die Datei
`.claude/automation/status/fortschritt.json` ist die Datenquelle seines
Fortschritts-Dashboards. Claude und Codex müssen sie zuverlässig lesen und bei
jeder Status- bzw. Staffelstabänderung pflegen.

Claude soll als Orchestrator zuerst feststellen, welche Felder das vorhandene
Dashboard tatsächlich erwartet. Keine Felder, Prozentwerte oder Nachweise
erfinden.

## Ausgangszustand

- Kein anderer Claude-Orchestratorlauf ist aktiv.
- AP14B liegt als nicht committeter Zwischenstand auf
  `feat/ap14b-data-incidents-tasks-sync`.
- Der letzte Claude-Lauf endete ohne vollständige Abschlussübergabe, während
  sein Datenbanktest noch lief.
- Codex hat den danach verwaisten temporären PostgreSQL-18-Testcluster
  `kb_ap14b_cluster_20260731_103437` kontrolliert gestoppt und entfernt:
  Server angehalten, Clusterverzeichnis entfernt, 0 zugehörige Prozesse.
- Das ist **kein** bestandener Datenbanknachweis. AP14B bleibt in
  Prüfung/Korrektur.
- `fortschritt.json` existiert und ist gültiges JSON, ist aber derzeit
  unversioniert und nicht von Git ignoriert.

## Positivliste

Änderungen ausschließlich an:

- `.claude/automation/status/fortschritt.json`
- `.gitignore`
- `AGENTS.md`
- `CLAUDE.md`
- `.claude/agents/kb-dokumentation.md`
- `.claude/automation/run-orchestrator.ps1`

Keine App-, SQL-, Test-, GUI-, Architektur- oder ManagementOS-Datei ändern.
Kein Commit, Push, Merge, Tag oder Release.

## Auftrag

### 1. Dashboard-Schema ermitteln

Suche read-only im bestehenden Vault nach der Statusanzeige, ihrem Leser oder
einer dokumentierten Felddefinition. Prüfe außerdem die bestehende
`fortschritt.json`.

Wenn der eigentliche Dashboard-Leser nicht im zugänglichen Vault liegt:

- klar melden, dass seine Implementierung nicht geprüft werden konnte;
- das vorhandene, bereits verwendete JSON-Schema kompatibel beibehalten;
- keine spekulativen Pflichtfelder hinzufügen oder vorhandene umbenennen.

Dokumentiere in der Übergabe:

- erwartete Felder und erlaubte Zustände,
- welche Felder Claude pflegt,
- welche Felder Codex pflegt,
- wann aktualisiert wird.

### 2. Aktuellen Status wahrheitsgemäß setzen

Pflege `fortschritt.json` mit absolutem Zeitstempel Europe/Berlin.

Der Inhalt muss mindestens ausdrücken:

- Staffelstab liegt bei **Codex**, solange die unvollständige AP14B-Übergabe
  bewertet und der Korrekturauftrag vorbereitet wird.
- AP14B-Daten ist **nicht fertig** und hat keinen bestätigten
  PostgreSQL-Gesamtnachweis.
- Vorhandener Implementierungszwischenstand bleibt erhalten.
- Der verwaiste Testcluster wurde vollständig bereinigt.
- Nächster Schritt: begrenzter Claude-Korrekturlauf für Testabschluss,
  Gesamtdiff und belastbare Übergabe.
- V1 und GUI-Abnahme bleiben menschliche Blocker; keine Veränderung daran.

Prozentwerte nur beibehalten oder verändern, wenn die Änderung aus bestätigten
Arbeitspaketen begründet werden kann. Keine Scheingenauigkeit.

### 3. Verbindlicher Pflegevertrag

Ergänze knapp und widerspruchsfrei:

- `AGENTS.md`: `fortschritt.json` ist operative Dashboard-Datenquelle, aber
  nicht fachliche Projektwahrheit; führend bleiben `PROJEKT_WISSEN.md` und
  `PROJEKTSTATUS.md`.
- `CLAUDE.md`: Claude liest sie bei Laufstart und aktualisiert sie bei
  Teilfortschritt, Blocker und Übergabe.
- `kb-dokumentation`: darf diese Datei nur auf ausdrücklichen Auftrag des
  Claude-Orchestrators pflegen; bestätigte Fakten, keine erfundenen Prozentwerte.
- `run-orchestrator.ps1`: Der Orchestrator-Prompt verpflichtet Claude, die
  Statusdatei bei Start zu lesen und vor seiner Abschlussübergabe zu
  aktualisieren. Keine parallele Schreiblogik und keine zweite Statusdatei.

Zuständigkeit:

- Aktiver Claude-Lauf: `staffelstab = "Claude"`, Claude hält Todo/Hinweise
  aktuell.
- Nach Claude-Übergabe und während Codex-Review/CI/Merge:
  `staffelstab = "Codex"`, Codex hält Reviewzustand aktuell.
- Nach bestandenem Merge vor neuem Claude-Auftrag aktualisiert Codex den
  abgeschlossenen Stand; der neue Claude-Lauf übernimmt danach wieder.

### 4. Git-Hygiene

Die operative Datei muss im Vault und über OneDrive erhalten bleiben, darf aber
nicht in Fach-Commits erscheinen. Ignoriere deshalb ausschließlich
`.claude/automation/status/fortschritt.json` (oder das Statusverzeichnis, wenn
darin ausschließlich flüchtige Dashboard-Daten liegen). Agentenprofile,
Runner und Aufgaben bleiben versionierbar.

## Orchestrierung und Nachweise

Claude delegiert:

1. read-only Schemasuche,
2. genau einen sequenziellen Dokumentations-/Runner-Schreibauftrag,
3. unabhängige read-only Endprüfung.

Jeder Agentenauftrag enthält Positivliste, Negativliste, DoD und Stopppunkt.

Nachweise:

- JSON parsebar;
- bestehende Dashboard-Feldnamen kompatibel erhalten;
- Zeitstempel mit Offset `+02:00`;
- aktueller AP14B-Status ohne erfundenen Testerfolg;
- `git check-ignore` bestätigt die operative Datei;
- PowerShell-Parser für `run-orchestrator.ps1` ohne Fehler;
- `git diff --check` Exit 0;
- keine Änderung außerhalb der Positivliste;
- vollständiger Git-Status.

## Stopppunkt

Wenn das Dashboard zwingend ein anderes, nicht auffindbares Schema erwartet,
melde den exakt fehlenden Zugriff. Keine Ersatzdatei und kein erfundenes Schema.
Bei Scope-Abweichung oder dreimal demselben Fehler anhalten.
