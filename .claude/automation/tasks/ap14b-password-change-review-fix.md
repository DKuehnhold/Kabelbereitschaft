Du bist der Programmierer der Kabelbereitschaft-App. Arbeite ausschliesslich im
bestehenden Vault. Lies zuerst vollständig `AGENTS.md`, `CLAUDE.md`,
`PROJEKT_WISSEN.md`, `PROJEKTSTATUS.md` und
`00-Projektsteuerung/ADR-011-postgres-eigenplattform.md`.

## Auftrag: letzte Architekturkorrektur der AP14/B-Auth-Basis

Der bestehende uncommittete Auth-/PostgreSQL-Diff ist unabhängig geprüft. Alle
bisherigen Tests sind grün. Setze ausschliesslich die noch fehlende verbindliche
Anforderung aus ADR-011, Abschnitte 2.3 und 2.12, um:

1. Ein Konto mit `must_change_password = true` darf nach der Anmeldung keine
   andere geschützte Seite, Server Action oder geschützte API nutzen. Es muss
   serverseitig auf einen Passwortwechselpfad gelenkt werden. Die Sperre darf
   nicht nur in einer Client-Komponente liegen.
2. Implementiere einen minimalen, rein funktionalen Passwortwechsel im
   vorhandenen visuellen Stil. Keine neue Gestaltung, keine Varianten und keine
   GUI-Grundsatzentscheidung.
3. Verlange aktuelles Passwort, neues Passwort und Bestätigung. Nutze die
   zentrale Argon2id-Implementierung und dieselben zentralen Passwortregeln wie
   das Bootstrap-Werkzeug; keine doppelte Kryptologik.
4. Ändere den Hash, setze `must_change_password = false`, aktualisiere
   `password_hash_version` und widerrufe atomar alle Sitzungen des Kontos.
   Danach muss die aktuelle Auth.js-Sitzung beendet und eine erneute Anmeldung
   erforderlich sein. Jeder Widerruf bleibt auditiert. Keine Klartextwerte in
   Logs, Fehlern, Dateien oder Audit.
5. Falsches aktuelles Passwort, zu kurzes/neues nicht übereinstimmendes
   Passwort, inaktives/deaktiviertes Konto und Datenbankfehler müssen
   fail-closed bleiben. Benutzernahe Fehlermeldungen dürfen keine
   Kontoaufzählung ermöglichen.
6. Ergänze gezielte Einheits-, Browser- und echte PostgreSQL-Integrationstests.
   Der Pflichtnachweis aus ADR-011/2.12(e) muss ausdrücklich belegen, dass
   `must_change_password` alle anderen Routen sperrt.
7. Mache die Browser-Sitzungsfilterung fail-closed: Wenn die Antwort des
   Session-Endpunkts unerwartet kein lesbares JSON-Objekt mit `user` ist, darf
   nicht vorsorglich eine möglicherweise interne Sitzungsauskunft unverändert
   an den Browser gehen. Bewahre Status/Cookies bei regulären Antworten und
   ergänze Negativtests.
8. Ergänze `/.claude/automation/runtime/` in der projektweiten `.gitignore`,
   damit Laufzustände und Claude-Berichte nie in Git gelangen. Quellskript,
   Rollenregeln und Aufgaben dürfen versioniert bleiben.
9. Dokumentiere den technisch umgesetzten Stand knapp in den bestehenden
   führenden Dokumenten; keine neue Übersicht und keine Behauptung über
   Commit, Push oder CI.

Führe danach TypeScript, ESLint, Einheitentests, Produktions-Build, alle
`@public`-Browserprüfungen und den vollständigen AP14/B-Datenbanklauf mit
temporärem PostgreSQL-Cluster aus. Entferne alle temporären Server, Cluster und
Hilfsdateien. Den vorhandenen PostgreSQL-Dienst nicht verändern.

Nicht committen, nicht pushen, nicht mergen und keinen Tag setzen. Beende mit
dem Bericht aus `CLAUDE.md`, exakten Exit-Codes/Testzahlen und vollständigem
Git-Status.
