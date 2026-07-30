# Finales Architektur-Gate: Agentenverträge und Projektstand

## Ausgangslage

Die Runner- und Sperrkorrekturen sind technisch bestanden. Vor dem
Konfigurations-Commit bleiben drei dokumentierte Konsistenzmängel. Behebe nur
diese Punkte. Keine App-Fachdatei, Migration, GUI oder ManagementOS-Datei
ändern. Kein Commit, Push, Merge, Tag oder Release.

## Positivliste

Du darfst ausschließlich ändern:

- `.claude/agents/kb-tests-evidence.md`
- `.claude/agents/kb-sicherheit-rls.md`
- `AGENTS.md`
- `PROJEKT_WISSEN.md`
- `PROJEKTSTATUS.md`
- `.claude/automation/tasks/configure-claude-agent-orchestrator.md`

## Korrektur 1: Tests/Evidence eindeutig read-only

`kb-tests-evidence` hat absichtlich nur `Read, Grep, Glob, Bash`, aber weder
`Edit` noch `Write`. Entferne deshalb die widersprüchliche Zusage, dieser Agent
dürfe Testdateien nach Delegation ändern.

Verbindliches Modell:

- `kb-tests-evidence` ist gegenüber versionierten Projektdateien strikt
  read-only.
- Er darf notwendige temporäre Testartefakte nur im bereits ignorierten
  Runtime-/Build-/Testbereich erzeugen und muss sie am Laufende entfernen.
- Eine nötige Änderung an Testdateien wird als Befund an Claude gemeldet und
  anschließend in einem getrennten, sequenziellen Schreibauftrag an
  `kb-implementierung` delegiert.
- Keine Shell-Umleitung zum Umgehen fehlender `Edit`-/`Write`-Werkzeuge.

Ziehe die Profiltabelle bzw. Erläuterung in `AGENTS.md` konsistent nach.

## Korrektur 2: Sicherheitsprofil erhält vollständigen Agentenvertrag

Ergänze `kb-sicherheit-rls` um die fehlende explizite Vertragsprüfung:

- Claude muss Positivliste, Negativliste, Definition of Done und Stopppunkt
  übergeben.
- Fehlt ein Bestandteil, führt der Agent keine Prüfung aus und meldet an Claude.
- Eigener Scope darf nicht erweitert werden.
- Ein eindeutiger Stopppunkt und DoD-Bericht gehören in den Abschluss.

Das Profil bleibt technisch strikt read-only mit `Read, Grep, Glob`.

## Korrektur 3: Führenden Projektstand minimal aktualisieren

Aktualisiere `PROJEKT_WISSEN.md` und `PROJEKTSTATUS.md` minimal auf
2026-07-30:

- Zielplattform bleibt ADR-011: PostgreSQL 18 + Auth.js v5 + MinIO +
  Container hinter internem Reverse-Proxy.
- Der gemergte Auth.js/PostgreSQL-Stand auf `main`
  `22db6dad8958146be4de667a55e89ba170e73b7c` ist bestätigt.
- Nächstes nicht-visuelles Fachpaket ist AP14B
  `data-incidents-tasks-sync`: Ablösung der verbliebenen Supabase-Zugriffe in
  Vorgängen, Aufgaben und Offline-Sync durch PostgreSQL/RLS.
- Keine Formulierung darf „reale Supabase-Abnahme“ als nächsten Zielschritt
  führen.
- V1 bleibt Produktionssperre, Branding bleibt separat, GUI-/Designarbeit
  wartet auf Dennis.

Keine neue Übersicht anlegen und keine Historie umschreiben. Nur den aktuellen
Kopf-/Status- und Nächster-Schritt-Bereich berichtigen.

## Korrektur 4: Einmaligen Setup-Auftrag als historisch markieren

Markiere `.claude/automation/tasks/configure-claude-agent-orchestrator.md` am
Dateianfang eindeutig als **abgeschlossenen historischen Einmalauftrag, nicht
erneut ausführen**. Der darin genannte Hash ist der damalige verifizierte
Ausgangspunkt und keine aktuelle Startvorbedingung. Die historische
Auftragsbeschreibung ansonsten nicht umschreiben.

## Verifikation

Claude orchestriert die Arbeit mit vollständigen Agentenverträgen und
Einzelschreiberregel. Mindestens:

1. read-only Konsistenzprüfung durch `kb-sicherheit-rls`,
2. Dokumentationsänderungen sequenziell durch `kb-dokumentation`,
3. unabhängige read-only Endprüfung.

Danach selbst nachweisen:

- YAML-/Profilstruktur lesbar,
- `kb-tests-evidence` enthält keine Erlaubnis mehr, versionierte Testdateien zu
  ändern oder fehlende Schreibwerkzeuge per Shell zu umgehen,
- `kb-sicherheit-rls` nennt Positivliste, Negativliste, DoD und Stopppunkt,
- keine aktuelle Formulierung „reale Supabase-Abnahme“ als nächstes Paket,
- `PROJEKT_WISSEN.md` und `PROJEKTSTATUS.md` Stand 2026-07-30,
- `git diff --check` Exit 0,
- vollständiger Git-Status.

## Definition of Done und Stopppunkt

Erledigt sind ausschließlich die vier Korrekturen oben. Bei erforderlicher
Änderung außerhalb der Positivliste, widersprüchlichem Git-Zustand oder dreimal
demselben Fehler stoppen und den Rohbefund an Codex übergeben. Keine
Scope-Erweiterung.
