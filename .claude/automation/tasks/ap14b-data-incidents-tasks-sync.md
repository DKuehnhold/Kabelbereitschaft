# AP14B Datenmigration 1 – Vorgänge, Aufgaben und Synchronisation

## Ziel und Ausgangspunkt

Ersetze die verbleibenden Supabase-Datenzugriffe für Vorgänge, Aufgaben und
Offline-Synchronisation durch den bereits geprüften PostgreSQL-/Auth.js-Pfad.
Arbeite ausschließlich im bestehenden Vault. Lies zuerst vollständig
`AGENTS.md`, `CLAUDE.md`, `PROJEKT_WISSEN.md`, `PROJEKTSTATUS.md`,
`00-Projektsteuerung/ADR-011-postgres-eigenplattform.md` und diese Datei.

Du bearbeitest diesen Auftrag als **ausführender Orchestrator** nach `AGENTS.md`
(Entscheidung Dennis, 2026-07-30) und delegierst Teilaufgaben an die Profile
unter `.claude/agents/`. Inhaltlicher Scope und Architekturregeln dieses
Auftrags bleiben davon unberührt.

Startvorbedingung (bewusst ohne feste Commit-ID, damit dieser Auftrag auch nach
dem Merge des Konfigurationspakets startfähig bleibt). Starte nur, wenn alle
Punkte erfüllt sind:

- `HEAD` steht auf `main`, und `main` ist deckungsgleich mit `origin/main`
  (`git rev-parse main` und `git rev-parse origin/main` liefern denselben Wert);
- der Arbeitsbaum ist sauber: `git status --porcelain` gibt nichts aus, und es
  ist nichts gestaget;
- es ist keine Git-Sperre und kein anderer schreibender Orchestratorlauf aktiv:
  `.claude/automation/runtime/state.json` weist keinen Lauf mit
  `status = "running"` aus, und
  `.\.claude\automation\run-orchestrator.ps1 -CheckOnly` liefert Exit 0.

Bei jeder Abweichung anhalten und mit Rohbefund an Codex melden. Lege den Branch
`feat/ap14b-data-incidents-tasks-sync` erst nach erfüllter Startvorbedingung aus
dem dann aktuellen `main` an. Existiert dieser Branch bereits, ist das eine
Abweichung: anhalten, den vorhandenen Branch nicht überschreiben und nicht
weiterarbeiten.

## Verbindlicher Umfang

Migriere ausschließlich:

- `app/src/lib/incidents.ts`
- `app/src/lib/incident-actions.ts`
- `app/src/lib/incident-list-actions.ts`
- `app/src/lib/tasks.ts`
- `app/src/lib/task-actions.ts`
- `app/src/app/api/incidents/[id]/meta/route.ts`
- `app/src/app/api/sync/route.ts`

Direkt benötigte kleine Hilfsmodule, additive SQL-Migrationen und Tests sind
zulässig. Keine sichtbare GUI-, Layout-, Styling-, Text- oder
Navigationsänderung. Bildpfade/MinIO, Stammdaten und Lager bleiben eigene
Folgepakete.

## Architekturregeln

1. In den sieben Zieldateien verbleiben weder Supabase-Importe noch
   `supabase.`-Zugriffe.
2. Jeder Datenbankzugriff läuft über `app/src/lib/db/index.ts` und
   `withUserTransaction`; kein rohes `pg`, kein zweiter Pool.
3. Die Benutzer-ID stammt nur aus der serverseitig validierten
   Auth.js-Sitzung. Fehlende Sitzung und `must_change_password` bleiben
   fail-closed.
4. RLS bleibt aktiv. Kein Superuser, `BYPASSRLS`, Service-Role oder neuer
   SECURITY-DEFINER-Umweg.
5. Bestehende PostgreSQL-Funktionen werden parametrisiert per SQL aufgerufen;
   Konfliktcodes, Audit, Statushistorie und AP12/AP13-Verhalten bleiben gleich.
6. Mehrschrittige Operationen sind atomar in einer Transaktion.
7. Dynamische Sortierung/Filterung nur über feste Allow-Lists; niemals
   Benutzerwerte in SQL interpolieren.
8. `sync_actions`-Idempotenz, Konflikterkennung und fachliche Rückgabecodes
   bleiben vollständig erhalten. Keine Identitätsreste zwischen Aktionen.
9. Nur synthetische Daten; keine Secrets oder echten Personen-/GPS-/EXIF-Daten.
10. Für Vorgangsvalidierungen benötigte Stammdaten-Leseabfragen werden innerhalb
    der Zieldateien ebenfalls auf PostgreSQL umgestellt; die Stammdatenmodule
    selbst bleiben unverändert.

## Verifikation

Ergänze belastbare Tests unter nicht privilegiertem `app_user` mit aktiver RLS:

- Admin, Disposition, zugewiesener und fremder Monteur;
- Vorgangsliste/-detail, Erstellen/Aktualisieren, Status,
  Zustandsbewertung, AP13-Bulkstatus und Zuweisung;
- Aufgabenliste/-änderung einschließlich minimierter Monteurprojektion;
- Offline-Sync: Idempotenz, Konflikt, unzulässige Aktion und Rollback bei
  technischem Fehler;
- Suchnachweis: null Supabase-Treffer in allen sieben Zieldateien.

Führe tatsächlich aus: TypeScript, ESLint, Einheitentests,
Produktions-Build, vollständigen lokalen PostgreSQL-18-Lauf mit allen
bisherigen Smokes plus neuen Integrationsfällen und die öffentlichen
Browser-Tests, soweit ohne echte IT-Zugangsdaten möglich. Temporäre
Datenbanken, Server, Ports und Protokolle vollständig entfernen; den
bestehenden PostgreSQL-Dienst nicht verändern.

## Arbeitsweise als Orchestrator

Zerlege den Auftrag in Teilpakete und delegiere sie mit vollständigem
Agentenvertrag (Positivliste, Negativliste, DoD, Stopppunkt). Vorgabe:

1. **Teilpaket Vorgänge** – `kb-implementierung` mit Positivliste
   `app/src/lib/incidents.ts`, `app/src/lib/incident-actions.ts`,
   `app/src/lib/incident-list-actions.ts`,
   `app/src/app/api/incidents/[id]/meta/route.ts`.
2. **Teilpaket Aufgaben** – `kb-implementierung` mit Positivliste
   `app/src/lib/tasks.ts`, `app/src/lib/task-actions.ts`.
3. **Teilpaket Sync** – `kb-implementierung` mit Positivliste
   `app/src/app/api/sync/route.ts`.
4. **Tests/Nachweise** – `kb-tests-evidence` führt TypeScript, ESLint,
   Einheitentests, Produktions-Build, den lokalen PostgreSQL-18-Lauf und den
   Suchnachweis „null Supabase-Treffer“ aus und berichtet Kommando, Exit-Code
   und Originalausgabe. Dieses Profil arbeitet an versionierten Projektdateien
   strikt read-only, ausdrücklich einschließlich Testdateien. Hält es eine
   Änderung an einer Testdatei für nötig, meldet es das als Befund an dich und
   ändert nichts selbst. Du delegierst eine solche Teständerung anschließend als
   getrennten, sequenziellen Schreibauftrag an `kb-implementierung`. Eine
   Shell-Umleitung (`>`, `>>`, `tee`, `Set-Content`, `Add-Content`, `Out-File`,
   Heredoc) ist kein Ersatz für die bei diesem Profil fehlenden Werkzeuge `Edit`
   und `Write`.
5. **Sicherheitsprüfung** – `kb-sicherheit-rls` prüft read-only Auth.js-Sitzung,
   Fail-closed bei fehlender Sitzung und `must_change_password`, RLS,
   Parametrisierung, Allow-Lists, `withUserTransaction`, Atomarität, Rollback
   und Identitätsreste zwischen Aktionen.
6. **Dokumentation** – `kb-dokumentation` aktualisiert ausschließlich
   `PROJEKT_WISSEN.md` knapp mit bestätigten Ergebnissen.

Verbindliche Ausführungsregeln für diesen Auftrag:

- **Ein einzelner Schreibagent je Teilpaket**, und schreibende Teilpakete
  strikt sequenziell. Niemals zwei Schreibagents gleichzeitig.
- `kb-sicherheit-rls` und die Analyseanteile prüfen **unabhängig und read-only**;
  sie dürfen parallel zueinander laufen, aber sie ändern nichts.
- Sicherheitsbefunde gehen nicht direkt an den Implementierungsagenten. Du
  bewertest sie und erteilst daraus einen neuen, abgegrenzten Schreibauftrag.
- Du prüfst jedes Agentenergebnis und den vollständigen Gesamt-Diff selbst,
  bevor du übergibst. Ein Agentenbericht ist ohne deine Prüfung kein Nachweis.
- Bei dreimal demselben Fehler in derselben Teilaufgabe: Circuit Breaker,
  stoppen und mit Rohbefund an Codex melden.
- Kein Agent erweitert seinen Scope. Kein Agent startet weitere Agents.

## Übergabe und Stopppunkt

`PROJEKT_WISSEN.md` nur knapp mit bestätigten Ergebnissen aktualisieren; keine
neue Übersicht anlegen. Nicht committen, pushen oder mergen. Übergabe mit
geänderten Dateien, Verhalten, exakten Prüfergebnissen, Risiken und vollständigem
Git-Status. Bei Architekturkonflikt oder fehlendem Zugriff anhalten; keinen
Ersatzpfad, Clone oder Supabase-Zwischenweg anlegen.
