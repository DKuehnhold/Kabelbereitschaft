# Agentenmodell – Kabelbereitschaft-App

## Verbindliche Rollen

- **Dennis:** Produktverantwortlicher. Entscheidet sichtbare GUI-/Designfragen,
  fachliche V1-Aufbewahrungsfristen sowie endgültige Releasefreigaben.
- **ChatGPT/Codex:** Architekt, Arbeitsplaner und unabhängige Qualitätsinstanz.
  Zerlegt Arbeitspakete, prüft Architektur, Code, Tests und CI, erteilt technische
  Rückläufe und gibt den nächsten Programmierauftrag.
- **Claude:** Programmierer. Implementiert ausschließlich im bestehenden Vault nach
  `CLAUDE.md` und den abgegrenzten Aufträgen von ChatGPT/Codex.

## Automatischer Arbeitskreislauf

1. ChatGPT/Codex liest `PROJEKT_WISSEN.md`, Git-/CI-Stand und die führende Architektur.
2. ChatGPT/Codex formuliert einen begrenzten technischen Programmierauftrag.
3. Claude implementiert und testet im bestehenden Vault.
4. ChatGPT/Codex prüft den tatsächlichen Diff und die Testnachweise.
5. Bei Mängeln erhält Claude einen konkreten Korrekturauftrag; danach beginnt Schritt 4 erneut.
6. Nur ein abgegrenzter, bestandener Stand wird committet und gepusht.
7. Der nächste nicht-visuelle Auftrag startet automatisch.
8. Der Kreislauf hält nur bei einer sichtbaren GUI-/Designentscheidung, einem zwingend
   fehlenden IT-Zugang, der fachlichen V1-Entscheidung oder einem echten Sicherheitsblocker.

## Gemeinsame Schutzregeln

- Ausschließlich im Vault
  `C:\Users\DennisKühnhold\OneDrive - W & S Technik GmbH\Kabelbereitschaft-App\Kabelbereitschaft-App`
  arbeiten.
- Keine Ersatzpfade, Clones oder externe Cloud-/Supabase-Dienste.
- Keine erfundenen Testergebnisse oder Nachweise.
- Keine konkurrierenden Schreibvorgänge: Vor jeder Änderung aktiven Agenten- und Git-Status prüfen.
- `PROJEKT_WISSEN.md` bleibt die zentrale kompakte Projektübersicht; keine parallele
  Statusübersicht anlegen.
- GUI-Arbeit beginnt gemeinsam mit Dennis. Bis dahin werden vorhandene Oberflächen nur
  technisch funktionsfähig gehalten, nicht gestalterisch neu entschieden.
