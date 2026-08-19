# Chat-Status (Einzelschreiber-Koordination)

> Konvention (Entscheidung Dennis, 2026-08-16): Beide automatisierten Chats prüfen VOR jedem
> Schreibzugriff im Vault diese Datei und tragen sich ein. Regeln:
> 1. Vor dem Schreiben: eigenen Abschnitt auf `arbeitet` + Zeitstempel + Woran setzen.
>    Steht der ANDERE Abschnitt auf `arbeitet` und ist sein Zeitstempel jünger als 30 Minuten:
>    NICHT schreiben, Lauf beenden, nächster Zyklus versucht es erneut.
> 2. Nach dem letzten Schreibzugriff des Laufs: eigenen Abschnitt auf `frei` setzen.
> 3. Ein Zeitstempel älter als 30 Minuten gilt als verwaister Eintrag (abgebrochener Lauf) und
>    blockiert nicht.
> 4. Nur den EIGENEN Abschnitt ändern. Format der Zeilen nicht verändern.
>
> **Nachtrag 2026-08-19 (Entscheidung Dennis):** Der Worker-Chat ist seit 2026-08-17
> stillgelegt. Der zweite Abschnitt gehört jetzt dem **Automatiklauf** — dem scheduled task
> `kb-review-zyklus`, der alle 10 Minuten Meldungen ohne Review prüft. Chat 1 hat **Vorrang**:
> steht er auf `arbeitet` und ist sein Zeitstempel jünger als 30 Minuten, beendet der
> Automatiklauf seinen Durchgang ohne zu schreiben. Hintergrund:
> `BEFUND_SCHEDULED_TASK_DOPPELSCHREIBER.md`.

## Orchestrator/Review (Chat 1)

status: frei
seit: 2026-08-19 11:05
woran: - (VOLLSTAENDIGER DB-LAUF GRUEN bei Dennis: Migrationen 0001-0022, Smokes 15-29, alle Node-Integrationssuiten, Aufraeumbilanz sauber. Zusammen mit Build Exit 0, ESLint still, tsc 0 und 227/227 sind alle Nachweise fuer AUFTRAG_15-27 erbracht. Offen: .claude/-CRLF, Sichtpruefungen im Browser, dann Commit + Push + CI)

## Automatiklauf (Chat 2)

status: frei
seit: 2026-08-19 10:35
woran: - (REVIEW_26 geschrieben: gruen, eigene Messwerte 227/227 Exit 0, tsc Exit 0, audit 0; Auflage: Smoke 29 weiterhin ungelaufen bis Dennis' DB-Lauf. Kein neuer Auftrag angelegt.)
