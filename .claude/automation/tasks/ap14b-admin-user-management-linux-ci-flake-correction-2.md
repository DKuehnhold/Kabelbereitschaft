# Architekturauftrag: AP14B Benutzerverwaltung - Linux-CI V24 zweiter fail-closed-Ausgang

## Ausgangslage

PR #6, Commit `6f294479b213bc27ef6e302ddb1f4ed2851f12ab`, CI-Lauf
`30733682274`: `objectstore` erfolgreich, Job `database` scheitert erneut nur in
V24. Erhalten wurde `abgewiesen:Error | erfuellt:changed`.

Nach dem bereits akzeptierten RLS-Leseverlust besteht ein zweiter, spaeterer
fail-closed-Ausgang: Der unterlegene Aufruf kann nach bestandener
`assertActiveAdmin`-Pruefung und Zielprofil-Lektuere die Schreibsicht verlieren,
wenn die konkurrierende Selbstherabstufung vorher festschreibt. Das RLS-
geschuetzte `update public.profiles ... returning id` trifft dann null Zeilen;
`app/src/lib/admin-users.ts` wirft exakt
`Rollenwechsel: das Profil wurde nicht geaendert.`

## Positivliste

- `app/test/integration/ap14b-admin-users.int.mjs`
- ignorierte temporaere Testartefakte, am Ende vollstaendig entfernen

## Negativliste

- kein Produktionscode, keine Migration, kein Smoke, kein Runner, keine CI-Datei
- keine anderen Tests oder Dokumente
- keine GUI, Route oder Server Action
- keine Agents oder Hintergrundaufgaben
- kein Commit, Push, Merge, Tag oder Release
- `07-Betrieb/IT_ANFRAGE_INFRASTRUKTUR.md` weder oeffnen noch aendern

## Auftrag

1. Dokumentiere in V24 den fuenften legitimen fail-closed-Ausgang: RLS-
   Schreibsichtverlust nach bereits erfolgreicher Zielprofil-Lektuere.
2. Akzeptiere beim unterlegenen Aufruf zusaetzlich nur einen verworfenen
   `Error`, dessen Meldung EXAKT
   `Rollenwechsel: das Profil wurde nicht geaendert.` lautet.
3. Akzeptiere keinesfalls pauschal jeden `Error`.
4. Unveraendert zwingend: genau ein `changed`; danach genau ein aktiver
   Administrator; beide Adminrollen im `finally` wiederherstellen.
5. Fuehre den Admin-Integrationstest mindestens 20-mal gegen temporaeres
   PostgreSQL 18 aus und danach den vollstaendigen PostgreSQL-Gesamtlauf sowie
   TypeScript, ESLint, 84/84 Unit, Build und `git diff --check`.

## Definition of Done

- Ein-Datei-Diff in der Positivliste.
- Exakte Fehlermeldung statt pauschaler Error-Akzeptanz.
- Sicherheitsinvarianten unveraendert.
- Alle echten Nachweise gruen und alle temporaeren Artefakte entfernt.
- Laufbezogene Uebergabe ueber `state.json`, `resultFile`, `errorFile`.

## Stopppunkt

Nach Korrektur und Nachweisen an Codex uebergeben. Bei Scopebedarf ausserhalb
der Positivliste sofort ohne Aenderung stoppen.
