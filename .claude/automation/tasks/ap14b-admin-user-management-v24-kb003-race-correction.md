# Architekturauftrag: AP14B V24 – belegten KB003-Wettlaufausgang eng modellieren

## Belegter Ausgangspunkt

- main steht auf efb7d02.
- CI 30787829314, Job database, scheitert ausschließlich in V24 mit:
  abgewiesen:error(KB003) | erfuellt:changed.
- verify, container, objectstore und Container-Image 30787829292 sind grün.
- Der unmittelbar zuvor unabhängig ausgeführte lokale PostgreSQL-18-Gesamtlauf war Exit 0: Migrationen 0001–0017, alle Smokes, Integrationssuiten 32/32, 31/31, 37/37 und Admin 31/31; temporäres Cluster, Datenbank, Rolle, Port und Arbeitsverzeichnis wurden vollständig entfernt.
- Die Diagnose beweist: der unterlegene Aufruf traf den Datenbankwächter tg_protect_profile_active_admin() erst, nachdem assertActiveAdmin zuvor bestanden hatte und die konkurrierende Selbstherabstufung von ADMIN_A festgeschrieben war. Das ist ein enger, fail-closed Wettlaufausgang; genau eine Herabstufung gelang und KB003 verhinderte die zweite.

## Architekturentscheidung

Produktcode und Datenbankvertrag bleiben unverändert: KB003 wird weiterhin nicht in einen fachlichen Rückgabewert übersetzt. Ausschließlich V24 darf den exakt belegten KB003-Ausgang als sechsten legitimen Race-Ausgang anerkennen. Die Erkennung muss so eng sein, dass andere SQLSTATEs, andere KB003-Meldungen, andere Fehlerklassen und beliebige Errors rot bleiben.

## Positivliste

- app/test/integration/ap14b-admin-users.int.mjs
- Bestehende Runner read-only ausführen.

## Negativliste

- Kein Produktcode, keine Migration, kein Workflow, keine Abhängigkeit, keine Projektstatus-/Projektwissendatei.
- admin-users.ts darf KB003 weiterhin nicht fangen oder umwandeln.
- Kein pauschales Akzeptieren von DatabaseError, error.name === "error", code allgemein, beliebigen SQLSTATEs oder Meldungsmustern.
- KB001, KB002, 42501, 57014, 40P01 und Fehler ohne Code bleiben unzulässig, sofern sie nicht bereits durch einen anderen bestehenden, eng benannten V24-Ausgang abgedeckt sind.
- Die Diagnoseausgabe des SQLSTATE darf erhalten bleiben, aber keine Geheimnisse, IDs oder vollständigen sonstigen Datenbankmeldungen ausgeben.
- Kein Commit, Push, Merge, Tag oder Release.
- 07-Betrieb/IT_ANFRAGE_INFRASTRUKTUR.md nicht anfassen.

## Definition of Done

1. Genau app/test/integration/ap14b-admin-users.int.mjs ist versioniert geändert.
2. Ein eigenes Prädikat erkennt nur einen abgewiesenen Fehler mit allen Merkmalen zugleich: Fehlerobjekt; name === "error"; code === "KB003"; exakte Meldung "Rollenwechsel auf public.profiles ohne aktive Adminrolle verweigert.". Falls eine stabile DatabaseError-Klassenprüfung im vorhandenen Testsetup ohne neue Abhängigkeit möglich ist, ist sie zusätzlich zu verwenden; andernfalls ist zu begründen, warum Code+Name+exakte Meldung die engste portable Form ist.
3. Nur dieses Prädikat wird als zusätzliche Disjunktion in otherAccepted aufgenommen. Alle bisherigen Zweige bleiben unverändert.
4. V24 fordert weiterhin exakt einen changed-Ausgang und danach exakt einen aktiven Administrator.
5. Der Fallkommentar dokumentiert den sechsten Ausgang korrekt: assertActiveAdmin bestand, die konkurrierende Selbstherabstufung wurde festgeschrieben, der BEFORE-UPDATE-Wächter prüfte die nun nicht mehr aktive Identität und verweigerte fail-closed mit KB003.
6. Isolierte negative Gegenproben belegen mindestens: gleiche Meldung mit KB002 rot; KB003 mit anderer Meldung rot; generischer Error rot; SQLSTATE 42501 rot; exakter KB003-Fall grün.
7. TypeScript, ESLint, 84 Unit-Tests, git diff --check und der vollständige PostgreSQL-18-Gesamtlauf werden ausgeführt. V24 ist mehrfach zu wiederholen, soweit der vorhandene Runner dies ohne dauerhafte Artefakte sicher ermöglicht. Keine Scheingrünaussage ohne Pflichtmodus.
8. Vollständiger Diff, Exitcodes und Aufräumbilanz werden als Evidence geliefert.

## Stopppunkt

Nach minimaler Ein-Datei-Korrektur und echten Nachweisen stoppen und an Codex übergeben. Wenn Produktcode, Schema oder Workflow geändert werden müsste oder der exakte KB003-Ausgang nicht reproduzierbar/eng erkennbar ist, ohne Scope-Ausbau stoppen und Blocker melden.

## Evidence je Agent

Jeder beteiligte Claude-Agent nennt Rolle, gelesene/geänderte Dateien, konkrete Befunde, Befehle mit Exitcodes, nicht ausgeführte Prüfungen und bestätigt die Negativliste. Der Orchestrator liefert Positivlistenabgleich, Negativlistenabgleich, DoD-Matrix, Stopppunkt und Restrisiken.
