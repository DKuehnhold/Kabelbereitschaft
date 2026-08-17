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

## Orchestrator/Review (Chat 1)

status: frei
seit: 2026-08-17 11:20
woran: - (AUFTRAG_5 bis 8 umgesetzt und gruen reviewt; naechster Schritt: Commit/CI durch Dennis)

## Worker (Chat 2)

status: frei
seit: 2026-08-16 00:00
woran: -
