# BEFUND: scheduled task `kb-review-zyklus` schreibt als zweiter Orchestrator in den Vault

> Erhoben vom Orchestrator/Review-Chat am 2026-08-18 während der Nachmessung zu AUFTRAG_20/21.
> **Der Task ist inzwischen deaktiviert** (siehe „Was ich getan habe").

## Was aufgefallen ist

Während meiner laufenden Arbeit an AUFTRAG_20/21 sind im Vault Dateien entstanden, die **nicht
von mir** stammen:

- `00-Projektsteuerung/REVIEW_18_19_20.md` (124 Zeilen)
- `00-Projektsteuerung/AUFTRAG_20K.md` (90 Zeilen)
- eine Änderung an `00-Projektsteuerung/CHAT_STATUS.md`: mein **eigener** Abschnitt
  „Orchestrator/Review (Chat 1)" wurde auf `status: arbeitet` mit
  `woran: Review zu MELDUNG_18/19/20 (Nachpruefung, REVIEW_18_19_20)` gesetzt.

## Ursache (belegt)

`list_scheduled_tasks` nennt einen aktiven Task:

```
taskId:      kb-review-zyklus
description: Kabelbereitschaft: alle 10 Min. neue Worker-Meldungen prüfen,
             Review schreiben, nächsten Auftrag ablegen
cron:        */10 * * * *      enabled: true
lastRunAt:   2026-08-18T11:08:06Z
```

Das ist der Rest aus dem **stillgelegten Zwei-Chat-Modell**. Der Übergabestand vom 2026-08-17
hatte ihn bereits als Risiko notiert: *„Ein scheduled task „kb-review-zyklus" (alle 10 Min)
existiert noch aus dem Zwei-Chat-Modell. Er sucht MELDUNG-Dateien ohne REVIEW. Falls er störend
Aufträge anlegt: anpassen oder deaktivieren."* Genau dieser Fall ist eingetreten.

## Warum das schädlich ist

1. **Zwei Schreiber im Vault.** Die Einzelschreiberregel aus `AGENTS.md` ist damit ausgehebelt:
   der Task schreibt unabhängig von `CHAT_STATUS.md`, während hier gearbeitet wird.
2. **Doppelter Auftrag auf dieselbe Datei.** `AUFTRAG_20K.md` (Task) und `AUFTRAG_22.md`
   (dieser Chat) beschreiben **dieselbe** Korrektur an
   `app/test/auftrag18-dispo-zeitraum.test.mjs`. Wären beide ausgeführt worden, hätten zwei
   Agenten gleichzeitig dieselbe Datei bearbeitet. Nur durch Zufall der Reihenfolge ist das
   nicht passiert. `AUFTRAG_20K.md` ist inzwischen als gegenstandslos gekennzeichnet.
3. **Falsche Rollenannahme.** Der Task hält weiterhin einen „Worker-Chat" für aktiv und
   deutet meine Arbeit als dessen Arbeit („der Worker arbeitet an AUFTRAG_21, sein
   CHAT_STATUS-Abschnitt stand jedoch auf frei"). Er verweist auf
   `ANFRAGE_WORKER_STATUSPFLEGE.md` und baut daraus eine Disziplinlücke, die es nicht gibt —
   der Worker ist seit 2026-08-17 stillgelegt.
4. **Er überschreibt meinen eigenen Statusabschnitt**, wodurch die Koordinationsdatei ihren
   Zweck verliert.

## Was inhaltlich brauchbar war

Fairerweise: `REVIEW_18_19_20.md` ist sachlich **nicht falsch**. Der Task hat unabhängig
dieselben Befunde erhoben wie ich (u. a. den einen roten Wächtertest nach AUFTRAG_20 und die
richtige Einordnung „Produktivcode in Ordnung, Test zu starr") und zusätzlich zwei Messwerte
beigetragen, die ich nicht erhoben hatte: `npm audit --audit-level=high --omit=dev` →
**0 Schwachstellen, Exit 0**, sowie zwei ESLint-Versuche, die erneut am Zeitlimit von ~178 s
scheiterten (bekannter OneDrive-Mount-Blocker, kein Codebefund). Die Datei bleibt deshalb als
Historie stehen; sie ist nicht zu löschen.

Ein Punkt daraus ist **falsch** und wird hier richtiggestellt: der Task notiert den Prozess-Exit
des Testlaufs mit `0` bei gleichzeitig einem `not ok`. Eigene Messung: ein roter Fall ergibt
`node --test` Prozess-Exit **1**. Für einen Nachweis zählt der Exit-Code, nicht der Eindruck.

## Was ich getan habe

Den Task **deaktiviert** (`enabled: false`) — auf Grundlage der ausdrücklichen Anweisung im
Übergabestand („falls er störend Aufträge anlegt: anpassen oder deaktivieren"). Nichts gelöscht,
nichts an seinem Prompt geändert; das Wiedereinschalten ist ein einziger Handgriff.

## Entscheidung, die bei Dennis liegt

Der Task ist für das **alte** Zwei-Chat-Modell geschrieben. Drei Möglichkeiten:

1. **Deaktiviert lassen** (aktueller Zustand). Reviews entstehen dort, wo auch die Aufträge
   entstehen — in diesem Chat, mit eigenen Messungen. Empfehlung, solange wir so arbeiten.
2. **Prompt auf das neue Modell umschreiben:** kein „Worker" mehr, kein eigenes Anlegen von
   Aufträgen, nur noch **lesende** Kontrolle mit Bericht an Dennis. Dann ist er ein
   unabhängiges Gegenlesen ohne Schreibkonflikt — inhaltlich hat er sich als brauchbar erwiesen.
3. **Löschen.** Nur wenn das unabhängige Gegenlesen dauerhaft nicht gewollt ist.
