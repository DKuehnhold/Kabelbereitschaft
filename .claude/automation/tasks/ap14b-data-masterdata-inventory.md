# AP14B Datenmigration 2 – Stammdaten und Inventar

## Ziel und Ausgangspunkt

Ersetze die verbliebenen Supabase-Datenzugriffe für **Stammdaten und Inventar**
durch den bereits verifizierten PostgreSQL-/Auth.js-Pfad gemäß ADR-011.
Arbeite ausschließlich im bestehenden Vault. Lies vor Beginn vollständig
`AGENTS.md`, `CLAUDE.md`, `PROJEKT_WISSEN.md`, `PROJEKTSTATUS.md`,
`00-Projektsteuerung/ROADMAP_AP12_AP15_ENTWURF.md`,
`00-Projektsteuerung/ADR-011-postgres-eigenplattform.md`, die operative Datei
`.claude/automation/status/fortschritt.json` und diese Aufgabenbeschreibung.

Du arbeitest als alleiniger ausführender **Claude-Orchestrator** und steuerst
deine spezialisierten Claude-Agents nach `AGENTS.md`. Codex setzt nur den
Architekturrahmen und prüft nach deiner Abschlussübergabe unabhängig.

## Startvorbedingungen

Starte nur, wenn alle Punkte erfüllt sind:

- `HEAD`, lokales `main` und `origin/main` sind deckungsgleich;
- der Arbeitsbaum und der Index sind sauber;
- `.claude/automation/runtime/state.json` weist keinen Lauf mit
  `status = "running"` aus;
- `run-orchestrator.ps1 -CheckOnly` liefert Exit-Code 0;
- keine `index.lock` oder `HEAD.lock` liegt im Repository.

Bei einer Abweichung sofort anhalten und den Rohbefund an Codex melden. Keine
Bereinigung, kein Restore, Reset, Stash, Clone oder Ersatzpfad. Lege erst nach
erfüllter Vorbedingung den Branch
`feat/ap14b-data-masterdata-inventory` aus dem aktuellen `main` an. Existiert
der Branch bereits, halte an und überschreibe ihn nicht.

## Positivliste des Gesamtauftrags

Fachlich zu migrieren sind ausschließlich:

- `app/src/lib/masterdata.ts`
- `app/src/lib/masterdata-actions.ts`
- `app/src/lib/inventory.ts`
- `app/src/lib/inventory-actions.ts`

Zusätzlich zulässig, soweit unmittelbar erforderlich:

- kleine serverseitige Hilfsmodule unter `app/src/lib/`, bevorzugt Wiederverwendung
  von `app/src/lib/db/index.ts`, `app/src/lib/db/pg-errors.ts` und den bereits
  vorhandenen Auth.js-Sitzungshelfern;
- genau eine additive/idempotente Migration `0015_*` für die minimale
  `app_user`-Rechtematrix bzw. zwingend erforderliche PostgreSQL-Anpassungen;
- neue oder angepasste SQL-Smokes und Node-Integrationstests für diesen Scope;
- die bestehenden lokalen DB-Test-Runner nur, wenn die neue Migration bzw. der
  neue Smoke sonst nicht ausgeführt würde;
- `PROJEKT_WISSEN.md` erst am Ende und nur mit bestätigten Ergebnissen;
- `.claude/automation/status/fortschritt.json` gemäß Staffelstab-Regel.

## Negativliste

- Keine sichtbare GUI-, Layout-, Styling-, Text-, Navigations- oder
  Interaktionsänderung.
- Keine Änderung an Bilder-, Galerie- oder Uploadpfaden; insbesondere nicht
  `image-actions.ts`, `image-upload-core.ts`, `images-server.ts` oder
  `app/api/images/upload/route.ts`.
- Kein MinIO in diesem Paket.
- Supabase-Clientdateien und Supabase-Pakete noch nicht entfernen: der
  Bild-/Upload-Restbestand benötigt sie bis zum Folgepaket.
- Keine Änderung der fachlichen RLS-Sichtbarkeitsregeln, Rollen, Audit- oder
  Chroniksemantik; keine neue SECURITY-DEFINER-Abkürzung.
- Kein Service-Role-, Superuser- oder `BYPASSRLS`-Pfad.
- Keine echten Personen-, Lager-, GPS-, EXIF- oder IT-Zugangsdaten.
- Keine ManagementOS-Datei, kein Branding, kein V1-, RC1-, Tag- oder
  Release-Schritt.
- Kein Commit, Push, Merge, Rebase, Tag oder Release durch Claude oder Agents.

## Architekturanforderungen

1. In allen vier Zieldateien verbleiben weder Supabase-Importe noch
   `supabase.`-Zugriffe.
2. Jeder fachliche Datenbankzugriff läuft über `withUserTransaction`; kein
   rohes `pg`, kein neuer Pool und kein `withAuthTransaction` für Fachdaten.
3. Die Benutzer-ID stammt ausschließlich aus der serverseitig validierten
   Auth.js-Sitzung. Fehlende Sitzung und `must_change_password` bleiben
   fail-closed.
4. SQL ist parametrisiert. Dynamische Sortierung oder Filterung ist nur über
   feste Allow-Lists zulässig; keine Interpolation von Benutzerwerten.
5. Mehrschrittige Operationen sind atomar in genau einer Transaktion, besonders
   Kontakte mit Telefonnummern/Bauabschnittszuordnung und Teams mit
   Mitgliedschaften. Fehler dürfen keinen Teilstand hinterlassen.
6. Bestehende Validierungen, Rückgabewerte, Revalidation-Ziele, Aktiv/Inaktiv-
   Verhalten und sichtbare Fehlermeldungssemantik bleiben kompatibel.
7. Inventarbewegungen respektieren weiterhin Einheit, Positivmengen,
   Bestandswächter, unveränderbare Chronik, Audit und die bestehenden
   Entnahme-/Rückgabe-/Verbrauchsregeln.
8. RLS bleibt führend. Migration `0015` vergibt an `app_user` nur die für
   diesen Scope notwendigen Tabellen-/Sequenz-/Funktionsrechte, widerruft
   Alt- oder Pauschalrechte falls erforderlich und enthält fail-closed
   Positiv- und Negativprüfungen. Keine Grants an `public`, `anon` oder
   `authenticated`.
9. Bestehende Tabellen, Policies, Views, Trigger und Funktionen werden
   bevorzugt wiederverwendet. Eine fachliche Schemaänderung ist nur additiv,
   idempotent und mit begründetem Nachweis zulässig.
10. Profile-/Techniker-/Team-Lookups dürfen keine zusätzlichen personenbezogenen
    Spalten offenlegen. Der Monteur erhält keinen neuen Stammdaten- oder
    Inventarzugriff.

## Verbindliche Agentenverträge

Claude zerlegt mindestens in folgende Teilpakete und versieht jedes mit eigener
Positivliste, Negativliste, Definition of Done und Stopppunkt:

1. **Read-only Bestands- und Sicherheitsanalyse** – `kb-sicherheit-rls` prüft
   vorhandene Tabellen, Policies, Trigger, Funktionen und Rechte für
   Stammdaten/Inventar und benennt die minimale Rechtematrix. Keine Änderung.
2. **Stammdaten-Implementierung** – `kb-implementierung`, Positivliste nur
   `masterdata.ts`, `masterdata-actions.ts` und unmittelbar freigegebene
   Hilfsmodule. Schreibend allein und abgeschlossen vor dem nächsten
   Schreibpaket.
3. **Inventar-Implementierung** – `kb-implementierung`, Positivliste nur
   `inventory.ts`, `inventory-actions.ts` und unmittelbar freigegebene
   Hilfsmodule. Schreibend allein.
4. **Migration und Tests** – notwendige versionierte Test-/SQL-Änderungen durch
   `kb-implementierung` als eigenes sequenzielles Schreibpaket.
5. **Tests/Evidence** – `kb-tests-evidence` strikt read-only gegenüber
   versionierten Dateien; meldet Kommando, Exit-Code und Originalergebnis. Eine
   nötige Testdateiänderung wird nur als Befund an Claude gemeldet und danach
   separat durch `kb-implementierung` ausgeführt.
6. **Abschließendes Sicherheitsreview** – `kb-sicherheit-rls` read-only auf
   Gesamtdiff, Auth.js, RLS, Rechte, Parametrisierung, Atomarität, Datenleckage
   und Fail-closed-Verhalten.
7. **Dokumentation** – `kb-dokumentation` darf erst nach grünen Nachweisen
   ausschließlich `PROJEKT_WISSEN.md` knapp aktualisieren.

Schreibende Teilpakete laufen strikt sequenziell. Kein Agent startet Agents
oder kommuniziert direkt mit anderen Agents. Befunde laufen immer über Claude.
Nach dreimal demselben Fehler gilt der Circuit Breaker.

## Definition of Done und Nachweise

Claude muss selbst den Gesamt-Diff prüfen und folgende echte Nachweise liefern:

- Suchnachweis: null Supabase-Importe und null `supabase.`-Zugriffe in den vier
  Zieldateien;
- TypeScript, ESLint, komplette Einheitentests und Produktions-Build jeweils
  Exit-Code 0;
- vollständiger lokaler PostgreSQL-18-Lauf mit Migrationen `0001`–`0015`, allen
  bisherigen Smokes und dem neuen Smoke;
- Integrationstests unter nicht privilegiertem `app_user` mit aktiver RLS für
  Admin, Disposition, zugewiesenen/fremden Monteur, soweit fachlich relevant;
- CRUD/Aktivierung für Bereitschaftsnummern, Kunden, Bauabschnitte, VzG-Strecken,
  Kontakte mit Telefonen/Zuweisungen, Techniker, Teams/Mitglieder, Kabeltypen
  und Anwendungseinstellungen;
- Inventar: Material/Lagerort, Bestandsliste, Bewegungsverlauf und alle
  Bewegungsarten einschließlich Negativmenge, falscher Einheit, unzureichendem
  Bestand, unzulässiger Rolle und Rollback bei einem Fehler nach dem ersten
  Teilschritt;
- Nachweis, dass Audit/Chronik unverändert funktionieren und Monteure keine
  neuen Daten sehen oder schreiben können;
- `git diff --check` Exit-Code 0 und vollständiger `git status`;
- temporäre Datenbanken, Server, Ports und Protokolle am Laufende entfernt;
  der vorhandene PostgreSQL-Dienst bleibt unverändert.

Browser-E2E sind nur erneut erforderlich, wenn der tatsächliche Diff eine von
ihnen berührte Route oder Laufzeitabhängigkeit verändert. Wird nicht gelaufen,
ist das ausdrücklich mit dieser Scope-Begründung zu melden, nicht als Erfolg.

## Stopppunkt und Übergabe

Sofort anhalten bei sichtbarer GUI-/Designentscheidung, zwingend fehlendem
IT-Zugang, Architekturkonflikt, Scope-Erweiterung in Bilder/MinIO, V1-Frage,
echtem Sicherheitsblocker, aktivem zweiten Schreiber oder Circuit Breaker.
Keinen Ersatzpfad, Clone, Supabase-Zwischenweg oder fremden Dienst anlegen.

Abschlussübergabe an Codex enthält:

1. alle geänderten Dateien,
2. umgesetztes Verhalten,
3. eingesetzte Agentenprofile und Teil-Scopes,
4. exakte Prüfungen mit Exit-Codes/Ergebnissen,
5. offene Risiken oder Blocker,
6. vollständigen Git-Status,
7. ausdrücklich: kein Commit und kein Push.

