Du bist der Programmierer der Kabelbereitschaft-App. Arbeite ausschließlich im
bestehenden Vault. Lies zuerst vollständig `AGENTS.md`, `CLAUDE.md`,
`PROJEKT_WISSEN.md`, `PROJEKTSTATUS.md` und
`00-Projektsteuerung/ADR-011-postgres-eigenplattform.md`.

## Auftrag: begrenzte Korrekturen nach Architekturreview der AP14/B-Auth-Basis

Der bisherige Diff und seine grünen Testnachweise bleiben die Grundlage.
Korrigiere ausschließlich die folgenden Punkte, ohne GUI-Neugestaltung:

1. **Mehrfachanweisungs-Umgehung im DB-Wrapper schließen.**
   `DatabaseClient.query()` übergibt bei leerer Werteliste derzeit `[]`.
   `node-postgres` nutzt dann das Simple-Query-Protokoll; eine Zeichenkette wie
   `select 1; set ...` kann mehrere Anweisungen enthalten, obwohl
   `statement-guard.ts` nur das erste Schlüsselwort prüft. Erzwinge für jede
   fachliche Abfrage das Extended-Query-Protokoll oder eine gleichwertige
   strukturelle Sperre. Ergänze einen echten Test, der nachweist, dass eine
   Mehrfachanweisung nicht ausgeführt wird. Keine rein kommentierende Lösung.

2. **Eigene Sitzung beim Einzelwiderruf erzwingen.**
   `revokeSession(actorUserId, sessionId, ...)` darf ausschließlich eine
   Sitzung widerrufen, deren `account_id = actorUserId` ist. Ergänze die
   Bedingung und einen Negativtest mit fremder Sitzungs-ID.

3. **Schnittstelle für den Massenwiderruf härten.**
   `revokeAllSessionsForAccount(actorUserId, accountId, ...)` darf nicht als
   ungeschützte allgemeine Schnittstelle bestehen. Erlaube Selbstwiderruf oder
   einen aus der Datenbank bestätigten Administrator; alle anderen Fälle
   müssen fail-closed scheitern. Rolle niemals aus einem Parameter oder JWT
   übernehmen. Ergänze positive und negative Tests.

4. **Ersten Administrator bootstrapbar machen.**
   Implementiere das in ADR-011/2.11 verlangte einmalige, nicht-visuelle
   Bootstrap-Werkzeug. Kein Klartextkennwort in Argumenten, Dateien, Logs,
   Dokumentation oder Git. Interaktive verdeckte Kennworteingabe oder eine
   mindestens gleichwertige sichere Lösung; Argon2id über die bestehende
   zentrale Implementierung; idempotent/fail-closed; nur für eine leere bzw.
   eindeutig zulässige Ausgangslage. Dokumentiere den Betreiberablauf knapp
   und teste ihn gegen synthetisches PostgreSQL.

5. **Dokumentationsfehler korrigieren.**
   Der belegte Anmeldelauf hat 10, nicht 9 Szenarien. Korrigiere ausschließlich
   die falschen Mengenangaben in `PROJEKT_WISSEN.md` und `PROJEKTSTATUS.md` und
   ergänze das zehnte Szenario (transaktionslokale Laufzeitgrenzen), ohne einen
   Commit-/Push-/CI-Nachweis zu behaupten.

6. **Sitzungs-ID prüfen.**
   Prüfe erneut, ob `sid` wirklich in `/api/auth/session` an den Browser
   ausgegeben werden muss. Wenn sie ohne unsichere Cookie-Decodierung aus dem
   clientseitigen Sessionobjekt entfernt werden kann, entferne sie und passe
   die serverseitige Abmeldung sauber an. Falls Auth.js v5 dies im jetzigen
   Aufbau nicht belastbar trennt, ändere nichts und begründe das im Bericht.

Führe danach mindestens TypeScript, ESLint, Einheitentests,
Next-Produktions-Build, den vollständigen AP14/B-Datenbanklauf und die
Anmelde-/Abmeldeszenarien erneut aus. Temporäre Testcluster, Server und
Hilfsdateien vollständig entfernen; den vorhandenen PostgreSQL-Dienst nicht
verändern.

Nicht committen, nicht pushen, nicht mergen, keinen Tag setzen. Beende mit dem
Bericht gemäß `CLAUDE.md`, exakten Exit-Codes/Testzahlen und vollständigem
Git-Status.

## Wiederaufnahmehinweis nach kontrolliert beendetem Teststillstand

Ein vorheriger Lauf hat die Codeänderungen dieses Auftrags bereits teilweise
umgesetzt. Prüfe den aktuellen Datenträgerstand und führe sie fort; nichts
zurücksetzen.

Der vollständige Datenbanktest blieb unter Windows zweimal reproduzierbar
direkt nach `pg_ctl ... -w start` hängen. Das temporäre Cluster war jeweils
erfolgreich gestartet und auf Port 55432 erreichbar, aber der aufrufende
PowerShell-Prozess wartete ohne aktive Datenbankabfrage. Ursache ist die
vererbte Standardausgabe des langlebigen `postgres.exe` in der vom Claude-Tool
eingefangenen PowerShell-Pipeline. Beide hängenden synthetischen Prozesse und
Cluster wurden kontrolliert gestoppt und ausschließlich deren Tempverzeichnisse
entfernt; `postgresql-x64-18` läuft unverändert.

Korrigiere `run_ap14b_local.ps1` so, dass Start und Stopp des temporären
Clusters über `Start-Process` mit eigener, endlicher Umleitung von stdout und
stderr oder eine gleichwertige handle-sichere Variante laufen. Verwende keine
Pipeline, deren Schreibende der gestartete Server erben kann. Prüfe nach Start
zusätzlich mit begrenztem Timeout die Bereitschaft. Prüfe nach Stopp, dass der
Port nicht mehr lauscht und entferne das Tempverzeichnis. Führe danach den
vollständigen Lauf erneut aus.
