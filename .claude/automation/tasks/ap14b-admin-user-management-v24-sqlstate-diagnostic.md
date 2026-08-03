# Architekturauftrag: AP14B V24 – SQLSTATE sichtbar machen, nichts akzeptieren

## Ausgangslage

- main steht auf `82c4167`.
- CI-Lauf `30735824217`, Job `database`, scheiterte in V24 mit `abgewiesen:error | erfuellt:changed`.
- Der abgeschlossene Analyseauftrag `kb-ap14b-admin-user-management-linux-ci-error-prototype-correction` hat belastbar gezeigt: kleingeschriebenes `error` ist ein durchgereichter `pg`-`DatabaseError`, nicht der nackte Produkt-`Error`. Der SQLSTATE ist im aktuellen Diagnosetext verborgen.
- Die fachliche Invariante blieb im Fehllauf teilweise sichtbar: exakt ein Aufruf war `changed`; welcher Datenbankfehler den anderen Aufruf abwies, ist unbekannt.

## Ziel

Erweitere ausschließlich die Fehleranzeige des V24-Tests so eng, dass ein abgewiesener `pg`-Fehler seinen SQLSTATE im Assertionstext ausgibt. Das Akzeptanzprädikat und alle Sicherheitszusicherungen bleiben unverändert. Dieser Auftrag ist reine Diagnose und darf den roten Ausgang nicht grün machen.

## Positivliste

- `app/test/integration/ap14b-admin-users.int.mjs`
- Bestehende Test-Runner dürfen read-only ausgeführt werden.

## Negativliste

- Keine Änderung an Produktcode, Migrationen, Workflows, Abhängigkeiten, Projektwissen oder Projektstatus.
- Keine Erweiterung von `otherAccepted`; kein neuer erlaubter Ausgang.
- Keine Änderung von `isWriteVisibilityLost`.
- Keine Ausgabe von Geheimnissen, Verbindungsdaten, IDs oder vollständigen Datenbankfehlermeldungen. Erlaubt ist nur die feste Fehlerklassifikation und der SQLSTATE/`code`.
- Kein Commit, Push, Merge, Tag oder Release.
- `07-Betrieb/IT_ANFRAGE_INFRASTRUKTUR.md` nicht anfassen.

## Definition of Done

1. Genau eine versionierte Datei ist geändert: `app/test/integration/ap14b-admin-users.int.mjs`.
2. `describe()` zeigt für abgewiesene Fehler mit nichtleerem stringförmigem `code` einen festen Marker samt `code`, beispielsweise `abgewiesen:error(42501)`, und sonst weiterhin den bestehenden Marker.
3. `otherAccepted`, `isWriteVisibilityLost`, `changed.length === 1` und `activeAdminCount() === 1` bleiben semantisch und textuell unverändert.
4. Eine lokale, isolierte Gegenprobe der Beschreibungslogik belegt mindestens: `DatabaseError` mit `42501` wird als SQLSTATE sichtbar; nackter Produkt-Error bleibt `Error(schreibsicht-verloren)`; generischer nackter Error bleibt `Error(unerwartet)`; erfülltes `changed` bleibt unverändert.
5. TypeScript, ESLint der Datei, relevante Unit-/Integrationsprüfungen soweit real möglich sowie `git diff --check` liefern echte Exitcodes. PostgreSQL 18 nur dann als erbracht melden, wenn tatsächlich ausgeführt.
6. Vollständiger Diff und Negativlistenabgleich werden als Evidence geliefert.

## Stopppunkt

Nach der minimalen Diagnoseänderung und den Nachweisen stoppen und an Codex übergeben. Wenn dafür Produktcode, Testakzeptanz oder Workflow geändert werden müsste, sofort ohne Änderung stoppen.

## Evidence je Agent

Jeder beteiligte Claude-Agent nennt Rolle, gelesene/geänderte Dateien, Befunde, Befehle mit Exitcodes, nicht ausgeführte Prüfungen und Negativlistenabgleich. Der Orchestrator liefert Positivliste, Negativliste, DoD-Matrix, Stopppunkt und Restrisiken.
