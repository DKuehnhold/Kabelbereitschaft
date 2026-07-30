# Reviewkorrekturen: Claude-Agentenorchestrator

## Ausgangslage

Codex hat den vollständigen Konfigurations-Diff und die Übergabe des Laufs
`kb-configure-claude-agent-orchestrator` unabhängig geprüft.

Ausdrücklich akzeptiert:

- Claude ist der alleinige Orchestrator seiner Ausführungs-Agents.
- Codex bleibt Architekt und unabhängiger Qualitätsprüfer.
- Die Aktualisierung des einen Arbeitsmodell-Absatzes in `PROJEKT_WISSEN.md`
  ist erforderlich und freigegeben.
- `.claude/settings.json` ist als zusätzliche technische Schutzschicht
  grundsätzlich freigegeben.
- Die vier Agentenprofile, der primäre Runner und der veraltete Weiterleiter
  bleiben im bisherigen Scope.

Kein App-Fachcode, keine Migration, keine GUI und keine ManagementOS-Datei
ändern. Nicht committen, pushen, mergen oder taggen.

## Positivliste

Du darfst ausschließlich diese Dateien ändern:

- `.claude/settings.json`
- `.claude/automation/run-orchestrator.ps1`
- `AGENTS.md`
- `CLAUDE.md`
- `.claude/automation/tasks/ap14b-data-incidents-tasks-sync.md`

Falls nach Prüfung für einen Punkt keine Änderung nötig ist, lasse die Datei
unverändert und begründe das in der Übergabe.

## Korrektur 1: Git-Sperren vollständig machen

In `.claude/settings.json` sind bei mehreren mutierenden Befehlen nur
Argumentvarianten (`:*`) gesperrt. Ergänze jeweils auch die exakte,
argumentlose Form mindestens für:

- `git reset`
- `git clean`
- `git stash`
- `git am`
- `git cherry-pick`
- `git revert`
- `git filter-branch`
- `git update-ref`
- `gh pr`
- `gh release`
- `gh api`

Bestehende Sperren nicht lockern. Lesende Git-Kommandos wie `git status`,
`git diff`, `git log` und `git rev-parse` müssen weiter möglich bleiben.

Prüfe die JSON-Syntax. Weise die Wirksamkeit mindestens für die exakte Form
`git reset` in einem synthetischen, kontrollierten Claude-Dry-Run nach. Vor dem
Test muss der Index leer sein; falls die Berechtigungsregel wider Erwarten
nicht greift, darf dadurch keine Arbeitsdatei verloren gehen. Bei jeder
unerwarteten Git-Änderung sofort stoppen.

## Korrektur 2: AP14B-Auftrag nach Merge startfähig halten

In `.claude/automation/tasks/ap14b-data-incidents-tasks-sync.md` darf die
Startprüfung nicht auf den alten Hash
`22db6dad8958146be4de667a55e89ba170e73b7c` fest verdrahtet bleiben, weil der
Konfigurations-Commit `main` verändern wird.

Ersetze die Hash-Festlegung durch eine robuste, nicht zirkuläre Vorbedingung:

- Start nur, wenn `main = origin/main` ist,
- der aktuelle Arbeitsbaum sauber ist,
- keine Git-Sperre und kein anderer schreibender Orchestratorlauf aktiv ist.

Der Fachauftrag bleibt ansonsten unverändert. Der Branch
`feat/ap14b-data-incidents-tasks-sync` wird erst nach dem Merge und aus dem dann
aktuellen `main` angelegt. Keine konkrete zukünftige Commit-ID erfinden.

## Korrektur 3: Nachweisvertrag eindeutig machen

Der neue Runner schreibt laufbezogene Dateien mit dem Laufnamen und hinterlegt
die exakten Pfade in `state.json` als `resultFile` und `errorFile`. Das ist
robuster als die alten festen Dateien `result.json`/`stderr.log`.

Prüfe und dokumentiere in `AGENTS.md` und/oder `CLAUDE.md` knapp und eindeutig:

- Nach Abschluss wird zuerst `.claude/automation/runtime/state.json` gelesen.
- Maßgeblich sind die dort genannten Felder `resultFile` und `errorFile`.
- Alte feste Dateien `result.json`/`stderr.log` sind nur Altbestand und dürfen
  nicht versehentlich als Ergebnis eines neuen Laufs ausgewertet werden.

Ändere den Runner nur, wenn sein tatsächliches Verhalten diesem Vertrag noch
nicht entspricht. Keine doppelte Ergebnislogik einführen.

## Unabhängige Verifikation

Nutze Claude als Orchestrator:

1. mindestens einen read-only Agenten für die Konsistenzprüfung,
2. einen davon unabhängigen read-only Agenten für Runner, Sperren und
   Startvorbedingungen,
3. höchstens einen Schreiber gleichzeitig.

Führe anschließend selbst aus:

- PowerShell-Parserprüfung beider Runner,
- JSON-Validierung von `.claude/settings.json`,
- freie `-CheckOnly`-Prüfung (Exit 0),
- blockierte gleichzeitige Sperre (Exit 2),
- synthetischer Berechtigungsnachweis für die exakte Form `git reset`,
- Suche, dass im offenen AP14B-Auftrag kein fester Hash `22db6dad...` mehr als
  Startbedingung steht,
- `git diff --check`,
- vollständiger Git-Status.

## Definition of Done

- Beide Reviewfehler sind behoben.
- Der Nachweisvertrag ist eindeutig.
- Keine Datei außerhalb der Positivliste wurde durch diesen Korrekturlauf
  geändert.
- Keine App-, SQL-, GUI- oder ManagementOS-Datei wurde geändert.
- Kein Commit, Push, Merge oder Tag.

## Stopppunkt

Bei abweichendem Git-Zustand, fehlender technischer Durchsetzbarkeit, einem
unerwarteten Schreibzugriff im Dry-Run oder dreimal demselben Fehler stoppen
und mit Rohbefund an Codex übergeben. Keine Scope-Erweiterung.
