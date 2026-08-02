# Fortsetzungsauftrag: Guard-Haertung abschliessen und vollstaendig nachweisen

## Ausgangslage

Der Lauf `kb-ap14b-admin-user-management-guard-hardening` wurde durch das interne
600-Sekunden-Wartelimit beendet, waehrend Hintergrundaufgaben noch liefen. Seine Ausgabe ist
**kein Abschlussnachweis**. Im Arbeitsbaum liegen Teiländerungen an `statement-guard.ts` und den
Unit-Tests. Bewerte und uebernimm sie nur, wenn sie korrekt, minimal und vollstaendig sind; keine
blinde Fortsetzung einer Agentenaussage.

Arbeite auf `feat/ap14b-admin-user-management`. Die fremde ungetrackte Datei
`07-Betrieb/IT_ANFRAGE_INFRASTRUKTUR.md` bleibt unangetastet und ausserhalb jedes Diffs.

## Verbindlicher Restumfang

1. **H1 abschliessen:** Vollstaendigen Diff von `statement-guard.ts` selbst reviewen. Die Schranke
   muss Manipulation der Sitzungs-/Transaktionsumgebung ueber `set_config`, Schemaqualifikation,
   quoted identifiers, CTE/Unterabfrage, Kommentare, Gross-/Kleinschreibung und
   Mehrfachanweisungen blockieren, ohne Literale/Kommentare falsch positiv zu behandeln. Interne
   Wrapper-Initialisierung muss funktionieren. Ueberdimensionierte oder unbelegte Parserlogik
   vereinfachen.
2. **M1 abschliessen:** Einen mit dem realen Loginablauf konsistenten Vertrag fuer
   `failed_attempts`/`locked_until` implementieren und testen. Smoke U26a ist derzeit unrealistisch
   (`failed_attempts = 1` mit sofortiger 5-Minuten-Sperre); korrigiere ihn auf die echte Semantik
   aus `auth-service.ts`. Brute-Force-Schutz nicht abschwaechen. Sperr-/Entsperrereignisse muessen
   geheimnisfrei nachvollziehbar sein; direkte unplausible Zustandskombinationen und stilles
   Massenaussperren sind fail-closed zu verhindern. Bei einem echten Zielkonflikt stoppen und eine
   klare Architekturentscheidung vorlegen.
3. **M3 abschliessen:** Produktive/CI-Laufzeitrolle maschinell fail-closed darauf pruefen, dass sie
   weder Superuser noch Mitglied der Eigentümer-/Migrationsrolle ist. Nutze den kleinsten passenden
   bestehenden Bootstrap-, Start- oder CI-Preflight. Keine echten IT-Werte.
4. Den bereits eingebauten Pflichtlauf des Admin-Integrationstests in der CI erhalten und erneut
   pruefen.

## Positivliste

Identisch zum vorigen Härtungsauftrag: `app/src/lib/db/statement-guard.ts`, bei Notwendigkeit
`app/src/lib/db/index.ts`, `app/test/ap14b-auth.test.mjs`,
`app/test/integration/ap14b-platform.int.mjs`, die laufenden Benutzerverwaltungsdateien,
`app/supabase/bootstrap/`, vorhandene Runner, `.github/workflows/ci.yml`, bei zwingender
Notwendigkeit `deploy/README.md`, diese Auftragsdatei und gitignorierter Dashboardstatus.

## Negativliste

Keine GUI/Route/Komponente/CSS, keine Aenderung Migration `0001`-`0016`, keine neue Fachrolle,
Kontoanlage oder SMTP, keine Geheimnisse, keine Bearbeitung der IT-Anfragedatei, kein Commit,
Push, Merge, Tag, Release oder Branchwechsel.

## Definition of Done

- Kein offener hoher oder mittlerer Sicherheitsbefund in diesem Scope nach unabhaengigem
  `kb-sicherheit-rls`-Review.
- Vollstaendiger PostgreSQL-18-Gesamtlauf `0001`-`0017`, alle Smokes und vier Integrationssuiten
  mit exakten Mengen und Exitcode; CI-nahe Bash-Strecke im Pflichtmodus.
- TypeScript, ESLint, alle Unit-Tests, Produktions-Build, `git diff --check`, YAML/Bash-Pruefung,
  Geheimnissuche und Scope-Abgleich gruen.
- Temporaere Datenbanken, Rollen, Cluster, Prozesse, Ports und Logs vollstaendig entfernt.
- Laufbezogenes `resultFile` enthaelt eine echte Gesamtuebergabe, nicht nur eine Zwischenmeldung;
  `errorFile` vollstaendig ausgewertet.

## Stopppunkt

Bei dreimal demselben Fehler oder echtem Zielkonflikt stoppen. Sonst erst nach kompletter
Orchestratorpruefung an Codex uebergeben. Nichts committen oder pushen.
