# Korrekturauftrag: AP14B Benutzerverwaltung - Datenbankwaechter und CI-Nachweis

## Ausgangslage

Der Lauf `kb-ap14b-admin-user-management-backend` ist technisch abgeschlossen, aber das
Architektur-Gate ist wegen drei konkreter Befunde **nicht bestanden**. Bearbeite ausschliesslich
diese Befunde auf `feat/ap14b-admin-user-management`. Bewahre alle bereits gruene Funktionalitaet.
`07-Betrieb/IT_ANFRAGE_INFRASTRUKTUR.md` bleibt unangetastet und ausserhalb jedes Diffs.

## Befund 1 - physisches Loeschen von Auth-Konten

Migration `0012` erteilte `app_user` tabellenweites `delete` auf `auth_accounts`. Dadurch koennte
Anwendungscode ausserhalb des neuen Moduls ein Konto samt kaskadierender Profildaten loeschen und
den Schutz des letzten aktiven Administrators umgehen.

**Korrektur:** In Migration `0017` das nicht benoetigte `delete`-Recht auf
`public.auth_accounts` fuer `app_user` ausdruecklich entziehen. Fail-closed per Katalogpruefung und
Smoke nachweisen. Kein physisches Kontoloeschen als Produktfunktion einfuehren.

## Befund 2 - Reset und Kontosperre nur durch Anwendungscode geschuetzt

`auth_accounts` ist nicht RLS-geschuetzt. Fuer administrativen Passwort-Reset und Aenderung von
`is_disabled` ist `assertActiveAdmin` derzeit die einzige Berechtigungsschranke.

**Korrektur:** Migration `0017` muss einen zusaetzlichen, race-sicheren Datenbankwaechter erhalten,
der sensible administrative Aenderungen auf `auth_accounts` nur erlaubt, wenn
`app.current_user_id()` in derselben Transaktion als aktiver, nicht deaktivierter Administrator
aus der Datenbank bestaetigt ist. Dabei verbindlich:

- normaler Loginbetrieb (Fehlversuchszaehler, Sperrzeit, `last_login_at`, parameterbedingtes
  Hash-Rehash ohne echten Passwortwechsel) bleibt funktionsfaehig;
- eigener echter Passwortwechsel bleibt fuer das betroffene aktive Konto erlaubt;
- administrativer Reset und Wechsel von `is_disabled` erfordern aktive Adminrolle;
- keine Rolle aus Parametern oder JWT; keine stillen NULL-/unbekannt-Faelle;
- Schutz des letzten aktiven Administrators bleibt wirksam;
- direkte SQL-Gegenproben unter `app_user` fuer Disponent, Monteur, deaktivierten/inaktiven Admin,
  fehlende Identitaet und gueltigen Admin;
- Audit und komplette Transaktion rollen bei Verweigerung zurueck.

Pruefe zugleich, ob der bestehende Rollenwaechter auf `profiles.role` denselben Datenbankvertrag
bereits vollstaendig erfuellt. Falls nicht, haerte ihn innerhalb `0017` gleichartig; keine
historische Migration aendern.

## Befund 3 - neuer Integrationstest laeuft nicht in GitHub CI

Der Test `app/test/integration/ap14b-admin-users.int.mjs` wird lokal ausgefuehrt, aber der CI-Job
`database` ruft derzeit nur SQL-Smokes auf.

**Korrektur:** Binde genau diesen Test fail-closed in den bestehenden PostgreSQL-18-CI-Job ein.
Er darf bei fehlenden Verbindungsvariablen in CI nicht still uebersprungen werden. Nutze nur
synthetische CI-Werte und vorhandene Rollen/Bootstrapmechanismen. Aktualisiere den veralteten
Schrittnamen `0001-0016` auf `0001-0017`. Keine neue Pipeline und kein externer Dienst.

## Positivliste

- `app/supabase/migrations/0017_ap14b_admin_user_management.sql`
- `app/supabase/test/23_ap14b_admin_users.sql`
- `app/src/lib/admin-users.ts` nur falls fuer den DB-Vertrag zwingend erforderlich
- `app/test/integration/ap14b-admin-users.int.mjs`
- `app/supabase/test/run_ap14b_local.ps1`
- `app/supabase/test/run_db_tests.sh`
- `.github/workflows/ci.yml`
- die beiden Auftragsdateien unter `.claude/automation/tasks/`
- gitignorierter Dashboardstatus nach Schema

## Negativliste

- Keine GUI, Route, Komponente, CSS, Navigation oder sichtbare Designentscheidung.
- Keine Aenderung an Migrationen `0001` bis `0016`.
- Keine Dokumentationsfortschreibung, Kontoanlage, SMTP/Passwort-vergessen-Funktion oder neue Rolle.
- Keine Geheimnisse in Code, SQL, Log, Audit oder Rueckgabe.
- Keine Bearbeitung von `07-Betrieb/IT_ANFRAGE_INFRASTRUKTUR.md`.
- Kein Commit, Push, Merge, Tag, Release oder Branchwechsel.

## Erforderliche Nachweise / Definition of Done

1. Vollstaendiger lokaler PostgreSQL-18-Gesamtlauf mit `0001` bis `0017`, allen Smokes und allen
   vier Integrationssuiten; exakte Mengen und Exitcode.
2. Neue negative SQL- und Integrationstests fuer beide Sicherheitsbefunde, einschliesslich
   Rollback/Audit und unveraendert funktionsfaehigem Login/Rehash/eigenem Passwortwechsel.
3. Linux-Runner fuehrt den Admin-Integrationstest nachweislich aus; statische CI-Pruefung reicht
   nicht. Wenn eine lokale Linux-Ausfuehrung unmoeglich ist, exakt melden und die CI-Ausfuehrung
   nach dem spaeteren Push als offenes Gate markieren.
4. TypeScript, ESLint, alle Unit-Tests, Produktions-Build, `git diff --check`, Geheimnissuche,
   Scope-Abgleich und vollstaendige Bereinigung temporaerer Artefakte.
5. Unabhaengiges adversariales Review durch `kb-sicherheit-rls`; kein offener Befund hoher oder
   mittlerer Prioritaet in diesem Scope.

## Stopppunkt

Danach ueber laufbezogenes `resultFile`/`errorFile`, vollständigen Diff, Tests und Git-Status an
Codex uebergeben. Bei erneutem Sicherheitskonflikt, Scope-Erweiterung oder dreimal gleichem Fehler
stoppen. Nichts committen oder pushen.
