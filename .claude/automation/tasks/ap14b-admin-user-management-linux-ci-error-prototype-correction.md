# Architekturauftrag: AP14B V24 – exakte Produktfehlermeldung ohne Realm-/Prototyp-Annahme

## Ausgangslage und belegter Fehler

- `main` steht auf `82c4167`; der fachliche Stand der administrativen Benutzerverwaltung ist `62ab167`.
- PR-CI `30734789895` und der erste main-CI-Lauf `30735713849` waren vollständig grün.
- Im unmittelbar folgenden, nur durch Dokumentationsänderungen ausgelösten main-CI-Lauf `30735824217` schlug ausschließlich Job `database` fehl.
- Konkreter Beleg: V24 erhielt `abgewiesen:error | erfuellt:changed`. Die Invariante `changed.length === 1` bestand. Die zweite Abweisung wurde aber nicht von `isWriteVisibilityLost()` erkannt; diese verlangt derzeit zusätzlich `Object.getPrototypeOf(reason) === Error.prototype`.
- Der Produktcode wirft bei null geänderten Zeilen exakt `new Error("Rollenwechsel: das Profil wurde nicht geaendert.")`.
- Alle temporären CI-Daten wurden laut Log entfernt. Container-Image `30735824203` war grün.

## Ziel

Korrigiere ausschließlich den V24-Test so, dass der dokumentierte fail-closed Produktfehler mit exakter Meldung auch dann erkannt wird, wenn Laufzeit/Loader keine Identität mit dem lokalen `Error.prototype` garantiert. Die Korrektur darf keinen beliebigen Fehler akzeptieren und keine Produktionssicherung abschwächen.

## Positivliste

- `app/test/integration/ap14b-admin-users.int.mjs`
- Falls zwingend für einen echten lokalen Nachweis erforderlich: bestehende Test-Runner-Dateien nur lesen/ausführen, nicht ändern.
- Claude darf für diesen Auftrag spezialisierte Claude-Agents read-only zur Analyse einsetzen; im Vault schreibt höchstens ein Agent.

## Negativliste

- Keine Änderung an Produktcode, Migrationen, Workflow, Abhängigkeiten oder Projektdokumentation.
- Kein pauschales Akzeptieren von `Error`, `error.name === "Error"`, `instanceof Error`, beliebigen Ablehnungen oder beliebigen Meldungen.
- Keine Akzeptanz eines Fehlers mit PostgreSQL-SQLSTATE bzw. `code`, einer bekannten Admin-Fehlerklasse oder eines Verbindungs-/Timeout-/Deadlockfehlers.
- Keine Schwächung der Zusicherungen: exakt ein `changed`; exakt ein aktiver Administrator danach.
- Kein Commit, Push, Merge, Tag oder Release. Kein Scope-Ausbau.
- `07-Betrieb/IT_ANFRAGE_INFRASTRUKTUR.md` nicht anfassen.

## Verbindliche Analyseanforderung

Ermittle und dokumentiere, welche einzelne Bedingung des aktuellen Prädikats beim CI-Ausgang `abgewiesen:error` nicht erfüllt sein kann bzw. durch die Test-/Loader-Laufzeit nicht portabel ist. Begründe die engste portable Ersatzprüfung. Ein bloßes Entfernen des Prototypchecks ohne negative Gegenprobe ist unzulässig.

## Definition of Done

1. Der Produktfehler wird nur akzeptiert, wenn mindestens alle folgenden Merkmale exakt gelten: Ablehnung; Fehlerobjekt; Name `Error`; exakte Meldung `Rollenwechsel: das Profil wurde nicht geaendert.`; keine eigene oder geerbte verwertbare `code`-/SQLSTATE-Kennung.
2. Eine negative Gegenprobe belegt, dass ein generischer `Error` mit anderer Meldung rot bleibt.
3. Negative Gegenproben belegen, dass ein Objekt/Fehler mit derselben Meldung, aber SQLSTATE/`code`, sowie eine bekannte Admin-Fehlerklasse nicht durch den Sonderzweig akzeptiert werden.
4. V24 verlangt weiterhin exakt einen erfolgreichen Rollenwechsel und exakt einen verbleibenden aktiven Administrator.
5. Die betroffene Integrationssuite läuft mindestens mehrfach gegen PostgreSQL 18; wenn Docker/WSL lokal fehlen, ist das als nicht erbracht zu markieren und durch statische/Unit-Gegenproben zu ergänzen, nicht zu erfinden.
6. TypeScript, ESLint, Einheitentests und Build werden proportional zur Ein-Datei-Änderung ausgeführt oder ehrlich als nicht erbracht benannt.
7. Vollständiger Diff, `git diff --check`, Testausgaben, Exitcodes und Aufräumbilanz werden als Evidence geliefert.

## Stopppunkt

Nach einer minimalen, belegten Ein-Datei-Korrektur und den Nachweisen stoppen und an Codex übergeben. Bei erforderlicher Produktcode-/Schema-/Workflowänderung, unklarer Fehleridentität oder nicht sicher eng formulierbarer Erkennung ohne Scope-Ausbau sofort stoppen und den Blocker melden.

## Evidence je Agent

Jeder beteiligte Claude-Agent nennt Rolle, gelesene/geänderte Dateien, konkrete Befunde, ausgeführte Befehle mit Exitcodes, nicht ausgeführte Prüfungen und bestätigt die Negativliste. Der Orchestrator liefert abschließend Positivlistenabgleich, Negativlistenabgleich, Definition-of-Done-Matrix, Stopppunkt und Rest-Risiken.
