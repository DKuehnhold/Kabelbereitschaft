# Agentenmodell – Kabelbereitschaft-App

## Verbindliche Rollen (Entscheidung Dennis, 2026-07-30)

- **Dennis:** Produktverantwortlicher. Entscheidet ausschließlich sichtbare
  GUI-/Designfragen, zwingend fehlende IT-Zugänge, die fachliche V1-Entscheidung
  und die endgültige Releasefreigabe.
- **ChatGPT/Codex:** Architekt und unabhängiger Qualitätsprüfer. Setzt
  Architekturgrenzen, grenzt Arbeitspakete fachlich ab und prüft den fertigen
  Gesamt-Diff samt Nachweisen. **Codex orchestriert und startet keine
  Ausführungs-Agents.**
- **Claude:** Ausführender **Orchestrator**. Claude zerlegt das freigegebene
  Architekturpaket in Teil-Scopes, startet und steuert seine spezialisierten
  Ausführungs-Agents, prüft deren Ergebnisse und den Gesamt-Diff und übergibt an
  Codex.
- **Claude-Agents:** Ausführende Spezialprofile unter `.claude/agents/`. Sie
  implementieren, testen oder prüfen ausschließlich im von Claude zugewiesenen
  Teil-Scope.

Diese Entscheidung ersetzt die frühere Formulierung „Claude ist nur
Programmierer“. Das MOS-Modell (zentraler Orchestrator, klare Verträge, Scope,
Evidence, Circuit Breaker) dient nur als Strukturreferenz; es wird nicht kopiert
und **keine ManagementOS-Datei wird geändert**.

## Verbindliche Orchestrierungsregeln

1. **Claude ist der einzige Orchestrator.** Nur der Claude-Hauptprozess startet
   Ausführungs-Agents. Kein Agent startet weitere Agents.
2. **Claude ist der einzige Mediator.** Keine direkte Agent-zu-Agent-Kommunikation.
   Jedes Ergebnis läuft über Claude.
3. **Einzelschreiberregel:** Im gemeinsamen Vault schreibt zu jedem Zeitpunkt
   höchstens **ein** Agent (oder Claude selbst). Read-only Analyse- und
   Prüfagents dürfen parallel laufen.
4. **Agentenvertrag:** Jeder Agentenauftrag enthält verbindlich
   - **Positivliste** – die konkret erlaubten Dateien/Pfade,
   - **Negativliste** – ausdrücklich verbotene Dateien/Aktionen,
   - **DoD** – prüfbare Definition of Done,
   - **Stopppunkt** – Bedingung, bei der der Agent anhält und an Claude meldet.
5. **Kein Scope-Wechsel durch Agents.** Ein Agent, der Arbeit außerhalb seiner
   Positivliste für nötig hält, stoppt und meldet an Claude.
6. **Claude verifiziert vor der Übergabe** jedes Agentenergebnis und den
   vollständigen Gesamt-Diff. Agentenaussagen gelten nicht als Nachweis, bevor
   Claude sie geprüft hat.
7. **Keine Selbstfreigabe.** Weder Claude noch ein Agent führt Commit, Push,
   Merge, Tag, Release oder eine Freigabe aus.
8. **Circuit Breaker:** Bei dreimal demselben Fehler in derselben Teilaufgabe
   wird gestoppt und mit Rohbefund an Codex gemeldet – kein vierter Versuch.
9. **Keine erfundenen Nachweise.** Nur tatsächlich erhobene Ergebnisse mit
   Exit-Code bzw. exakter Ausgabe.
10. **Nur der bestehende Vault.** Keine Clones, Ersatzordner, Wegwerfkopien,
    parallelen Projektablagen oder fremden Dienste.

## Ablauf eines Arbeitspakets

1. Codex setzt Architekturgrenzen und formuliert das abgegrenzte Arbeitspaket.
2. Claude liest `AGENTS.md`, `CLAUDE.md`, `PROJEKT_WISSEN.md`,
   `PROJEKTSTATUS.md`, die führende Architektur, den Git-Stand und die operative
   Statusdatei `.claude/automation/status/fortschritt.json` (keine
   Projektwahrheit).
3. Claude zerlegt das Paket in Teil-Scopes und legt je Teil-Scope den
   Agentenvertrag fest (Positivliste, Negativliste, DoD, Stopppunkt).
4. Claude führt die Teil-Scopes aus: **ein** Schreibagent je Teilpaket
   sequenziell; read-only Analyse-/Prüfagents parallel.
5. Claude prüft Agentenergebnisse, führt die Nachweise selbst nachvollziehbar
   zusammen und prüft den Gesamt-Diff.
6. Claude übergibt an Codex: geänderte Dateien, Verhalten, exakte
   Prüfergebnisse, Risiken, Git-Status, ausdrückliche Aussage zu Commit/Push.
7. Codex prüft. Bei Mängeln geht ein konkreter Korrekturauftrag an Claude;
   danach beginnt Schritt 3 erneut.
8. Der Kreislauf hält bei einer sichtbaren GUI-/Designentscheidung, einem
   zwingend fehlenden IT-Zugang, der fachlichen V1-Entscheidung, einem echten
   Sicherheitsblocker oder einem ausgelösten Circuit Breaker.

## Agentenprofile

Die projektbezogenen Profile liegen als Markdown mit YAML-Frontmatter unter
`.claude/agents/`:

| Profil | Zweck | Schreibrecht |
| --- | --- | --- |
| `kb-implementierung` | Code im zugewiesenen Datei-Scope | ja, nur Positivliste |
| `kb-tests-evidence` | Prüfungen ausführen, Rohwerte berichten | nein (strikt read-only, auch Testdateien) |
| `kb-sicherheit-rls` | Review Auth, SQL, RLS, Secrets, Transaktionen, Fail-closed | nein |
| `kb-dokumentation` | Nur zugewiesene Projektdokumente, Widerspruchsprüfung | ja, nur Positivliste |

Kein Profil darf committen, pushen, mergen, taggen, andere Agents orchestrieren
oder seinen Scope ändern.

Die Rechte sind zweifach begrenzt:

1. **Werkzeugminimierung** über das Feld `tools` je Profil. `kb-sicherheit-rls`
   ist mit `Read, Grep, Glob` technisch read-only. `kb-implementierung` und
   `kb-dokumentation` haben kein Shell-Werkzeug und können deshalb kein
   Git-Kommando ausführen. `kb-tests-evidence` ist das **einzige** Profil mit
   Shell-Zugriff, weil es Prüfungen ausführen muss; es hat **weder `Edit` noch
   `Write`** und bleibt trotz Shell-Zugriff gegenüber versionierten
   Projektdateien strikt read-only – ausdrücklich einschließlich Testdateien.
   Die Shell darf im versionierten Arbeitsbaum **nicht** als Schreibersatz
   dienen: keine Ausgabeumleitung (`>`, `>>`), kein `tee`, `Set-Content`,
   `Add-Content`, `Out-File` und kein Heredoc. Temporäre Testartefakte sind nur
   im bereits ignorierten Runtime-/Build-/Testbereich zulässig und werden am
   Laufende mit Nachweis entfernt. Eine nötige Testdateiänderung ist ein Befund
   an Claude und wird danach in einem getrennten, sequenziellen Auftrag von
   `kb-implementierung` ausgeführt.
2. **Berechtigungssperren** in `.claude/settings.json`: `permissions.deny`
   verweigert projektweit – jeweils in der exakten und in der Argumentform –
   `git commit`, `push`, `merge`, `tag`, `rebase`, `reset`, `clean`, `stash`,
   `am`, `cherry-pick`, `revert`, `filter-branch` und `update-ref` sowie
   `gh pr`, `gh release` und `gh api`. Die Sperre gilt für Claude selbst und
   für jeden Agenten. Lesende Kommandos wie `git status`, `git diff`,
   `git log` und `git rev-parse` bleiben möglich. Diese Sperre ist eine
   zusätzliche Schicht, kein Ersatz für die Regeln oben.

## Start des Orchestrators

Primärer nicht-interaktiver Startpunkt:

```powershell
.\.claude\automation\run-orchestrator.ps1 -TaskFile .\.claude\automation\tasks\<auftrag>.md
```

`run-programmer.ps1` ist **veraltet** und leitet nur noch auf
`run-orchestrator.ps1` weiter. Status und Nachweise eines Laufs liegen unter
`.claude/automation/runtime/` und sind bewusst nicht versioniert.

### Nachweisvertrag eines Laufs

1. Nach Abschluss eines Laufs wird **zuerst**
   `.claude/automation/runtime/state.json` gelesen.
2. Maßgeblich sind ausschließlich die dort genannten Felder `resultFile`
   (Ergebnisausgabe) und `errorFile` (Fehlerausgabe). Sie zeigen auf die
   laufbezogenen Dateien `<Laufname>.result.json` und
   `<Laufname>.stderr.log`.
3. Solange `state.json` den Wert `status = "running"` trägt, enthält es
   `resultFile` und `errorFile` noch nicht. Ein Lauf ohne `finishedAt` und
   `exitCode` ist kein Nachweis.
4. `state.json` gilt nur als Nachweis des **soeben gestarteten** Laufs, wenn
   `name` dem verwendeten Laufnamen und `pid` bzw. `startedAt` dem gestarteten
   Prozess entsprechen. Bricht ein Lauf vor dem ersten Statusschreiben ab
   (fehlende Auftragsdatei, fehlendes Claude Code, Blockade durch die
   Laufsperre, `-CheckOnly`), bleibt der Eintrag des **Vorlaufs** stehen –
   samt dessen `status = "completed"` und dessen `resultFile`. Ein solcher
   Eintrag ist Altstand und kein Nachweis.
5. Die alten festen Dateien `.claude/automation/runtime/result.json` und
   `.claude/automation/runtime/stderr.log` sind ausschließlich Altbestand.
   Kein aktueller Runner schreibt sie. Sie dürfen nicht als Ergebnis eines
   neuen Laufs ausgewertet werden.

## Gemeinsame Schutzregeln

- Ausschließlich im Vault
  `C:\Users\DennisKühnhold\OneDrive - W & S Technik GmbH\Kabelbereitschaft-App\Kabelbereitschaft-App`
  arbeiten.
- Keine Ersatzpfade, Clones oder externe Cloud-/Supabase-Dienste.
- Keine erfundenen Testergebnisse oder Nachweise.
- Keine konkurrierenden Schreibvorgänge: vor jeder Änderung aktiven Agenten- und
  Git-Status prüfen.
- `PROJEKT_WISSEN.md` bleibt die zentrale kompakte Projektübersicht; keine
  parallele Statusübersicht anlegen.
- `.claude/automation/status/fortschritt.json` ist die operative Datenquelle des
  Fortschritts-Dashboards, aber **keine fachliche Projektwahrheit**; führend
  bleiben `PROJEKT_WISSEN.md` und `PROJEKTSTATUS.md`. Die Datei bleibt im Vault
  erhalten, gehört aber nicht in Fach-Commits. Zuständigkeit: während eines
  aktiven Claude-Laufs `staffelstab = "Claude"`, Claude hält Todo und Hinweise
  aktuell; mit seiner Abschlussübergabe setzt Claude selbst auf
  `staffelstab = "Codex"`; während Codex-Review, CI und Merge hält Codex den
  Reviewzustand aktuell; nach bestandenem Merge aktualisiert Codex den
  abgeschlossenen Stand, bevor ein neuer Claude-Lauf übernimmt. Es gibt genau
  diese eine Statusdatei; keine zweite Statusdatei und keine parallele
  Schreiblogik.
- GUI-Arbeit beginnt gemeinsam mit Dennis. Bis dahin werden vorhandene
  Oberflächen nur technisch funktionsfähig gehalten, nicht gestalterisch neu
  entschieden.
- Keine Passwörter, Tokens oder Schlüssel in Quelltext, Protokolle oder
  Chat-Ausgaben.
