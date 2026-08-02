# Architekturauftrag: AP14B Benutzerverwaltung - Linux-CI-Paralleltest korrigieren

## Ausgangslage

Commit `47c05217fb52e98844ea74610dc9ecc486358701` ist auf
`feat/ap14b-admin-user-management` gepusht und in Pull Request #6. Der echte
Linux-CI-Lauf `30733048345` hat im Job `database` genau einen Fehler geliefert:

- Test V24 in `app/test/integration/ap14b-admin-users.int.mjs`
- erhalten: `erfuellt:not_found | erfuellt:changed`
- erwartet waren bislang nur `last_admin` oder `AdminActionDeniedError` fuer den
  unterlegenen Aufruf.

Die Ursache ist ein zulaessiger fail-closed-Wettlaufausgang: gewinnt die
Selbstherabstufung von ADMIN_A, kann der andere Aufruf seine Adminpruefung noch
vorher bestanden haben, danach aber beim RLS-geschuetzten Lesen des Zielprofils
keine Zeile mehr sehen und deshalb `not_found` liefern. Die tragende Invariante
bleibt: genau eine Herabstufung gelingt und genau ein aktiver Administrator
bleibt uebrig.

## Positivliste

- `app/test/integration/ap14b-admin-users.int.mjs`
- falls fuer den Testlauf zwingend noetig: ausschliesslich ignorierte temporaere
  Laufartefakte, am Ende vollstaendig entfernen

## Negativliste

- kein Produktionscode
- keine Migration, kein Smoke, kein Runner, keine CI-Workflowdatei
- keine Projekt- oder Betriebsdokumentation
- keine Aenderung an anderen Tests
- keine GUI, Route oder Server Action
- kein Commit, Push, Merge, Tag oder Release
- keine Agents und keine Hintergrundaufgaben; Claude bearbeitet diesen kleinen
  Korrekturauftrag selbst
- `07-Betrieb/IT_ANFRAGE_INFRASTRUKTUR.md` weder oeffnen noch aendern

## Technischer Auftrag

1. Praezisiere den Kommentar zu V24 quellentreu um den vierten legitimen
   fail-closed-Ausgang `not_found` durch RLS-Sichtverlust nach konkurrierender
   Selbstherabstufung.
2. Erweitere ausschliesslich die Ergebnisakzeptanz des unterlegenen Aufrufs um
   `fulfilled` mit `kind === "not_found"`.
3. Die eigentlichen Sicherheitszusagen duerfen nicht abgeschwaecht werden:
   genau ein `changed`, danach genau ein aktiver Administrator, beide Rollen im
   `finally` wiederhergestellt.
4. Fuehre den administrativen Integrationstest mehrfach gegen eine temporaere
   lokale PostgreSQL-18-Testumgebung aus, damit beide Wettlaufpfade erfasst
   werden koennen. Fuehre danach mindestens TypeScript, ESLint, 84/84 Unit,
   Produktions-Build, `git diff --check` und den vollstaendigen PostgreSQL-18-
   Gesamtlauf aus. Nur echte Exit-Codes und Mengen berichten.

## Definition of Done

- Diff ausschliesslich in der Positivliste.
- V24 akzeptiert den belegten fail-closed-Ausgang `not_found`, ohne die beiden
  Invarianten abzuschwaechen.
- Mehrfachlauf des Admin-Integrationstests erfolgreich.
- TypeScript, ESLint, Unit, Build, Diff-Check und PostgreSQL-Gesamtlauf
  erfolgreich und mit echter Evidence gemeldet.
- alle temporaeren Artefakte entfernt.
- `result.json`, `stderr.log` und Git-Status enthalten die vollstaendige
  Uebergabe an Codex.

## Stopppunkt

Nach der begrenzten Testkorrektur und den Nachweisen an Codex uebergeben. Bei
jedem Bedarf ausserhalb der Positivliste sofort ohne Aenderung stoppen und den
exakten Grund melden.
