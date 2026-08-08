# AP15-3 Korrektur — Migrationswahrheit und kompakter Abschluss

## Ausgangslage

Der Lauf `kb-ap15-3-runtime-ci-truth` endete nach den Änderungen mit Exitcode 1, weil der Claude-
API-Endpunkt nicht mehr aufgelöst werden konnte (`ENOTFOUND`). Codex hat den entstandenen Diff
vollständig geprüft und die technischen Nachweise unabhängig wiederholt: 97/97 Unit-Tests,
TypeScript, ESLint, Produktions-Build und `git diff --check` jeweils Exit 0. Der Arbeitsstand darf
trotzdem noch nicht freigegeben werden, weil `deploy/README.md` weiterhin pauschal behauptet, die
Migrationskette sei „additiv und idempotent“. Das widerspricht dem bereits dokumentierten Befund,
dass insbesondere `0013_ap14b_drop_supabase_compat.sql` einen bewussten Abbau des Altpfads enthält.
Außerdem ist der neue AP15-3-Abschnitt in `PROJEKT_WISSEN.md` für die verbindlich knappe Übersicht
zu ausführlich und enthält vergängliche Zeilennummern und Werkzeugdetails.

## Positivliste

Änderungen ausschließlich an:

1. `deploy/README.md`
2. `PROJEKT_WISSEN.md`
3. `PROJEKTSTATUS.md`
4. `.claude/automation/status/fortschritt.json` (gitignorierte operative Statusdatei)

Die beiden AP15-3-Taskdateien dürfen als Auftragsnachweis bestehen bleiben.

## Negativliste

- Keine Änderung an `.github/workflows/ci.yml`, `app/.env.example`, Produktcode, Tests, SQL,
  Migrationen, Runnern, Compose, Dockerfile oder Deploy-Skripten.
- Keine neue fachliche Aussage, kein Scope-Ausbau zu Integrationssuiten oder historischen Smokes.
- Keine GUI-/Designänderung, keine echten IT-Daten, keine externen Dienste.
- Keine Archivierung, Umbenennung, Verschiebung oder Löschung.
- `07-Betrieb/IT_ANFRAGE_INFRASTRUKTUR.md` weder lesen noch ändern noch versionieren.
- Kein Commit, Push, Merge, Tag oder Release; kein Agent startet weitere Agents.

## Auftrag

1. Ersetze in `deploy/README.md` die pauschale Aussage „additiv und idempotent“ durch eine exakt
   belegte Formulierung: 17 versionierte Migrationen `0001`–`0017`, Anwendung strikt in der
   vorgesehenen Reihenfolge; keine Behauptung allgemeiner Additivität oder Idempotenz. Prüfe, ob
   dieselbe falsche Pauschalaussage im neuen AP15-3-Diff noch an anderer Stelle steht, und ändere
   sie innerhalb der Positivliste nur dort, wo sie als aktuelle Behauptung erscheint.
2. Kürze ausschließlich den neu eingefügten AP15-3-Abschnitt in `PROJEKT_WISSEN.md` deutlich.
   Behalte: Umfang, drei Sachänderungen, echte lokale Nachweise, CI noch offen, klare Betriebs-
   grenzen. Entferne: Quellzeilennummern, wiederholte Begründungen, Werkzeugpfad-Details,
   Parser-Inventar und alles, was bereits in `deploy/README.md` steht. Ziel ist eine kompakte
   dauerhafte Übersicht, keine zweite Beweisakte.
3. Halte `PROJEKTSTATUS.md` ebenfalls knapp und konsistent. Vermerke korrekt, dass der erste
   Orchestratorlauf technisch mit `ENOTFOUND`/Exit 1 endete und dieser begrenzte Korrekturlauf den
   Abschlussnachweis liefert. Keine grüne GitHub-CI behaupten; die folgt erst nach Codex-Push.
4. Aktualisiere die operative Statusdatei auf die korrigierte Übergabe an Codex.

## Definition of Done

- `deploy/README.md` enthält im aktuellen Migrationsabschnitt weder „additiv und idempotent“ noch
  eine gleichartige Pauschalbehauptung; `0001`–`0017` und feste Reihenfolge sind korrekt.
- Der AP15-3-Abschnitt in `PROJEKT_WISSEN.md` ist substanziell kürzer als der vorgefundene Abschnitt
  und enthält keine vergänglichen Quellzeilennummern oder lokale Werkzeug-Inventur.
- `PROJEKTSTATUS.md` und `PROJEKT_WISSEN.md` behaupten keine GitHub-CI für AP15-3.
- Vollständiger Diff bleibt auf die ursprünglichen fünf AP15-3-Dateien plus Taskdateien begrenzt.
- Claude führt selbst nach der Korrektur aus und berichtet Exitcodes: Unit-Tests, TypeScript über
  direkten Node-Aufruf, ESLint über direkten Node-Aufruf, Produktions-Build über direkten Node-
  Aufruf, `git diff --check`. Direkte Node-Aufrufe sind wegen des belegten `&`-Pfadproblems der
  npm-`.bin`-Shims ausdrücklich zulässig; `npm run test:unit` bleibt direkt lauffähig.
- Git-Status vor und nach den Prüfungen, keine verbliebenen temporären Artefakte.

## Stopppunkt

Stoppe sofort mit Rohbefund, wenn eine Änderung außerhalb der Positivliste nötig wäre, ein zweiter
Schreiber aktiv ist, der Arbeitsstand nicht dem beschriebenen AP15-3-Diff entspricht oder derselbe
Fehler dreimal auftritt. Scope nicht erweitern.

## Agentenvertrag und Evidence

Claude erzwingt für jeden eingesetzten Agenten Positivliste, Negativliste, DoD, Stopppunkt und
konkrete Evidence. Höchstens ein Schreibagent gleichzeitig. Claude prüft anschließend selbst den
vollständigen Gesamtdiff und alle Nachweise. Kein Agent und Claude selbst führen Git-Schreib- oder
Releaseaktionen aus.
