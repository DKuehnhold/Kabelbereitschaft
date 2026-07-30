# Claude als Orchestrator der Ausführungs-Agents konfigurieren

> **ABGESCHLOSSENER HISTORISCHER EINMALAUFTRAG (Stand 2026-07-30). Nicht erneut ausführen.**
> Der unter „Ausgangspunkt und Branch“ genannte Hash
> `22db6dad8958146be4de667a55e89ba170e73b7c` war der damalige verifizierte Ausgangspunkt und ist
> **keine** aktuelle Startvorbedingung.
> Der Branch `chore/claude-agent-orchestrator` besteht bereits; er ist nicht erneut anzulegen.
> Die folgende Auftragsbeschreibung bleibt unverändert als Dokumentation des damaligen
> Auftrags erhalten.

## Verbindliche Entscheidung von Dennis

Für die Kabelbereitschaft-App gilt ab sofort:

- **Dennis** ist Produktverantwortlicher und entscheidet nur GUI/Design, zwingend
  fehlende IT-Zugänge, V1 und endgültige Releasefreigabe.
- **ChatGPT/Codex** bleibt ausschließlich Architekt und unabhängiger
  Qualitätsprüfer. Codex orchestriert oder startet keine Ausführungs-Agents.
- **Claude** ist ausführender Orchestrator. Claude zerlegt freigegebene
  Architekturpakete, startet und steuert seine spezialisierten
  Ausführungs-Agents, sammelt deren Ergebnisse und liefert die Übergabe an
  Codex.
- **Claude-Agents** implementieren, testen und prüfen im von Claude
  festgelegten Teil-Scope.

Diese Projektentscheidung ersetzt für die Kabelbereitschaft-App die bisherige
Formulierung „Claude ist nur Programmierer“. Das MOS-Modell dient als
Strukturreferenz (zentraler Orchestrator, klare Verträge, Scope, Evidence,
Circuit Breaker), ist aber dort nur Entwurf und wird nicht kopiert. Keine
ManagementOS-Datei ändern.

## Ausgangspunkt und Branch

1. Lies `AGENTS.md`, `CLAUDE.md`, `PROJEKT_WISSEN.md`, `PROJEKTSTATUS.md` und
   den aktuellen Git-Stand.
2. Erwartet: `main = origin/main =
   22db6dad8958146be4de667a55e89ba170e73b7c`, keine Git-Sperre und außer den
   beiden neuen Taskdateien keine Änderung.
3. Lege `chore/claude-agent-orchestrator` vom aktuellen `main` an.
4. Bei abweichendem Zustand anhalten und berichten.

## Auftrag

### 1. Aktuelle Claude-Code-Fähigkeiten verifizieren

Prüfe read-only mit der lokal installierten Claude-Code-Version, welche
projektbezogenen Agentendefinitionen und welches Orchestrator-/Subagentenformat
aktuell unterstützt werden. Keine Annahme über veraltete Syntax. Dokumentiere
den Nachweis knapp in der Übergabe.

### 2. Rollen und Ablauf verbindlich aktualisieren

Aktualisiere:

- `AGENTS.md`
- `CLAUDE.md`

Verbindliche Regeln:

- Claude ist der einzige Orchestrator für Ausführungs-Agents.
- Codex liefert Architekturgrenzen und prüft den fertigen Gesamt-Diff, startet
  aber keine Ausführungs-Agents.
- Claude darf Teilaufgaben an spezialisierte Claude-Agents delegieren.
- Im gemeinsamen Vault schreibt immer höchstens **ein** Agent gleichzeitig.
  Read-only Analyse- und Prüfagents dürfen parallel arbeiten.
- Jeder Agent erhält Positivliste, Negativliste, DoD und Stopppunkt.
- Claude prüft Agentenergebnisse und den Gesamt-Diff, bevor er an Codex
  übergibt.
- Keine Selbstfreigabe, kein Commit, Push, Merge, Tag oder Release durch
  Claude/Agents.
- Bei dreimal gleichem Fehler Circuit Breaker: stoppen und an Codex melden.
- Keine direkte Agent-Kommunikation außerhalb Claude; Claude ist der einzige
  Mediator.
- Nur der bestehende Vault; keine Clones, Ersatzordner oder fremden Dienste.

### 3. Projektbezogene Claude-Agents anlegen

Lege unter dem von der installierten Claude-Code-Version tatsächlich
unterstützten Projektpfad mindestens diese spezialisierten Profile an:

1. **Implementierung** – schreibt ausschließlich im zugewiesenen Datei-Scope.
2. **Tests/Evidence** – führt Prüfungen aus und berichtet echte Rohwerte; ändert
   Tests nur nach ausdrücklicher Delegation.
3. **Sicherheit/RLS** – read-only Review von Auth, SQL, RLS, Secrets,
   Transaktionen und Fail-closed-Verhalten.
4. **Dokumentation/Konsistenz** – pflegt nur ausdrücklich zugewiesene
   Projektdokumente und prüft Widersprüche.

Profile müssen minimale Werkzeuge/Rechte haben. Kein Profil darf selbst
committen, pushen, mergen, andere Agents orchestrieren oder den Scope ändern.

### 4. Orchestrator-Runner herstellen

- Erstelle `.claude/automation/run-orchestrator.ps1` als primären,
  nicht-interaktiven Startpunkt.
- Er nutzt weiterhin genau einen Claude-Hauptprozess im bestehenden Vault,
  schreibt Status/Evidence nach `.claude/automation/runtime/` und erkennt
  verwaiste sowie aktive Läufe korrekt.
- Der Prompt verpflichtet Claude ausdrücklich zur Agentenorchestrierung und
  zur Einzelschreiberregel.
- `run-programmer.ps1` bleibt aus Kompatibilitätsgründen als dünner,
  klar als veraltet markierter Weiterleiter erhalten oder wird entsprechend
  sicher angepasst; keine doppelte Orchestratorlogik.
- Keine dauerhaften Logs oder Zustände in Git aufnehmen.

### 5. Offenen Fachauftrag anpassen

Ergänze
`.claude/automation/tasks/ap14b-data-incidents-tasks-sync.md` so, dass Claude
den Auftrag als Orchestrator mit spezialisierten Agents bearbeitet. Inhaltlicher
Scope und Architekturregeln bleiben unverändert. Ein einzelner Schreibagent je
Teilpaket; Sicherheit und Evidence unabhängig read-only prüfen.

### 6. Verifikation

Führe mindestens aus:

- Syntaxprüfung aller PowerShell-Runner ohne Projektwirkung.
- Test eines synthetischen Dry-Run-Auftrags, der nachweist:
  - Claude-Hauptprozess ist Orchestrator,
  - Agentenprofile werden erkannt,
  - aktive Doppelläufe werden blockiert,
  - verwaister Status blockiert nicht,
  - Runtime-Artefakte bleiben ignoriert.
- Suche nach widersprüchlichen Rollenformulierungen in den führenden
  Projektdateien.
- `git diff --check`.

Keine App-Fachdatei, Migration oder GUI ändern. Keine ManagementOS-Datei ändern.

## Arbeitsweise und Übergabe

Nutze für diesen Auftrag selbst bereits das neue Prinzip: delegiere mindestens
eine read-only Analyse und eine unabhängige read-only Validierung an
spezialisierte Claude-Agents; nur ein Agent bzw. Claude selbst darf schreiben.

Nicht committen, pushen oder mergen. Übergabe mit:

1. geänderten Dateien,
2. verifiziertem Agentenformat und Claude-Code-Version,
3. Rollen-/Ablaufmodell,
4. tatsächlichen Prüfungen und Ergebnissen,
5. offenen Risiken,
6. vollständigem Git-Status.
