# Korrekturauftrag: AP14B Benutzerverwaltung - zentrale SQL-Schranke haerten

## Ausgangslage

Das Architektur-Gate des Laufs `kb-ap14b-admin-user-management-security-correction` bleibt wegen
H1 sowie M1/M3 geschlossen. Bearbeite nur diese Befunde auf
`feat/ap14b-admin-user-management`; alle bisherigen gruenen Funktionen und Tests bleiben erhalten.
Die ungetrackte Datei `07-Betrieb/IT_ANFRAGE_INFRASTRUKTUR.md` bleibt unangetastet.

## H1 - Identitaet ueber SQL-Ausdruck faelschbar

`app/src/lib/db/statement-guard.ts` blockiert nur fuehrende Kontrollanweisungen. Dadurch kann eine
fachliche Einzelanweisung wie `select set_config('app.user_id', ...)` die transaktionslokale
Identitaet setzen und den neuen Datenbankwaechter umgehen.

Haerte die zentrale Schranke so, dass fachliche Abfragen keine Sitzungs-/Transaktionsumgebung und
insbesondere weder `app.user_id` noch Timeout-/Rollenparameter ueber Funktionsaufrufe, CTEs,
Schemaqualifikation, quoted identifiers, Kommentare, Gross-/Kleinschreibung oder mehrere
Anweisungen manipulieren koennen. Die internen Wrapper-Aufrufe zum Setzen der drei Parameter
laufen weiterhin direkt ueber den rohen Client und muessen funktionieren. Kein unzuverlaessiger
Substring-Check, der Literale oder Kommentare falsch positiv wertet; implementiere eine kleine,
klar begrenzte lexikalische Pruefung oder eine nachweislich gleich starke Loesung.

Pruefe auch alternative in PostgreSQL vorhandene Wege (`set_config`, `SET`/`RESET`, qualifizierte
und gequotete Namen, CTE/Unterabfrage, Mehrfachanweisung). Falls ein semantisch gleichwertiger Weg
ohne das Token `set_config` verbleibt, muss er geschlossen oder als echter Blocker gemeldet werden.

## M1 - manipulierbare Sperrzaehler

`failed_attempts` und `locked_until` koennen ohne aussagekraeftigen Audit-/Waechtervertrag
veraendert werden. Haerte innerhalb der bestehenden Architektur fail-closed:

- Normale Fehlversuchszaehlung, zeitweilige Sperre, abgelaufene Sperre und erfolgreicher Login
  bleiben funktionsfaehig.
- Beliebige Bulk-/Fremdaenderungen duerfen nicht unbemerkt alle Administratoren aussperren.
- Relevante Sperr-/Entsperruebergaenge sind geheimnisfrei auditierbar oder anderweitig maschinell
  verhindert.
- Der Schutz des letzten nutzbaren Administrators darf nicht durch direkte SQL-Aenderung dieser
  Spalten still umgangen werden. Wenn sich dies mit der beschlossenen Brute-Force-Sperre logisch
  widerspricht, stoppe mit einer konkreten Architekturvorlage statt eine Scheinloesung zu bauen.

## M3 - Laufzeitrolle nur als Kommentar

Die Sicherheitsannahme, dass die Anmelderolle weder Superuser noch Mitglied der Eigentümerrolle
ist, muss in den bestehenden Bootstrap-/Start-/CI-Pruefungen maschinell fail-closed belegt werden.
Keine echten IT-Namen oder Zugangsdaten. Ergaenze nur den kleinsten geeigneten vorhandenen
Preflight/Smoke; Dokumentation nur, wenn fuer den nachweisbaren Betriebsvertrag zwingend noetig.

## Positivliste

- `app/src/lib/db/statement-guard.ts`
- `app/src/lib/db/index.ts` nur falls fuer eine saubere Trennung intern/fachlich erforderlich
- `app/test/ap14b-auth.test.mjs`
- `app/test/integration/ap14b-platform.int.mjs`
- bestehende Dateien aus dem laufenden AP14B-Benutzerverwaltungs-Diff
- `app/supabase/bootstrap/` nur fuer additive, wiederholbare Rollen-/Preflightpruefung; keine
  Aufweichung bestehender Rechte
- `.github/workflows/ci.yml` und vorhandene Test-Runner nur fuer Nachweisaufnahme
- `deploy/README.md` nur falls M3 sonst nicht wahrheitsgemaess dokumentierbar ist
- diese Auftragsdatei und gitignorierter Dashboardstatus

## Negativliste

- Keine GUI, Route, Komponente, CSS oder Designentscheidung.
- Keine Aenderung an Migrationen `0001` bis `0016`; `0017` darf fortgeschrieben werden.
- Keine neue Rolle im Fachmodell, keine Kontoanlage, kein SMTP/Passwort-vergessen.
- Keine Geheimnisse, keine Bearbeitung von `07-Betrieb/IT_ANFRAGE_INFRASTRUKTUR.md`.
- Kein Commit, Push, Merge, Tag, Release oder Branchwechsel.

## Nachweise / Definition of Done

1. Adversariale Unit- und echte PostgreSQL-Integrationstests fuer alle genannten Umgehungsformen;
   erlaubte SQL mit gleichlautenden Literalen/Kommentaren muss weiter funktionieren.
2. Gesamtlauf PostgreSQL 18 mit `0001` bis `0017`, allen Smokes und vier Integrationssuiten;
   exakte Mengen, Exitcodes und komplette Bereinigung.
3. TypeScript, ESLint, alle Unit-Tests, Produktions-Build, `git diff --check`, Geheimnissuche,
   Scope-Abgleich.
4. `kb-sicherheit-rls` prueft adversarial. Kein offener hoher oder mittlerer Befund in diesem
   Arbeitspaket; bei unloesbarem Zielkonflikt echte Stopmeldung statt Herabstufung.
5. CI-Strecke bleibt fail-closed und fuehrt den Admin-Integrationstest im Pflichtmodus aus.

## Stopppunkt

Nach bestandener Orchestratorpruefung mit laufbezogenem `resultFile`/`errorFile`, Gesamt-Diff und
Rohnachweisen an Codex uebergeben. Bei dreimal demselben Fehler oder echtem Architekturkonflikt
stoppen. Nichts committen oder pushen.
