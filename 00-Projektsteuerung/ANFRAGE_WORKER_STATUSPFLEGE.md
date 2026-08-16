# Anfrage vom Worker-Chat an den Orchestrator/Review-Chat: verbindliche Statuspflege im neuen Zwei-Chat-Modell

> Stand: 2026-08-16. Verfasst von Claude (Rolle Worker, Cowork-Chat 2). Anlass: Dennis hat
> festgestellt, dass `.claude/automation/status/fortschritt.json` zwischen 2026-08-12 und
> 2026-08-16 nicht aktualisiert wurde, obwohl in dieser Zeit AUFTRAG_1–3 / MELDUNG_1–3 /
> REVIEW_1–2 entstanden sind. Konvention wie `CODEX_ANFRAGE_*.md`: schriftliche Notiz, kein
> Chat-Kanal.

## Sofortmaßnahme (bereits erledigt)

`fortschritt.json` ist soeben nachgezogen: `aktualisiert`, `staffelstab`,
`codex.{zustand,text,hinweis}`, `aktuellesTodo.{titel,prozent,hinweis}`, `gesamt.{prozent,hinweis}`
und ein neuer Eintrag in `arbeitspakete[]` für AUFTRAG_1–3. Das Feld heißt weiterhin `codex`
(Schema unverändert gelassen, um das Cowork-Artefakt „Kabelbereitschaft Statusanzeige“ nicht zu
brechen), bezeichnet inhaltlich jetzt aber den Orchestrator/Review-Chat — das steht im Text
selbst als Hinweis, damit es beim Lesen nicht verwirrt.

## Eigentliche Frage

Die alte Regel (Memory `kabelbereitschaft-statusanzeige`, aus der Codex-Ära) lautet: Claude
pflegt `fortschritt.json` bei jedem Teilfortschritt, jedem Blocker und vor jeder
Abschlussübergabe; `PROJEKT_WISSEN.md`/`PROJEKTSTATUS.md` bleiben führend und werden von Claude
nur bei einer entsprechenden Aufgabe angefasst. Im neuen Modell bin **ich** (Worker) laut
`AUFTRAG_1`/`AUFTRAG_2`/`AUFTRAG_3` ausdrücklich **nicht** berechtigt, `PROJEKT_WISSEN.md` oder
`PROJEKTSTATUS.md` zu ändern (Negativliste in jedem Auftrag) — das habt ihr (Review-Chat)
selbst übernommen, laut `PROJEKT_WISSEN.md` „Richtigstellung durch den Review-Chat“.

Damit ist für mich nicht abschließend klar, welche Dateien bei **welcher** Übergabe von **wem**
gepflegt werden müssen. Mein aktuelles Verständnis, bitte bestätigen oder korrigieren:

1. **Worker (ich), bei jeder `MELDUNG_<n>.md`:** die Meldungsnotiz selbst (mache ich bereits)
   sowie `fortschritt.json` (habe ich bisher **nicht** gemacht — hiermit nachgezogen und ab
   sofort bei jeder Meldung).
2. **Orchestrator/Review-Chat, bei jeder `REVIEW_<n>.md`:** die Reviewnotiz selbst sowie ggf.
   `PROJEKT_WISSEN.md`/`PROJEKTSTATUS.md`, falls sich der Fachstand ändert (wie bei
   `REVIEW_1`/`REVIEW_2` bereits gehandhabt) — und vermutlich ebenfalls `fortschritt.json`
   während der Reviewphase (`staffelstab = Codex/Orchestrator`), analog zur alten Regel für
   Codex.
3. Gibt es weitere Dateien außerhalb dieser beiden, die bei einer Übergabe zwingend
   mitgepflegt werden müssen (z. B. `CHANGELOG.md`, `00-Projektsteuerung/ENTSCHEIDUNGEN.md`),
   und wenn ja: von wem?

Bitte um eine kurze, verbindliche Antwort (gern als Ergänzung in `REVIEW_3.md` oder als eigene
Notiz), damit das nicht erneut liegen bleibt. Dennis hat das zu Recht angemahnt.
