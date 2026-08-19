# Projektwissen – Kabelbereitschaft
> Stand: 2026-08-12 · Nur bestätigte Ergebnisse. Nicht ausgeführte Prüfungen sind als offen markiert.

> **AP15B-Arbeitsbaum (2026-08-12).** Fehlalarm-Markierung, Fehlalarm-Filter,
> Berlin-Datumslogik und Vollmengen-Export sind technisch verdrahtet. Codex hat
> `npm test` unabhängig mit TypeScript, ESLint und **114/114 Unit-Tests** (Exit 0)
> geprüft. Der PostgreSQL-18-/Docker-Nachweis ist in der aktuellen Codex-Umgebung
> offen, weil die Docker-CLI dort nicht verfügbar ist; daher keine RC1-Freigabe
> und keine Behauptung eines neuen grünen DB-/CI-Laufs. Der Arbeitsbaum bleibt
> uncommitted und ungepusht.

> **Aktueller Stand (2026-08-09).** Zielplattform bleibt ADR-011: PostgreSQL 18, Auth.js v5, MinIO
> und Containerbetrieb hinter dem internen Reverse-Proxy; Supabase ist kein Ziel. Bestätigter
> technischer Referenzstand ist `9aaebdf7df0f76b5d80d1e39801e42480ac82b37`
> (`test(ci): gate all postgres integration suites`) auf `main`. AP15-1 berechnet die fünf
> statusbasierten Dashboardkennzahlen jetzt in einer RLS-gebundenen PostgreSQL-Abfrage über
> `public.incident_list_view`; sichtbare Oberfläche, Tageskennzahlen und Listen blieben
> unverändert. Die administrative Benutzerverwaltung nach ADR-011 ist serverseitig umgesetzt:
> Passwort-Reset mit temporärem Passwort und `must_change_password`, Deaktivierung/Reaktivierung
> und Rollenwechsel widerrufen die Zielsitzungen transaktional und erzeugen Auditereignisse.
> Migration `0017` schützt insbesondere den letzten aktiven Administrator und die aktive
> Administrator-Identität fail-closed. Der V24-Wettlauftest erkennt nach zwei diagnostischen
> Linux-Läufen zusätzlich nur den exakt belegten `pg`-`DatabaseError` mit `name = error`,
> SQLSTATE `KB003` und der zeichengenauen Meldung des Profilwächters; andere SQLSTATEs und
> Meldungen bleiben rot. Der abschließende main-CI-Lauf `30800335370` mit den Jobs `verify`,
> `database`, `container` und `objectstore` sowie Container-Image `30800335380` sind jeweils
> `completed/success`. Die früheren Stände
> `79d88449f9e481b1148f902e175f46f9d07ef35d` und `22db6dad8958146be4de667a55e89ba170e73b7c`
> sind Vorfahren und damit überholt. Die Datenpfade
> für **Vorgänge, Aufgaben und Offline-Sync** sind auf PostgreSQL 18 migriert, lokal und in der CI
> verifiziert. Die weiter unten mit „(2026-07-28, nicht committet)“ gekennzeichneten
> AP14/B-Abschnitte beschreiben den Stand jenes Tages, sind in diesen Merges enthalten und behalten
> ihre historischen Prüfnachweise unverändert. Die Datenpfade für **Stammdaten und Inventar** sind
> ebenfalls auf PostgreSQL umgestellt und mit `79d8844` auf `main` **gemergt**. **Bilder und
> Uploads** sind auf PostgreSQL 18 und einen privaten MinIO-/S3-Objektspeicher umgestellt, mit
> `edfafb4` **gemergt** und durch einen echten MinIO-Container in der CI belegt (Job `objectstore`
> im PR-Lauf `30691249168`; abschließende main-Läufe: CI `30692250157` mit allen vier Jobs
> `completed/success` und Container-Image `30692250154` `completed/success`) — siehe
> „AP14/B — Bilder und Uploads auf MinIO“. Damit sind die **AP14/B-Datenpfade technisch
> abgeschlossen**. **AP14 insgesamt bleibt offen:** echte IT-Adressen und die Same-Origin-Route am
> internen Reverse-Proxy, produktiver Betrieb und Deployment, die vollständige `@app`-/Offline-
> Abnahme sowie die CSP-Auswertung sind **nicht** erbracht. AP15-2 hat die operative
> Dokumentation quellentreu konsolidiert; CI `30814390705` mit `verify`, `database`, `container`
> und `objectstore` sowie Container-Image `30814390702` sind jeweils `completed/success`.
> AP15-3 hat die Runtime- und CI-Wahrheit nachgezogen (2026-08-03, ergänzt 2026-08-08) und ist mit
> `0f3d0bdba30934ac503dde766789e602b0225529` (`chore(ci): align AP15-3 runtime truth`) auf `main`
> gepusht: `deploy/README.md` nennt die Migrationskette `0001`–`0017`, trennt den CI-Prüflauf aus
> Bootstrap und Kette vom Containerstart und produktiven Deployment, `app/.env.example` führt
> `AUTH_URL` sichtbar, `.github/workflows/ci.yml` setzt die Unit-Tests als hartes Gate im Job
> `verify`, und der Kopfkommentar von `deploy/scripts/rollback.sh` bezeichnet die Migrationen nicht
> mehr als additiv. Container-Image `31273906147` sowie die CI-Jobs `database`, `container` und
> `objectstore` des Laufs `31273906163` sind `completed/success`; der Job `verify` desselben Laufs
> ist **rot** im Schritt `npm audit --audit-level=high --omit=dev` (`nanoid <3.3.17`, high,
> GHSA-2v37-7h3g-55p8, Pfad `node_modules/postcss/node_modules/nanoid`). Behoben ist das mit dem
> Korrekturcommit `47704e027371fe4a0c0b70c579ee26f09756029a` (`fix(deps): update transitive nanoid`)
> auf `main`: der CI-Folgelauf `31276526201` ist `completed/success` mit allen vier Jobs `verify`
> (`93150848358`), `database` (`93150848347`), `container` (`93150848324`) und `objectstore`
> (`93150848342`), ebenso der Container-Image-Lauf `31276526192`. AP15-3 ist damit technisch
> abgeschlossen; die Lauf- und Jobkennungen sind durch Codex berichtet und von Claude nicht selbst
> abgerufen. AP15-4 (read-only Audit) und AP15-5 sind abgeschlossen: der bestehende CI-Job
> `database` führt seit dem Commit `9aaebdf` (`test(ci): gate all postgres integration suites`) auf
> `main` **alle fünf** PostgreSQL-Integrationssuiten fail-closed aus; die zuvor nur lokal laufenden
> Suiten `ap14b-platform`, `ap14b-masterdata-inventory` und `ap14b-images` sind darin enthalten.
> Die historischen Smokes `00` und `10`–`14` bleiben unverändert als Historienevidence und werden
> nicht in die CI-Kette aufgenommen (Einzelheiten im Abschnitt „AP15-4/AP15-5“). Nächster
> nicht-visueller Arbeitsblock sind ausschließlich die verbliebenen AP15-Fachbefunde
> (`fehlalarm`-Semantik, Datumsherkunft und Tagesgrenze der Tageskennzahlen, Filteroptionen in drei
> Transaktionen, Vollmengen-Reads der Listen). Die
> sichtbare GUI der Benutzerverwaltung wartet weiterhin auf die gemeinsame Designentscheidung mit
> Dennis.
> V1 bleibt Produktionssperre, Branding bleibt separat, GUI-/Designarbeit wartet auf Dennis.

## Projektziel
Offlinefähige Web-Anwendung (PWA) zur Erfassung und Dokumentation von Kabel-Bereitschaftsvorgängen:
Vorgänge, Rollen/Rechte (RLS), Material-/Lagerverwaltung, Bilddokumentation (privat, EXIF/GPS),
CSV-Export, Offlinebetrieb mit Synchronisation und Konfliktbehandlung.

## Getroffene Entscheidungen
- **Eigenständiges Repo** `DKuehnhold/Kabelbereitschaft` (Branch `main`), keine ManagementOS-Verbindung.
- **Arbeitsmodell (Entscheidung Dennis, 2026-07-30, ersetzt die Fassung vom 2026-07-28):**
  Claude ist der **ausführende Orchestrator** und delegiert Teilaufgaben an spezialisierte
  Claude-Ausführungs-Agents (`.claude/agents/`); ChatGPT/Codex ist Architekt und unabhängiger
  Qualitätsprüfer und startet selbst keine Ausführungs-Agents. Im Vault schreibt höchstens
  ein Agent gleichzeitig; read-only Prüfagents dürfen parallel laufen. Der technische Kreislauf
  aus Auftrag → Orchestrierung/Implementierung/Test → Review → Korrekturrücklauf läuft bis zur
  GUI-Phase autonom. Dennis wird nur bei sichtbaren GUI-/Designentscheidungen, zwingend
  fehlenden IT-Zugängen, V1 oder einer endgültigen Releasefreigabe einbezogen. Weder Claude
  noch ein Agent führt Commit, Push, Merge, Tag oder Release aus. Operative Regeln stehen in
  `AGENTS.md` und `CLAUDE.md`.
- **Ziel-Stack:** Next.js 16 (App Router, RSC + Server Actions), PostgreSQL 18 mit
  RLS, Auth.js v5, MinIO und Tailwind. Der Supabase-Altbestand aus AP1–AP13 ist mit `edfafb4`
  vollständig abgelöst; die Bibliotheken sind entfernt.
- **Sicherheit:** RLS ist maßgeblich; signierte URLs für private Bilder; keine Secrets im Client/Offline-Speicher.
- **CSV:** Semikolon + UTF-8-BOM (deutsches Excel), Formel-Injektionsschutz.
- **PWA/Offline:** handgeschriebener Service Worker (kein next-pwa), IndexedDB-Outbox/Upload-Queue,
  Sync über `/api/sync` + `/api/images/upload`.
- **Idempotenz (AP6):** Tabelle `sync_actions` (`unique(actor, client_action_id)`), Dedup + Kompensation.
- **HEIC:** nicht akzeptiert (keine zuverlässige Browser-Vorschau/Verarbeitung).
- **Sicherheitsheader (AP7):** harte Header durchsetzend; CSP zunächst Report-Only.
- **Release:** Semantic Versioning; erster RC `v1.0.0-rc.1`; **Tag/Release nur mit Nutzerfreigabe**.
- **Migrationen:** 17 versionierte Dateien `0001`–`0017` (Stand 2026-08-03), strikt in der
  vorgesehenen Reihenfolge anzuwenden; die Kette ist nicht durchgehend additiv (`0013` baut den
  Supabase-Altpfad ab) und als Ganzes nicht idempotent. Sie liegen vollständig auf `main`.
- **Zielplattform (ADR-011):** keine Supabase-Cloud und kein selbst gehostetes Supabase.
  Ziel sind interne PostgreSQL-18-Dienste, Auth.js v5 mit serverseitigem Sitzungswiderruf,
  MinIO für Bildobjekte sowie Containerbetrieb hinter dem Unternehmens-Reverse-Proxy.

## AP14 — interne Plattform

**Status 2026-07-28:** Arbeitspaket A ist auf
`feat/ap14-docker-postgres-ci` technisch verifiziert. Commit `8ec9731` plus
CI-Korrektur `761ff23`; Pull Request #1; GitHub-CI-Lauf `30380208864` vollständig
grün:

- Anwendung: ESLint, TypeScript, Produktions-Build, Audit und 11/11 öffentliche
  Browser-/Accessibility-Tests erfolgreich.
- Datenbank: PostgreSQL 18, Migrationen `0001`–`0011` und Smokes AP10–AP13 erfolgreich.
- Container: Hadolint, echter Docker-Build, Startschutz, Secret-Layer-Prüfung,
  Compose-Validierung und Trivy erfolgreich.
- Lokal zusätzlich normaler und Standalone-Build sowie Startvalidierung 78/0/78
  nachgewiesen.

**Noch offen (Präzisierung 2026-08-01):** Arbeitspaket B löst die verbleibenden
Supabase-Abhängigkeiten schrittweise ab. Auth-Basis, Vorgänge, Aufgaben und Offline-Sync sowie
Stammdaten und Inventar sind abgelöst und gemergt (siehe „AP14/B — Datenpfade …“). Bilder und
Uploads sind mit Commit `edfafb4` (Pull Request #5) ebenfalls abgelöst und **gemergt**
(siehe „AP14/B — Bilder und Uploads auf MinIO“).
Serveradresse, DNS, Ressourcen, Netzwerkdetails und Betriebszugänge liefert die interne IT.
Bis dahin kein Deployment. V1 bleibt Produktionssperre; kein produktiver Datenanfall.

## AP14/B — Auth-Basis (2026-07-28, nicht committet)

**Status:** implementiert und lokal vollständig verifiziert auf `feat/ap14b-postgres-platform`.
Kein Commit, kein Push, kein Merge, kein Tag.

### Umgesetzter Umfang

- **Datenbankzugriff** `app/src/lib/db/`: modulprivater `pg`-Pool ohne Export einer rohen
  Verbindung; jede Operation in einer expliziten Transaktion; Identität transaktionslokal über
  `set_config('app.user_id', $1, true)`; fehlende oder unplausible Benutzer-ID bricht **vor**
  dem SQL-Lauf ab; Client-Fassade erlaubt nur parametrisierte Abfragen und blockiert
  Transaktions-/Sitzungssteuerung (`statement-guard.ts`); Poolfehler- und Laufzeitgrenzen
  (`statement_timeout`, `idle_in_transaction_session_timeout`).
- **Argon2id** `auth-password.ts`: OWASP-Mindestsatz `m=19456, t=2, p=1`, Version über
  `password_hash_version` nachziehbar (Rehash beim nächsten Login); Aufwandsangleichung gegen
  Benutzeraufzählung; der Migrationsmarker ist nicht prüfbar.
- **Zweistufige Sitzungsauswertung** `auth-service.ts` genau nach ADR-011/2.2: Stufe 1 ohne
  Identität (`auth_accounts`/`auth_sessions`, rechtegeschützt), Stufe 2 mit der dadurch
  bestätigten Identität (`profiles`, RLS-geschützt). Kontosperre nach 5 Fehlversuchen für
  15 Minuten; abgelaufene Sperre setzt den Zähler zurück; `locked_until` beendet **keine**
  laufende Sitzung (sonst wäre Fremdaussperrung möglich).
- **Auth.js v5** `auth.ts`: verschlüsselte JWTs (JWE A256CBC-HS512) mit ausschließlich `sub` und
  `sid`, Lebensdauer 10 Minuten, stille Erneuerung über den Proxy; Widerrufsprüfung bei **jeder**
  Auswertung; `jwt`-Callback gibt bei Ungültigkeit `null` zurück und löscht das Cookie; Rolle und
  Anzeigename stammen aus der Datenbank, nie aus einem Claim.
- **Login-Action und Abmeldung**: `/login` mit neutraler Fehlermeldung (keine
  Benutzeraufzählung), Betriebsdiagnose nur im Serverprotokoll; `/auth/signout` widerruft
  serverseitig **vor** dem Löschen des Cookies, mit Same-Origin-Prüfung (Logout-CSRF) und
  sichtbarem Fehlschlag; `events.signOut` bleibt idempotentes Sicherheitsnetz.
- **Next-16-Proxy** `app/src/proxy.ts` ersetzt `middleware.ts` und
  `lib/supabase/middleware.ts` (beide entfernt). Präfixe wirken nur an Pfadgrenzen — die
  abgelöste Middleware hielt `/loginfremd` oder `/authentifizierung` versehentlich für
  öffentlich. Auth-Endpunkte bleiben unberührt, damit der Proxy kein frisches
  Anmeldecookie überschreibt.
- **Migration `0012` korrigiert** (drei Blocker, ohne die die Auth-Basis nicht lauffähig wäre):
  1. `auth_accounts.updated_by` ergänzt — der gemeinsame Trigger `tg_touch_updated()` setzt
     `updated_at` **und** `updated_by`; ohne die Spalte scheitert **jeder** `UPDATE` mit
     `record "new" has no field "updated_by"` (Fehlversuchszähler, Login-Reset, Rehash).
  2. `grant select on public.profiles to app_user` — ohne dieses Tabellenrecht liefert die
     Sitzungsauswertung unter der nicht privilegierten Rolle keine Zeile. **Kein
     Policy-Inhalt wurde gelockert**, `profiles_select` gilt unverändert.
  3. Trigger `trg_audit_auth_session_revoked` — `audit_events` hat bewusst keine
     Insert-Policy; der Auditsatz zum Widerruf muss vom `SECURITY DEFINER`-Trigger kommen und
     entsteht nur beim Übergang `revoked_at` NULL → gesetzt (kein Auditrauschen durch
     `last_seen_at`).
- **Entfernte Supabase-Auth-Zugriffe:** `src/middleware.ts`, `src/lib/supabase/middleware.ts`,
  der Supabase-Anmeldepfad in `login/actions.ts`, der Supabase-Abmeldepfad in
  `auth/signout/route.ts` und `supabase.auth.getUser()` in `lib/auth.ts`. Die Datenmodule
  bleiben unverändert auf Supabase (eigene Folgeaufträge); deshalb sind derzeit **beide**
  Variablengruppen Laufzeitpflicht. **Nachtrag 2026-08-01:** überholt — seit dem gemergten Commit
  `edfafb4` auf `main` verlangt die Startprüfung `DATABASE_URL`, `AUTH_SECRET`,
  `AUTH_URL` und die fünf S3-Pflichtnamen und verweigert den Start, wenn eine der drei
  Supabase-Variablen gesetzt ist.

### Prüfergebnisse (tatsächlich erhoben, 2026-07-28)

> Die Mengenangaben dieses Abschnitts beschreiben den Stand **vor** der Routensperre für
> `must_change_password`. Maßgeblich sind die Zahlen im Abschnitt „Prüfergebnisse dieses
> Laufs" weiter unten (41 Einheitentests, 30 Integrationstests, 21 `@public`-Browsertests,
> Smokes P1–P19).

- TypeScript `tsc --noEmit`: Exit 0.
- ESLint: Exit 0, 0 Fehler, 0 Warnungen.
- Next.js-Produktions-Build: Exit 0; `ƒ Proxy (Middleware)` wird registriert.
- Einheitentests `app/test/ap14b-auth.test.mjs` (`npm run test:unit`): **25/25**, Exit 0.
- Datenbanklauf gegen eine temporäre PostgreSQL-18-Instanz (`run_ap14b_local.ps1`-Kette):
  Bootstrap, Migrationen **0001–0013**, Smokes **AP10–AP13** und **AP14/B P1–P17** erfolgreich,
  Abschlusszeile `ERGEBNIS: AP10/AP11/AP12/AP13/AP14B DATENBANKTESTS ERFOLGREICH.`
  P15–P17 laufen ausdrücklich **unter `app_user` mit aktiver RLS** — genau die Prüfung, die die
  beiden RLS-Blocker aufgedeckt hat.
- Integrationstests des Anwendungscodes `app/test/integration/ap14b-platform.int.mjs`
  (Teil derselben Kette, **echter** Anwendungscode gegen synthetisches PostgreSQL):
  **19/19**, Exit 0. Nachgewiesen: Mehrfachanweisungssperre, Einzelwiderruf nur der eigenen
  Sitzung, fail-closed Massenwiderruf und das Bootstrap des ersten Administrators.
- **Anmeldelauf gegen eine echte PostgreSQL-18-Datenbank** mit nicht privilegierter Anmelderolle
  (kein `SUPERUSER`, kein `BYPASSRLS`) und laufendem Produktionsserver, 10 Szenarien erfolgreich:
  falsches Passwort (Zähler +1, keine Sitzung), unbekannte Adresse, erfolgreiche Anmeldung
  (genau eine Sitzung, Zähler zurückgesetzt, pseudonymisierte Merkmale gesetzt, Cookie),
  geschützte Seiten 200 und `/login` → `/dashboard`, Rollenwechsel in der Datenbank wirkt
  sofort, serverseitiger Widerruf wirkt beim nächsten Request, inaktives Profil verweigert die
  Anmeldung **ohne** ausgestellte Sitzung, Abmeldung widerruft mit korrektem Grund und Urheber,
  Kontosperre nach 5 Fehlversuchen weist auch das richtige Passwort ab sowie
  **transaktionslokale Laufzeitgrenzen** (`statement_timeout` und
  `idle_in_transaction_session_timeout` gelten innerhalb der Wrapper-Transaktion, bleiben laut
  `pg_settings.reset_val` Sitzungsvorgabe, brechen eine zu lange Anweisung mit `57014` ab, und
  dieselbe Poolverbindung ist danach mit erneut gesetzten Grenzen und ohne Reste der
  vorherigen Identität wieder brauchbar).
- Playwright `@public` in echtem Chromium gegen den Produktionsserver: **18/18** erfolgreich
  (11 Bestandstests plus 7 neue in `e2e/auth-proxy.spec.ts`), einschließlich axe-core auf
  `/login` und `/offline`.
- Temporäre Testdatenbanken und das temporäre Cluster-Datenverzeichnis wurden entfernt; der
  vorhandene Dienst `postgresql-x64-18` blieb unangetastet.

### Korrekturen nach Architekturreview (2026-07-28, nicht committet)

Sechs abgegrenzte Reviewfeststellungen, ohne GUI-Änderung:

1. **Mehrfachanweisung strukturell gesperrt.** `DatabaseClient.query()` erzwingt jetzt das
   Extended-Query-Protokoll (`queryMode: "extended"`), unabhängig davon, ob Werte übergeben
   werden. Vorher wählte `pg` bei leerer Werteliste das Simple-Query-Protokoll, das mehrere
   durch Semikolon getrennte Anweisungen ausführt — die Schlüsselwortprüfung sah nur das erste
   Wort. Zusätzlich weist `statement-guard.ts` mehrere Anweisungen **vor** dem Verbindungsaufbau
   ab (Literale, Dollar-Quotes und Kommentare werden korrekt übersprungen). Beide Ebenen sind
   getrennt geprüft: I1 belegt, dass die Lücke real ist, I2 die Protokollsperre, I3 die
   strukturelle Sperre, I4 dass eine angehängte `set_config`-Anweisung die transaktionslokale
   Identität nicht übernehmen kann. `query()` ist jetzt `async`, damit eine Verletzung als
   abgelehntes Promise und nicht synchron erscheint.
2. **Einzelwiderruf nur der eigenen Sitzung.** `revokeSession()` filtert zusätzlich auf
   `account_id = actorUserId`. Notwendig, weil `auth_sessions` rechte- und nicht RLS-geschützt
   ist und `app_user` jede Zeile ändern darf; eine bekannte fremde Sitzungs-ID hätte sonst eine
   Fremdsitzung beenden können. Negativtest I5 (fremde Sitzung bleibt offen, kein Auditeintrag).
3. **Massenwiderruf fail-closed.** `revokeAllSessionsForAccount()` erlaubt Selbstwiderruf oder
   einen Handelnden, dessen Profil **in derselben Transaktion** mit `role = 'admin'` und
   `is_active` aus der Datenbank bestätigt wird; jeder andere Fall wirft
   `SessionRevokeDeniedError` und rollt zurück. Es gibt bewusst **keinen** Rollenparameter, die
   Rolle stammt nie aus Aufruf oder JWT. Tests I8 (Selbstwiderruf), I9 (ohne Adminrolle),
   I10 (inaktiver Administrator), I11 (aktiver Administrator, Urheber im Audit), I12 (Signatur).
4. **Bootstrap des ersten Administrators** (`app/scripts/bootstrap-admin.mjs`, ADR-011/2.11):
   verdeckte, doppelte Kennworteingabe am Terminal; kein Klartext in Argumenten, Dateien, Logs,
   Dokumentation oder Git; Argon2id über die zentrale Implementierung; eine Transaktion mit
   `pg_advisory_xact_lock`; idempotent und fail-closed; nur für eine leere bzw. eindeutig
   zulässige Ausgangslage. Betreiberablauf in `07-Betrieb/BENUTZERVERWALTUNG.md`. Tests I13–I19.
5. **Dokumentation:** die Mengenangaben des Anmeldelaufs und der Einheitentests waren falsch
   (siehe Prüfergebnisse).
6. **Sitzungs-ID verlässt den Server nicht mehr.** Auth.js v5 kann ein Feld nicht rein
   serverseitig führen — `auth()` liest dieselbe JSON-Antwort wie der Browser. Getrennt wird
   deshalb dort, wo sich die Wege wirklich unterscheiden: `auth()` umgeht den eigenen Route
   Handler, der Browser nicht. `app/src/app/api/auth/[...nextauth]/route.ts` entfernt `sid` aus
   der Antwort von `/api/auth/session` (Status, Statustext und alle `Set-Cookie`-Zeilen bleiben
   erhalten, die stille Erneuerung also unberührt). Serverseitig steht `sid` weiter zur
   Verfügung, die Abmeldung widerruft unverändert genau die eigene Sitzung. **Keine
   Cookie-Decodierung.**

Zusätzlich wurde `run_ap14b_local.ps1` handle-sicher gemacht: Start und Stopp des temporären
Clusters laufen über `Start-Process` mit Umleitung in Dateien statt in eine PowerShell-Pipeline.
Ursache des vorherigen Stillstands war die vererbte Standardausgabe — der langlebige
`postgres.exe` hielt das Schreibende der Pipeline offen, das Leseende sah nie ein Dateiende.
Ergänzt sind Bereitschaftsprüfung mit `pg_isready`, Portprüfung vor dem Start und nach dem
Stopp, endliche Zeitlimits und das Entfernen der Hilfsdateien.

### Erzwungener Passwortwechsel — Routensperre umgesetzt (2026-07-28, nicht committet)

Damit ist die letzte offene Anforderung aus ADR-011/2.3 und der Pflichtnachweis 2.12(e)
erfüllt. Keine Gestaltungsentscheidung: der Wechsel übernimmt Karte, Felder, Hinweiskasten
und Schaltflächen unverändert von der bestehenden Anmeldeseite.

- **Serverseitige Sperre in zwei Ebenen, nicht in einer Client-Komponente.**
  `getSessionProfile()` liefert **NULL**, solange `must_change_password` gilt — damit weisen
  **alle** bestehenden Server Actions und geschützten Route Handler fail-closed ab, ohne dass
  dort eine Zeile ergänzt wurde (sie behandeln NULL bereits als „nicht berechtigt").
  `requireSession()` leitet jede geschützte Seite auf `/passwort-aendern` um. Die rohe
  Auswertung ist modulprivat; es gibt keinen zweiten Weg zur Sitzung. Ausnahme ist
  ausschließlich `getSessionProfileForPasswordChange()` für den Wechsel selbst und die
  Abmeldung — sonst wäre das Konto handlungsunfähig.
- **Grobe Weiche im Proxy** über die neue pure Funktion `evaluateAccess()` in
  `lib/auth-paths.ts` (Proxy ist nur noch deren HTTP-Hülle). Fail-closed: nur ein
  ausdrückliches `false` aus der Datenbank hebt den Zwang auf; ein fehlender Wert gilt als
  Zwang. `/login` führt bei Zwang auf den Wechselpfad statt ins Dashboard.
- **Wechsel `/passwort-aendern`** außerhalb der Routengruppe `(app)` — deren Layout ruft
  `requireSession()` und würde eine Umleitungsschleife erzeugen. Drei Felder (aktuelles,
  neues, Bestätigung), Zugriffsschutz in der Server-Komponente **und** in der Server Action.
- **Zentrale Passwortregeln** (`MIN_PASSWORD_LENGTH = 12`, Obergrenze 1024, kein reiner
  Leerraum) liegen jetzt in `auth-password.ts` und werden vom Bootstrap-Werkzeug **und** vom
  Wechsel benutzt; die Meldungstexte kommen aus derselben Quelle. Keine zweite Kryptologik:
  Argon2id ausschließlich über `hashPassword()`/`verifyPassword()`.
- **`changeOwnPassword()`** ist ein Aufruf und eine Transaktion: Konto sperrend lesen
  (`for no key update`), Konto nicht deaktiviert und Profil aktiv, aktuelles Passwort in
  derselben Transaktion prüfen, dann Hash, `password_hash_version`,
  `must_change_password = false`, `password_changed_at`, Zähler/Sperre zurücksetzen und
  **alle** offenen Sitzungen widerrufen. Der neue Hash entsteht vor der Transaktion, damit
  Argon2id keine Verbindung mit offener Transaktion hält. Danach beendet die Action die
  Auth.js-Sitzung; die erneute Anmeldung ist zwingend.
- **Migration `0012` ergänzt:** Spalte `password_changed_at` und Trigger
  `trg_audit_auth_password_changed`. Ausgelöst wird ausschließlich die Änderung dieses
  Zeitpunkts — ein Trigger auf `password_hash` wäre falsch, weil die Anmeldung einen
  veralteten Argon2-Parametersatz nachzieht und das kein Passwortwechsel ist. `detail` enthält
  weder Kennwort noch Hash.
- **Fail-closed nach außen:** falsches aktuelles Passwort, deaktiviertes Konto und inaktives
  Profil ergeben dieselbe neutrale Meldung; ein technischer Fehler eine zweite, ebenso
  neutrale. Keine Aussage über den Kontozustand, kein Klartext in Meldung, Protokoll oder
  Audit. Fehlversuche werden hier bewusst **nicht** gezählt: die Anmeldesperre schützt den
  Anmeldeweg, ein Zähler hier ermöglichte nur eine Selbstaussperrung.
- **Browser-Sitzungsfilterung jetzt fail-closed** (`auth-session-response.ts`): unverändert
  weitergegeben wird nur eine Antwort, die als Sitzungsauskunft lesbar ist und nachweislich
  kein `sid` enthält (ohne Rumpf, JSON `null` als ausdrückliches „keine Sitzung“, JSON-Objekt
  mit `user`-Objekt ohne `sid`). Jedes andere nichtleere Format — kein JSON, unlesbares JSON,
  kein Objekt, Objekt **ohne** `user`, `user: null`, `user` kein Objekt — wird durch den
  neutralen Rumpf `null` ersetzt; ein Objekt ohne geprüftes `user` kann beliebige weitere
  Felder tragen (z. B. ein `sid` auf oberster Ebene). Status, Statustext und **alle**
  `Set-Cookie`-Zeilen bleiben in jedem Fall erhalten, die stille Tokenerneuerung also unberührt.
- **`.gitignore`:** `/.claude/automation/runtime/` ist ausgeschlossen. Quellskript,
  Rollenregeln und Aufgabenbeschreibungen bleiben versionierbar.

#### Prüfergebnisse dieses Laufs (tatsächlich erhoben, 2026-07-28)

- TypeScript `tsc --noEmit`: Exit 0. ESLint: Exit 0, 0 Fehler, 0 Warnungen.
- Next.js-Produktions-Build: Exit 0; Route `ƒ /passwort-aendern` und
  `ƒ Proxy (Middleware)` werden registriert.
- Einheitentests `npm run test:unit`: **41/41**, Exit 0 (34 in `ap14b-auth.test.mjs`,
  7 in der neuen `ap14b-session-guard.test.mjs`). Letztere prüft den **echten**
  `src/lib/auth.ts`; ersetzt sind nur `@/auth` und `next/navigation`.
- Datenbanklauf `run_ap14b_local.ps1 -TemporaryCluster`: Bootstrap, Migrationen 0001–0013,
  Smokes AP10–AP13 und AP14/B **P1–P19** erfolgreich, Abschlusszeile
  `ERGEBNIS: AP10/AP11/AP12/AP13/AP14B DATENBANKTESTS ERFOLGREICH.`, Exit 0. Neu: **P18**
  (Wechsel auditiert, Hash-Erneuerung nicht) und **P19** (Wechsel beendet alle Sitzungen).
- Integrationstests gegen echtes PostgreSQL 18 mit nicht privilegierter Anmelderolle:
  **30/30**, Exit 0. Neu **I20–I30**: 2.12(e) aus der Datenbank heraus, falsches aktuelles
  Passwort, zu kurzes Passwort, identischer Wert, deaktiviertes Konto, inaktives Profil,
  unbrauchbare Kennung, **echter Datenbankfehler rollt alles zurück** (dem Anwendungsbenutzer
  wird `update` auf `auth_sessions` entzogen — Hash und Wechselzwang bleiben unverändert),
  Erfolgsfall, Auditvollständigkeit, kein Klartext, sowie erneute Anmeldung mit dem neuen
  Passwort ohne Wechselzwang.
- Playwright `@public` in echtem Chromium: **21/21**, Exit 0 (18 Bestand plus 3 neue:
  Wechselpfad ohne Sitzung gesperrt, ähnliches Präfix ist nicht der Wechselpfad,
  Serveraktion ohne Sitzung nicht nutzbar).
- **HTTP-Nachweis 2.12(e) gegen laufenden Produktionsserver und echtes PostgreSQL 18**
  (temporäres Cluster, synthetisches Konto, anschließend vollständig entfernt): 16 Prüfungen
  erfolgreich — Anmeldung des gesperrten Kontos, genau eine serverseitige Sitzung,
  Sitzungsauskunft meldet den Zwang aus der Datenbank und enthält kein `sid`, **alle 13
  geschützten Seiten** und **alle 3 geschützten APIs** gesperrt, `/login` führt auf den
  Wechselpfad, der Wechselpfad selbst liefert 200 mit den drei Feldern, Aufhebung des Zwangs
  in der Datenbank wirkt bei derselben Sitzung sofort und die Wiederaufnahme ebenso, die
  Abmeldung bleibt offen, widerruft serverseitig und ist auditiert, danach ist auch der
  Wechselpfad gesperrt.
- Temporäres Cluster, temporärer Server, temporäre Datenbanken, Rollen und Hilfsdateien
  wurden entfernt; der vorhandene Dienst `postgresql-x64-18` blieb unangetastet.

### Offene Punkte und Blocker

- Vollständige Rechtematrix für `app_user` auf den Fachtabellen: gehört zur Migration der
  Datenmodule, hier ist nur das Mindestrecht auf `profiles` enthalten. **Nachtrag 2026-07-31:**
  für Vorgänge, Aufgaben und Offline-Sync mit Migration `0014_ap14b_data_grants.sql` und für
  Stammdaten und Inventar mit Migration `0015_ap14b_masterdata_inventory_grants.sql` geliefert;
  offen bleibt sie nur noch für Bilder und Uploads. **Nachtrag 2026-08-01:** für Bilder und Uploads
  mit Migration `0016_ap14b_image_grants.sql` geliefert; sie liegt mit `edfafb4` auf `main`.
- **Stand 2026-07-28:** CSP und `connect-src` nennen weiterhin Supabase, weil Bilder und Uploads
  noch dorthin sprechen.
  **Nachtrag 2026-08-01:** seit dem gemergten Commit `edfafb4` auf `main` findet
  die Supabase-Restsuche keine produktive Nennung mehr; die CSP bleibt bei `img-src 'self'` ohne
  Wildcard und ohne fremde Herkunft und wird weiterhin nur als Report-Only ausgeliefert.
- `@app`-E2E weiterhin offen: sie brauchen den vollständigen Stack einschließlich MinIO.

## AP14/B — Datenpfade Vorgänge, Aufgaben, Offline-Sync (2026-07-31, gemergt)

**Status:** technisch abgeschlossen und auf `main` gemergt, Commit
`6b9d8dd7b4b937b3a2cb055b509557ed17313430` (`feat: migrate incident and task data paths to
PostgreSQL`), 18 Dateien, +4422/-583. **Kein Tag, kein Release, keine V1-Freigabe.**

- **Umfang:** in `app/src` auf PostgreSQL umgestellt sind `lib/incidents.ts`,
  `lib/incident-actions.ts`, `lib/incident-list-actions.ts`, `lib/tasks.ts`, `lib/task-actions.ts`,
  `lib/db/pg-errors.ts`, `app/api/sync/route.ts` und `app/api/incidents/[id]/meta/route.ts`; dazu
  Migration `0014_ap14b_data_grants.sql`, die Smokes `19a_ap14b_grant_reset.sql` und
  `20_ap14b_data.sql`, die Erweiterung von `18_ap13_tasks.sql` sowie die Runner
  `run_ap14b_local.ps1` und `run_db_tests.sh`.
- **Rechtematrix (`0014`):** alle Rechte gehen ausschließlich an `app_user`, kein Grant an
  `public`, `anon` oder `authenticated`; Schreibrechte sind eng geschnitten (`incident_notes` und
  `sync_actions` ohne `update`/`delete`, `incident_tasks` ohne `delete`, kein Recht auf
  `audit_events`); genau ein `revoke` entzieht `refresh_incident_tasks_ap13` für `public`, `anon`,
  `authenticated` und `app_user`; **vier** fail-closed Prüfblöcke am Migrationsende belegen zwei
  Positivfälle (Tabellen- und Ausführungsrechte vorhanden) und zwei Negativfälle (kein
  unerwartetes Ausführungsrecht, kein Delete- oder `audit_events`-Recht) und brechen mit
  `raise exception` ab. Die Migration ändert **nur Rechte** — keine Policy,
  View oder Funktion; die Zeilensichtbarkeit bleibt unverändert Sache der bestehenden RLS-Policies.
- **Transaktionsabsicherung:** jeder Lese- und Schreibpfad läuft über
  `withUserTransaction(session.userId, …)` mit der Identität ausschließlich aus
  `getSessionProfile()`; mehrschrittige Aktionen liegen in **einer** Transaktion, `/api/sync`
  führt bewusst je Eintrag eine eigene; Konflikterkennung über den `updated_at`-Vergleich vor dem
  RPC-Aufruf; Idempotenz über den Unique-Index `(actor, client_action_id)` auf `sync_actions`, ein
  Duplikat gilt als `applied` ohne erneute Wirkung; Fehlerabbildung ausschließlich über SQLSTATE
  (`lib/db/pg-errors.ts`), Klartext-Datenbankmeldungen verlassen den Server nicht.
- **Nachweis lokal:** PostgreSQL-18-Gesamtlauf mit Prozess-Exitcode 0 — Bootstrap, Migrationen
  0001–0014, Smokes 15–20 einschließlich 19a, 30/30 Node-Integrationstests, R1/R2/D13/D26/D27
  grün, vollständige Bereinigung belegt.
- **Nachweis unabhängige Wiederholung durch Codex:** TypeScript 0, ESLint 0, 41/41 Einheitentests,
  Produktions-Build 0, `git diff --check` 0.
- **Nachweis CI:** die beiden **durch Codex bestätigten** Push-Läufe zu `6b9d8dd` — CI-Lauf
  `30635566629` completed/success und Container-Image-Lauf `30635566645` completed/success.
- **Grenze:** Bilder und Uploads laufen unverändert über Supabase
  (u. a. `image-actions.ts`, `image-upload-core.ts`, `images-server.ts`,
  `lib/supabase/server.ts`, `lib/supabase/client.ts`, `database.types.ts`); Stammdaten und
  Inventar sind Gegenstand des folgenden, inzwischen gemergten Abschnitts. AP14 insgesamt ist
  **nicht** abgeschlossen: Browser-/Offline-Abnahme, CSP-Durchsetzung, MinIO sowie Betrieb und
  Deployment bleiben offen. **Nachtrag 2026-08-01:** diese Grenze ist mit dem gemergten Commit
  `edfafb4` aufgehoben (siehe „AP14/B — Bilder und Uploads auf MinIO“).

## AP14/B — Datenpfade Stammdaten und Inventar (2026-08-01, gemergt)

**Status:** technisch abgeschlossen und auf `main` gemergt, Commit
`79d88449f9e481b1148f902e175f46f9d07ef35d` (`feat: migrate masterdata and inventory to
PostgreSQL`), 14 Dateien, +6021/-478. Der Commit ist ein Fast-Forward von
`cb8bb888280b5509ae2c273789183767e3b7b4db` mit genau einem Commit Abstand, also **ohne
Merge-Commit und ohne Force-Push**; zum damaligen Zeitpunkt standen `main`, `origin/main` sowie
der lokale und der remote Feature-Branch `feat/ap14b-data-masterdata-inventory` auf demselben
Commit. `main` steht inzwischen auf `cbe17b3`.
**Kein Tag, kein Release, keine V1-Freigabe.**

- **Umfang:** auf PostgreSQL umgestellt sind `app/src/lib/masterdata.ts`, `masterdata-actions.ts`,
  `inventory.ts` und `inventory-actions.ts`; in allen vier Dateien gibt es null Supabase-Importe und
  null `supabase.`-Zugriffe (per Suche belegt). Neu sind die Migration
  `0015_ap14b_masterdata_inventory_grants.sql`, der Smoke `21_ap14b_masterdata_inventory.sql` und der
  Node-Integrationstest `app/test/integration/ap14b-masterdata-inventory.int.mjs` mit der
  Auflösungsdatei `module-hooks-app.mjs` und zwei Teststubs; die beiden Startskripte
  `run_ap14b_local.ps1` und `run_db_tests.sh` wurden um Migration 0015 und Smoke 21 erweitert.
- **Rechtematrix (`0015`):** die Migration ändert ausschließlich Rechte — keine Tabelle, Spalte,
  Policy, View, Funktion oder Trigger. Alle 16 `grant`-Anweisungen gehen ausschließlich an
  `app_user`; es gibt keinen Grant an `public`, `anon` oder `authenticated`, kein Recht auf
  `audit_events` und **kein** `revoke`. Erteilt werden objektgenau: nur `insert`/`update` auf den
  **sieben** Stammdatentabellen `on_call_numbers`, `customers`, `construction_stages`, `vzg_lines`,
  `contacts`, `cable_types` und `app_settings`, deren Leserecht bereits aus `0014` stammt (bei
  `app_settings` dient das Schreibrecht nicht einer `is_active`-Deaktivierung, sondern dem
  Singleton-Upsert); `select`/`insert`/`update` auf `technicians` und `teams`, wo das Leserecht
  **neu** ist, weil `0014` diesen beiden Tabellen gar kein Recht erteilt und `listTechnicians()`,
  `listTeams()` sowie der Namensabgleich des Monteurimports es voraussetzen; `insert`/`delete` auf
  `contact_phone_numbers`, dessen `select` bereits aus `0014` besteht, sowie
  `select`/`insert`/`delete` auf `construction_stage_contacts` und `team_members`, deren Leserecht
  hier erstmals erteilt wird, weil `listContacts()` die Bauabschnittszuordnung und `listTeams()` die
  Mitgliedschaft mitliest — auf allen drei vollständig ersetzten Zuordnungstabellen bewusst kein
  `update`; im Inventar `select`/`insert`/`update` auf `materials` und `storage_locations` (bewusst
  kein `delete`, Deaktivierung über `is_active`), `select` auf der Bestands-View `material_stock` und
  `select`/`insert` auf `inventory_movements` — für die Chronik ausdrücklich **kein** `update` und
  **kein** `delete`. Vier fail-closed `do`-Blöcke am Migrationsende: **ein** Positivblock über 40
  Objekt/Recht-Paare, davon drei nur als Wächter über Rechte, die schon aus `0012`/`0014` stammen
  (`profiles select` aus `0012`, `incidents select` und `incidents update` aus
  `0014_ap14b_data_grants.sql:55` für die `for update`-Serialisierung der Buchungswege; beides
  direkte Vergaben an `app_user`, keine Rollenvererbung), sowie **drei** Negativblöcke: 19
  verweigerte Tabellenrechte, die sieben klassischen Tabellenprivilegien auf `audit_events`
  (`select`, `insert`, `update`, `delete`, `truncate`, `references`, `trigger`; das seit
  PostgreSQL 17 zusätzliche `MAINTAIN` prüft der Block nicht, es erlaubt keinen Datenzugriff) und
  die Gegenprobe, dass `app_user` weder `SUPERUSER` noch `BYPASSRLS` hat.
- **Transaktionsabsicherung:** jeder Lese- und Schreibpfad läuft über
  `withUserTransaction(session.userId, …)`; die Identität stammt ausschließlich aus
  `getSessionProfile()`, das bei fehlender Sitzung und bei `must_change_password` NULL liefert —
  eine fehlende Sitzung führt in den Lesewegen zum leeren Ergebnis wie bisher und in den
  Schreibwegen zur Abweisung, in beiden Fällen ohne ausgeführtes SQL.
  Mehrschrittige Operationen liegen in genau **einer** Transaktion: `saveContact` (Kontakt,
  Telefonnummern, Bauabschnittszuordnung), `saveTeam` (Team und Mitgliedschaft) und die vier
  Buchungswege einschließlich Einheitsabfrage und, bei der Rückgabe, der Prüfung der rückgabefähigen
  Menge. SQL ist durchgängig parametrisiert, `order by` steht ausschließlich als festes Literal.
  Fehler werden allein über den SQLSTATE eingeordnet; eine Datenbankmeldung gelangt nicht in das
  Ergebnis einer Server Action, sondern ausschließlich ins Serverprotokoll. `created_by` und
  `created_at` einer Bewegung bleiben Spaltendefault und werden nie aus einer Eingabe gesetzt.
- **Reihenfolge in der Prüfkette:** Migration `0015` und Smoke `21` laufen in beiden Startskripten
  **hinter** `20_ap14b_data.sql`. Grund: dessen Fall D18 prüft ausdrücklich negativ, dass `app_user`
  kein `select` auf `inventory_movements` und kein `insert` auf `customers` besitzt, und belegt damit
  den `0014`-Stand. Diese bestehende Negativprobe bleibt unverändert gültig; eine Anwendung von
  `0015` davor würde sie scheitern lassen.
- **Codex-Review und Korrekturlauf (2026-08-01):** das Codex-Review hat drei blockierende Befunde
  festgestellt (F1 Rollenprüfung als Verbotsliste, F2 Rückfall auf `Stk` bei unbekanntem Material,
  F3 parallele Rückgaben über die Restmenge hinaus). Die drei folgenden Punkte beschreiben deren
  Behebung; sie stammen aus dem Korrekturlauf vom 2026-08-01 und nicht aus dem Vorlauf vom
  2026-07-31.
- **Reviewkorrektur Rollenprüfung (F1):** `createMovement()` entscheidet jetzt über eine
  ausdrückliche Allowlist (`admin`, `disponent`) statt über die frühere Verbotsliste
  `role === "monteur"`. Eine künftig ergänzte Rolle ist damit nicht länger durch Schweigen
  buchungsberechtigt. Die zugelassene Menge deckt sich mit `public.is_staff()` und mit der Policy
  `movements_insert`; der sichtbare Meldungstext ist unverändert.
- **Reviewkorrektur fehlendes Material (F2):** der Rückfall auf die Einheit `Stk` bei fehlender
  Materialzeile ist entfallen. `materialUnit()` liefert jetzt `null`, und alle vier Buchungswege
  brechen fachlich vor dem Insert ab, statt sich auf den Fremdschlüssel zu verlassen. Fehlendes
  Material („Verweis auf Material, Lager oder Vorgang ist ungültig.") und inaktives Material
  („Material ist inaktiv.") liefern unterscheidbare Meldungen. Der Aktivstatus wird in Entnahme,
  Rückgabe und Verbrauch ausdrücklich **nicht** geprüft: eine bereits entnommene Menge muss
  rückgabefähig bleiben, auch wenn das Material inzwischen deaktiviert wurde.
- **Reviewkorrektur Serialisierung (F3):** Entnahme, Rückgabe und Verbrauch sperren als **erste**
  Anweisung ihrer bestehenden Transaktion die Vorgangszeile mit
  `select id from public.incidents where id = $1::uuid for update`; zwei gleichzeitige Rückgaben
  **desselben Vorgangs** können damit nicht mehr beide dieselbe Restmenge sehen. Die Sperre liegt
  zwingend **vor** der Prüfung der rückgabefähigen Menge. `public.incidents` ist gewählt, weil alle drei Wege diese
  Zeile zwingend berühren und sie für `admin`, `disponent` und den zugewiesenen Monteur sowohl
  sichtbar (`incidents_select`) als auch sperrbar (`incidents_update`) ist — beide Policies tragen
  dieselbe Bedingung (`0001_init.sql:540-546`); das nötige `update`-Recht der Anwendungsrolle stammt
  aus `0014_ap14b_data_grants.sql:55`, Vorbild für die Sperre ist
  `0010_ap12_incident_details.sql:255-259`. Kein globaler Lock, kein Superuser, kein
  SECURITY-DEFINER-Umweg, keine geänderte Isolationsstufe. Ein fehlender oder nicht sichtbarer
  Vorgang bricht fail-closed ab; „nicht vorhanden" und „nicht sichtbar" sind absichtlich nicht
  unterscheidbar. **Ausdrücklich offen geblieben, vollständig nach dem Quelltextvermerk:** die
  Vorgangssperre wirkt ausschließlich zwischen Buchungen **desselben** Vorgangs. Sie schützt den
  Bestandswächter `check_inventory_nonnegative()` — einen `BEFORE`-Trigger ohne eigene Sperre, der
  auf einem Anweisungssnapshot rechnet — **nicht** gegen gleichzeitige Abgänge desselben Materials
  aus demselben Lager, wenn diese verschiedene Zeilen sperren oder gar keine: zwei Entnahmen oder
  Verbräuche auf **verschiedenen** Vorgängen sperren verschiedene Vorgangszeilen, und die
  lagerbezogenen Abgänge aus `createMovement()` (`verlust`, `beschaedigung`, `umbuchung`,
  `korrektur`-Abgang) sperren **überhaupt nichts**, weil sie keine Vorgangszeile berühren. Diese
  Lücke zu schließen wäre eine andere Sperrgranularität (Material/Lager) und damit eine fachliche
  Entscheidung. **Voraussetzung der Zusage** ist die PostgreSQL-Vorgabestufe `READ COMMITTED`:
  `withUserTransaction()` setzt keine Isolationsstufe, die Anweisungssperre verbietet `set`, und
  keine Migration, kein Startskript und keine Umgebungsvorlage setzt
  `default_transaction_isolation`. Unter `REPEATABLE READ` behielte die zweite Transaktion nach der
  Sperrwartezeit ihren alten Snapshot — die gesperrte Zeile wird nur gesperrt, nicht geändert, es
  gäbe also keinen Serialisierungsfehler — und die Korrektur würde still unwirksam.
- **Geänderte Dateien der Korrektur:** ausschließlich `app/src/lib/inventory-actions.ts` und
  `app/test/integration/ap14b-masterdata-inventory.int.mjs`. Migration `0015` und Smoke `21` blieben
  unverändert — die Korrekturen brauchten keine Datenbankänderung. Der Fall `II9` erwartet für den
  fremden Monteur jetzt den neutralen Verweistext, weil die Abweisung nicht mehr erst an der
  Insert-Policy (`42501`), sondern schon an der Vorgangssperre erfolgt. Neu sind die Fälle
  `II15`–`II19`.
- **Nachweise des Vorlaufs vor dem Codex-Review (von Claude selbst erhoben):** TypeScript
  `tsc --noEmit` Exit 0; ESLint Exit 0; Einheitentests 41/41 Exit 0; Next.js-Produktions-Build
  Exit 0; `git diff --check` Exit 0.
  Vollständiger lokaler PostgreSQL-18-Lauf über `run_ap14b_local.ps1 -TemporaryCluster` mit
  Prozess-Exitcode 0: Bootstrap, Migrationen `0001`–`0015`, Smokes 15–20 einschließlich 19a und der
  neue Smoke 21 mit 28 Erfolgsmeldungen und keiner FAIL-Meldung, Abschlusszeile
  `ERGEBNIS: AP10/AP11/AP12/AP13/AP14B DATENBANKTESTS ERFOLGREICH.`; Node-Integrationstests 30/30
  (Plattform) und 26/26 (Stammdaten und Inventar, damaliger Umfang vor den Reviewkorrekturen; der
  gültige Wert steht im folgenden Punkt), je 0 Fehlschläge. Der neue Smoke prüft unter
  `set role app_user` mit aktiver RLS und transaktionsgebundener Identität für Admin, Disposition,
  zugewiesenen und fremden Monteur: CRUD und Aktivierung für Bereitschaftsnummern, Kunden,
  Bauabschnitte, VzG-Strecken, Kontakte mit Telefonnummern und Zuordnung, Techniker, Teams mit
  Mitgliedschaft, Kabelarten und Anwendungseinstellungen; im Inventar Material, Lagerort,
  Bestandsliste, Bewegungsverlauf und alle Bewegungsarten einschließlich Negativmenge, Einheit aus
  dem Material, unzureichendem Bestand, unzulässiger Rolle, unveränderbarer Chronik, unverändertem
  Audit und Rollback nach einem Fehler im zweiten Teilschritt. Temporäres Cluster, temporäre
  Datenbank und Rolle wurden entfernt, der Port lauscht nicht mehr, und der vorhandene Dienst
  `postgresql-x64-18` blieb unverändert.
- **Nachweise des Korrekturlaufs (von Claude selbst erhoben):** TypeScript `tsc --noEmit` Exit 0;
  ESLint Exit 0; Einheitentests 41/41 Exit 0; `git diff --check` Exit 0;
  Next.js-Produktions-Build Exit 0. Vollständiger lokaler PostgreSQL-18-Lauf über
  `run_ap14b_local.ps1 -TemporaryCluster` mit Prozess-Exitcode 0: Migrationen `0001`–`0015`,
  Smokes 15–21 einschließlich 19a und 20, keine einzige `FAIL`-Meldung, Abschlusszeile
  `ERGEBNIS: AP10/AP11/AP12/AP13/AP14B DATENBANKTESTS ERFOLGREICH.`; Node-Integrationstests 30/30
  (Plattform) und 31/31 (Stammdaten und Inventar), je 0 Fehlschläge. Der Nebenläufigkeitsfall `II18`
  startet zwei Rückgaben über je die volle Restmenge gemeinsam über `Promise.all`: genau eine
  besteht, die zweite wird mit der unveränderten Restmengenmeldung und Restmenge 0 abgewiesen, und
  die Summe der Rückgaben überschreitet die entnommene Menge nicht. Temporäres Cluster, temporäre
  Datenbank und Rolle wurden entfernt, Port 55432 lauscht nicht mehr, der Dienst
  `postgresql-x64-18` blieb unverändert `Running`. In allen vier Zieldateien gibt es weiterhin null
  Supabase-Importe und null `supabase.`-Zugriffe; der frühere Worttreffer im Kommentar von
  `inventory-actions.ts` ist mit dem ersetzten Kommentar entfallen.
- **Unabhängige Verifikation und CI (2026-08-01, durch Codex erhoben — nicht von Claude selbst):**
  TypeScript Exit 0, ESLint Exit 0, 41/41 Einheitentests, Next.js-Produktions-Build Exit 0 und
  `git diff --check` Exit 0. Dazu ein vollständiger unabhängiger lokaler PostgreSQL-18-Lauf mit
  Exit 0: Migrationen `0001`–`0015`, Smokes 15–21 einschließlich 19a, 30/30
  Plattform-Integrationstests und 31/31 Stammdaten-/Inventar-Integrationstests einschließlich
  Rollen-Allowlist, fehlendem Material, fremdem Vorgang und echter Parallelrückgabe, mit
  vorhandener Abschlusszeile; temporäres Cluster, Datenbank, Rolle, Port und Arbeitsverzeichnis
  wurden nachweislich entfernt, der vorhandene PostgreSQL-Dienst blieb unverändert. **Die beiden
  durch Codex bestätigten Push-Läufe zu `79d8844`:** CI-Lauf `30677465341` completed/success und
  Container-Image-Lauf `30677465340` completed/success — `gh` ist auf diesem Rechner nicht
  installiert, Claude konnte die beiden Läufe nicht selbst abrufen.
- **Bewusst unverändert (keine RLS-Änderung):** keine Policy, View, Funktion und kein Trigger wurde
  angefasst; die Zeilensichtbarkeit bleibt Sache der bestehenden Policies. Zwei vorbestehende
  Eigenschaften bleiben damit ausdrücklich bestehen und sind **kein** Ergebnis dieser Umstellung:
  die AP9-Lesepolicy von `technicians`, `teams` und `team_members` lautet weiterhin „jede angemeldete
  Identität" — kein Anwendungspfad führt einen Monteur dorthin, weil die Stammdatenseiten
  staff-gesperrt sind; und `material_stock` bleibt eine Aggregat-View ohne `security_invoker`, sodass
  die Bestandsübersicht `/bestand` allen Rollen den Gesamtbestand zeigt (so in `0001_init.sql` unter
  der View-Definition begründet).
- **Ausdrücklich benannte Folge der neuen Leserechte:** die AP9-Lesepolicy selbst bleibt
  unverändert, ihre **Erreichbarkeit** für die Anwendungsrolle entsteht auf `technicians` und
  `teams` jedoch erst mit `0015`. Vorher besaß `app_user` auf diesen beiden Tabellen kein
  Tabellenrecht — geprüft gegen alle Migrationen `0001`–`0014` —, ein Lesezugriff scheiterte also
  schon in der Datenbank mit `42501`. Seit `0015` ist die einzige verbleibende Schranke gegen einen
  Monteur-Lesezugriff die Anwendungsschicht, nämlich die staff-gesperrten Stammdatenseiten. Das ist
  eine bewusste Folge der Umstellung und keine Policy-Änderung; ob diese Schranke ausreichen soll,
  ist eine fachliche Entscheidung und wird hier nicht getroffen.
- **Sichtbare Auswirkung:** keine GUI-, Layout-, Navigations- oder Interaktionsänderung. Einzige
  unvermeidbare Textfolge: wo eine Fehlermeldung bisher die rohe Datenbankmeldung interpolierte,
  steht jetzt ein neutraler Text hinter dem unveränderten Präfix.
- **Sichtbare Auswirkung der Reviewkorrekturen:** die Korrekturen führen **kein** neues
  Meldungsvokabular ein — beide Texte, die die neuen Vorprüfungen liefern („Verweis auf Material,
  Lager oder Vorgang ist ungültig." und „Material ist inaktiv."), bestanden bereits wörtlich und
  existieren als Konstante nur einmal. Geändert hat sich genau **ein** Fehlerpfad: buchte eine
  Identität auf einen Vorgang, der für sie nicht sichtbar ist (fremder Monteur), meldete die
  Anwendung bisher „keine Berechtigung." aus dem `SQLSTATE 42501` der Insert-Policy; jetzt greift
  vorher die Vorgangssperre und es erscheint derselbe neutrale Verweistext wie für einen nicht
  vorhandenen Vorgang. Das ist beabsichtigt: die Meldung soll keine Existenzaussage über fremde
  Vorgänge treffen. Keine GUI-Entscheidung erforderlich, weil kein sichtbarer Text neu gestaltet
  wurde.
- **Restpunkte, ausdrücklich nicht behoben (nicht blockierend, gehören in die Übergabe an Codex):**
  die nicht atomare Dublettenprüfung des Monteurimports — Abgleich und Insert liegen in zwei
  Transaktionen, die Eindeutigkeit greift nur auf `profile_id` — und die fehlende Ausführung der
  beiden Node-Integrationssuiten im Linux-CI-Skript `run_db_tests.sh`: dort läuft ausschließlich die
  SQL-Kette, was gleichermaßen für den bestehenden Plattformtest gilt und damit keine Regression ist.
  **Nachtrag 2026-08-09:** der zweite Restpunkt ist mit dem Commit `9aaebdf` erledigt —
  `run_db_tests.sh` startet neben der SQL-Kette fünf Node-Integrationssuiten (siehe Abschnitt
  „AP15-4/AP15-5“). Der erste Restpunkt bleibt unverändert offen.
- **Grenze:** Supabase bleibt ausschließlich für **Bilder und Uploads** sowie die dafür noch
  benötigten Clientdateien und Pakete in Betrieb. Der funktionale Restbestand unter `app/src` sind
  genau sieben Dateien — `lib/images-server.ts`, `lib/image-upload-core.ts`, `lib/image-actions.ts`,
  `app/api/images/upload/route.ts`, `lib/supabase/client.ts`, `lib/supabase/server.ts` und
  `lib/supabase/config.ts` — dazu `lib/database.types.ts` mit dem `Database`-Typ, den nur
  `client.ts` und `server.ts` importieren; weitere Nennungen in `app/src` sind reine Kommentar- oder
  Anzeigetexte und **kein** funktionaler Restbestand. Die Pakete `@supabase/ssr` und
  `@supabase/supabase-js` sind bewusst noch nicht entfernt, und CSP/`connect-src` nennen weiterhin
  Supabase. Browser-E2E wurden in
  diesem Paket **nicht** ausgeführt: der Diff berührt keine Route und keine Laufzeitabhängigkeit der
  `@public`-Tests. AP14 insgesamt bleibt offen (Browser-/Offline-Abnahme, CSP-Durchsetzung, MinIO,
  Betrieb und Deployment), V1 bleibt Produktionssperre, Branding bleibt separat, GUI-/Designarbeit
  wartet auf Dennis. **Nachtrag 2026-08-01:** diese Grenze ist mit dem gemergten Commit
  `edfafb4` aufgehoben — Clientdateien und Pakete sind dort entfernt,
  `lib/database.types.ts` bleibt (siehe folgender Abschnitt).

## AP14/B — Bilder und Uploads auf MinIO (2026-08-01, gemergt)

**Status:** technisch abgeschlossen und auf `main` gemergt. Fachlicher Commit
`edfafb482f6d4d95e69bd99e9b28c54ef7d92a87` (`feat: migrate incident images to MinIO`),
CI-Korrektur `cbe17b3c1bf9118ae3b36ef85353cce46aa7d8c9`
(`fix(ci): verify MinIO private anonymous state`); `main` = `origin/main` = `cbe17b3`.
Pull Request #5 ist geschlossen und gemergt. Der echte MinIO-Nachweis liegt vor: im PR-Lauf
`30691249168` sind `verify`, `database`, `container` und `objectstore` je `completed/success`,
wobei `objectstore` gegen einen echten MinIO-Container läuft. Abschließende main-Läufe: CI
`30692250157` mit allen vier Jobs `completed/success` und Container-Image `30692250154`
`completed/success`.
**Kein Tag, kein Release, keine Freigabe.** Die unten genannten Ergebnisse hat
Claude am jetzigen Endstand selbst erhoben.

- **Umfang:** Bilder und Uploads laufen auf PostgreSQL 18 mit RLS und einem privaten
  MinIO-/S3-Objektspeicher über AWS SDK v3 mit Path-Style. Damit ist Supabase auch im letzten
  Datenpfad abgelöst. Neu sind die server-only Module `app/src/lib/minio-config.ts` und
  `app/src/lib/minio-storage.ts`; der Objektspeicherzugriff gibt weder Client noch Konfiguration,
  Bucket oder Endpunkt heraus.
- **Konfigurationsprüfung:** `S3_PUBLIC_BASE_URL` ist eine eigene Pflichtvariable **ohne** Rückfall
  auf `S3_ENDPOINT`. Endpunkt und öffentliche Signierbasis werden als absolute http(s)-URL ohne
  Benutzerinfo, Query und Fragment geprüft; außerhalb von Loopback dürfen sie nicht denselben
  Origin haben; ist `AUTH_URL` gesetzt, muss die Signierbasis denselben Origin haben wie sie. Jede
  Ablehnung nennt ausschließlich Variablennamen, nie Werte.
- **Same-Origin-Proxygrenze:** die signierten Bild-URLs liegen unter dem Origin der Anwendung, der
  interne Reverse-Proxy routet den Bucket-Pfad auf den privaten MinIO-Dienst. Deshalb bleibt die
  CSP bei `img-src 'self'` und enthält **keine** Wildcard und keine fremde Herkunft. Die Route
  selbst ist eine noch **offene Anforderung an die interne IT**; es gibt keine echte Adresse.
- **Idempotenz fail-closed:** eine nicht kanonische, nicht leere `client_action_id` wird abgewiesen,
  **bevor** ein Objekt geschrieben oder die Datenbank berührt wird. Eine fehlende oder leere Kennung
  bleibt zulässig und läuft ohne Deduplizierung.
- **Rechtematrix (`0016_ap14b_image_grants.sql`):** genau drei Rechteanweisungen —
  `revoke update on public.incident_images from app_user;`,
  `grant insert on public.incident_images to app_user;` und
  `grant update (category, description, deleted_at, deleted_by) on public.incident_images to app_user;`.
  `update` ist damit spaltengenau auf die vier vom Produkt benötigten Spalten begrenzt; das
  vorangestellte `revoke` nimmt ausschließlich das Tabellenrecht zurück, das frühere Fassungen
  **dieser** Datei selbst erteilt hatten — kein Recht aus `0001`–`0015` wird angetastet. Weiterhin
  kein Recht an `public`, `anon` oder `authenticated`. **Warum spaltengenau:** die Policy `images_update` begrenzt keine Spalte;
  tabellenweites `update` hätte es einer berechtigten Identität erlaubt, `storage_path` einer
  Bildzeile auf den Objektschlüssel eines fremden Bildes zu setzen, und die Galerie signiert diesen
  Wert unverändert. Die Spaltenbegrenzung schließt diesen UPDATE-Weg; Smoke 22 belegt das mit
  echten, abgewiesenen UPDATE-Versuchen (Fälle G6 bis G12). **Offen bleibt der INSERT-Weg:**
  `insert` gilt weiterhin tabellenweit und damit auch auf `storage_path`. Per Rechtevergabe lässt
  sich dieser Weg nicht schließen, weil der Uploadpfad die Spalte schreiben muss; die Schranke dort
  ist eine **Anwendungsschranke** — die Anwendung berechnet den Objektschlüssel selbst und übernimmt
  ihn nie aus Eingabedaten — und damit schwächer als ein Datenbankrecht.
- **Objektlebenszyklus:** Soft-Delete entfernt kein Objekt. Presigned GET ist kurzlebig; einen
  presigned PUT im Browser gibt es nicht.
- **Supabase-Restbestand entfernt:** die drei Clientdateien unter `app/src/lib/supabase/` sind
  gelöscht, die Pakete `@supabase/ssr` und `@supabase/supabase-js` sind aus `package.json` und der
  Lockdatei entfernt. `app/src/lib/database.types.ts` **bleibt**: sie hat weiterhin drei echte
  Konsumenten für Hilfstypen.
- **Startprüfung des Containers:** verlangt jetzt `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` und die
  fünf S3-Pflichtnamen und verweigert den Start, wenn `SUPABASE_SERVICE_ROLE_KEY`,
  `NEXT_PUBLIC_SUPABASE_URL` oder `NEXT_PUBLIC_SUPABASE_ANON_KEY` gesetzt sind.
- **`deploy/compose.yml`:** ein privater `minio`-Dienst ohne Host-Port mit eigenem Volume,
  Healthcheck und interner Netzgrenze; die Webanwendung erhält **keine** MinIO-Root-Zugangsdaten.
  Einen Bootstrap-Dienst `minio-init` gibt es **nicht mehr** — er ist aus allen drei Compose-Dateien
  entfernt, weil `mc alias set` und `mc admin user add` Zugangsdaten als Prozessargumente übergaben
  und eine geheimnisfreie Variante in diesem Vault nicht nachweisbar war (keine Containerlaufzeit,
  kein `mc`, kein WSL — jeweils mit Exit-Code belegt). Bucket, Policy und Anwendungsidentität sind
  stattdessen ein verbindlicher, dokumentierter IT-Provisionierungsschritt vor dem ersten Start
  (`deploy/README.md`) mit ausdrücklicher Verifikationspflicht; die Least-Privilege-Policy bleibt
  als versionierte Datei `deploy/minio/incident-images-app.policy.json` prüfbar — genau
  `s3:GetObject`, `s3:PutObject` und `s3:DeleteObject` auf genau `arn:aws:s3:::incident-images/*`.
  **Das ist ein Rückschritt:** ohne die IT-Provisionierung startet die Anwendung gesund und jeder
  Bildupload scheitert erst zur Laufzeit — die Anwendung legt selbst keinen Bucket an und prüft
  seine Existenz beim Start nicht. Früher fiel das beim Start auf.

### Prüfergebnisse (von Claude selbst erhoben, 2026-08-01)

- TypeScript `tsc --noEmit`: Exit 0. ESLint: Exit 0, **154** Dateien geprüft, 0 Fehler, 0 Warnungen;
  die neue Datei `app/test/integration/ap14b-minio-live.int.mjs` ist von ESLint erfasst.
- Einheitentests: Exit 0, **67 Tests**, 67 bestanden, 0 fehlgeschlagen.
- Next.js-Produktions-Build: Exit 0, 33 Routen. `npm audit --omit=dev --audit-level=high`: Exit 0,
  `found 0 vulnerabilities`. `git diff --check`: Exit 0.
- Vollständiger lokaler PostgreSQL-18-Lauf gegen ein temporäres Cluster, Prozess-Exitcode 0:
  Bootstrap 01–03, Migrationen `0001`–`0016` und Smokes 15–22; **103** `SMOKE … OK`, **0** `FAIL`,
  0 Zeilen mit `ERROR`/`FATAL`/`PANIC`/`WARNING`; Abschlusszeile
  `ERGEBNIS: AP10/AP11/AP12/AP13/AP14B DATENBANKTESTS ERFOLGREICH.` Dieser Lauf wurde nach der
  letzten Änderung wiederholt und war deckungsgleich.
- Drei Integrationssuiten in demselben Lauf: 30/30, 31/31 und **37/37** für den Bildpfad,
  je 0 Fehlschläge. Die Bildsuite deckt unter anderem ab: Kompensation nach Datenbankfehler,
  verwaistes Objekt bei fehlgeschlagener Kompensation, zwei gleichzeitige Uploads mit derselben
  Kennung ergeben genau eine Zeile, Retry nach Komplettfehlschlag, Teilerfolg ohne Duplikat,
  fail-closed bei nicht kanonischer Kennung sowie unsignierte, falsch signierte und mit fremdem
  Zugriffsschlüssel ausgeführte PUT- und DELETE-Zugriffe mit je 403 und unverändertem
  Objektbestand.
- Supabase-Restsuche: null produktive Abhängigkeiten, null produktive Laufzeitvariablen, null
  `supabase.`-Zugriffe. Verbliebene Nennungen sind ausschließlich ausdrückliche Verbotsprüfungen
  und historische Texte bzw. der Verzeichnisname `app/supabase/`.
- Aufräumen nachgeprüft: kein Lauscher auf Port 55432, kein `kb_ap14b_*`-Verzeichnis im
  Temp-Bereich, der vorhandene Dienst `postgresql-x64-18` blieb unverändert `Running`.
- Strukturprüfung ersatzweise mit einem YAML-Parser, weil `docker compose config` mangels
  Containerlaufzeit nicht möglich ist: die drei Compose-Dateien und `.github/workflows/ci.yml`
  parsen; die Compose-Dienste sind genau `app`, `postgres`, `minio`; `.github/workflows/ci.yml` hat
  die Jobs `verify`, `database`, `container`, `objectstore`; die Policy-Datei ist gültiges JSON.
- **Unabhängig durch Codex am gemergten Stand erhoben:** TypeScript, ESLint, 67 Einheitentests,
  Produktions-Build und 21 `@public` Browser-/a11y-Tests; PostgreSQL 18 mit den Migrationen
  `0001`–`0016`, 103 Smokes ohne Fehler sowie die Integrationssuiten 30/30, 31/31 und 37/37; das
  temporäre Cluster wurde vollständig entfernt.

### Nachweisstand: erbracht und weiterhin offen

- **Der Lauf gegen ein echtes MinIO ist erbracht.** Der CI-Job `objectstore` startet einen echten
  MinIO-Container, versionsfest mit Tag **und** Digest referenziert, provisioniert ihn fail-closed
  und prüft über den Produktivcode `app/src/lib/minio-storage.ts` autorisiertes PUT, signiertes GET
  mit byteweisem Vergleich, DELETE sowie abgewiesene ungültige Signaturen; dazu die
  Rechtebegrenzung der Anwendungsidentität. Er ist im PR-Lauf `30691249168` und im main-Lauf
  `30692250157` je `completed/success`. In diesem Vault ist er weiterhin **nie gelaufen** — hier
  gibt es keine Containerlaufzeit; der Nachweis stammt ausschließlich aus GitHub Actions.
- Der lokale Bildpfad-Nachweis benutzt unverändert einen synthetischen S3-kompatiblen Testendpunkt
  im Arbeitsspeicher (`app/test/integration/s3-test-endpoint.mjs`). Dieser rechnet die
  SigV4-Signaturen von presigned GET sowie von PUT und DELETE kryptografisch nach, ist aber
  **kein MinIO** und gilt weiterhin **nicht** als MinIO-Nachweis; dafür steht allein `objectstore`.
- **AP14/B Bilder und MinIO ist damit technisch abgeschlossen und gemergt.** AP14 insgesamt bleibt
  offen.
- Auf dem Entwicklungsrechner ist weder `docker` noch `podman` vorhanden. Der Containerbetrieb und
  `docker compose config` für den erweiterten Stack konnten deshalb **nicht** ausgeführt werden; das
  Compose-Modell ist nur als YAML maschinell geparst und strukturell geprüft.
- Die `@public`-Browser-/a11y-Tests sind mit 21 Tests erbracht (unabhängig durch Codex ausgeführt).
  Die vollständige `@app`-/Offline-Abnahme im Browser steht weiterhin aus.
- Die Same-Origin-Route beim internen Reverse-Proxy ist eine offene IT-Anforderung; echte
  Endpunkte, Zugangsdaten, DNS- und Proxydaten liegen weiterhin nicht vor.
- Die CSP wird weiterhin nur als `Content-Security-Policy-Report-Only` ausgeliefert; die Umstellung
  auf die durchsetzende Variante ist eine eigene, im Browser zu verifizierende Entscheidung.
- V1 bleibt Produktionssperre; die Aufbewahrungsentscheidung ist offen.

## AP15-1 — RLS-gebundene Dashboard-Statuskennzahlen (2026-08-03, auf main)

- **Status:** Commit `8b65f4ed9c1175ddec3aca5045a5a59906b95c68` ist auf `main` und
  `origin/main`. CI `30800335370` (`verify`, `database`, `container`, `objectstore`) und
  Container-Image `30800335380` sind vollständig `completed/success`.
- `app/src/lib/incident-metrics.ts` liefert fünf Statuskennzahlen in genau einer
  `withUserTransaction()` und einer parametrisierten Abfrage über die
  `security_invoker`-View `public.incident_list_view`. Die offene Statusmenge stammt aus
  `TERMINAL_STATUS`; es gibt keine zweite Statusliste, keine Migration, kein neues Recht und
  keinen `SECURITY DEFINER`-Helfer. Das Dashboard verwendet diese Werte ohne sichtbare
  JSX-, Text-, Klassen- oder Reihenfolgeänderung. `/meine-einsaetze` blieb unverändert, weil
  dort keine Statuskennzahl existiert und eine Umstellung die sichtbare Listenstruktur
  betroffen hätte.
- **Unabhängig durch Codex verifiziert:** TypeScript und ESLint Exit 0, 97/97 Unit-Tests,
  Produktions-Build Exit 0, `git diff --check` Exit 0 sowie vollständiger PostgreSQL-18-Lauf
  mit Migrationen `0001`–`0017`, Smokes 15–24 und fünf Integrationssuiten
  (32/31/37/31/10 = 141/141, skipped 0). Temporäres Cluster, Datenbank, Rolle, Port und
  Arbeitsverzeichnis wurden entfernt.
- **Grenzen:** Kachelwerte und Listen stammen weiterhin aus getrennten Transaktionen und können
  bei einem gleichzeitigen Schreibvorgang kurzfristig um eins abweichen. `fehlalarm`-Semantik,
  Datumsgrenze der Tageskennzahlen, Listen-Vollmengen, sichtbare Aufgabenintegration und
  Dashboardgestaltung wurden nicht verändert. Nächster nicht-visueller Schritt ist die
  quellentreue Dokumentkonsolidierung; Archivierung oder Löschung benötigt einen gesondert
  belegten, verlustfreien Schnitt.

## AP15-2 — quellentreue operative Dokumentkonsolidierung (2026-08-03)

- **Abgeschlossen auf `main`:** Commit `40606eeea98baccf6192ad99d3ccac81fc7f0258`.
  CI `30814390705` mit `verify`, `database`, `container` und `objectstore` sowie
  Container-Image `30814390702` sind `completed/success`.

- **Umfang:** sechs Dokumente auf den belegten Ist-Stand gebracht — `README.md`, `app/README.md`,
  `app/supabase/README.md`, `07-Betrieb/BETRIEB.md`, `07-Betrieb/BACKUP_UND_RECOVERY.md` und
  `00-Projektsteuerung/CHANGELOG.md`. **Keine Produktänderung**, keine Archivierung, keine
  Umbenennung, keine Löschung; `app/supabase/` bleibt als historischer Pfadname erhalten.
- Die überholten Supabase-, Migrations- und Testaussagen sind ersetzt: Migrationsstand überall
  `0001`–`0017`, Supabase erscheint nur noch als historischer Altstand, historischer Pfadname oder
  verbotener Variablenname. Der Changelog erhielt **append-only** neun nachgetragene Einträge
  (AP12 bis AP15-1) oberhalb der unveränderten Historie.
- `BETRIEB.md` trennt belegte lokale und CI-Wege ausdrücklich vom **nicht ausgeführten**
  produktiven Deployment. `BACKUP_UND_RECOVERY.md` ersetzt die Supabase-Zielannahme durch
  PostgreSQL 18 und MinIO, führt Datenbank- und Objektstand als gemeinsam zu sichernde Einheit
  (`incident_images.storage_path`) und hält fest, dass für den Objektspeicher **kein**
  Sicherungsverfahren existiert und **kein** Recovery-Test stattgefunden hat. Keine
  Aufbewahrungsfrist, kein bestätigtes RPO/RTO.
- **Nachweise (von Claude selbst erhoben):** `git diff --check` Exit 0; Diffumfang exakt acht
  versionierte Dateien — die sechs operativen Kerndokumente plus die Abschlussnotizen in
  `PROJEKT_WISSEN.md` und `PROJEKTSTATUS.md` selbst; der Changelog-Diff ist ein einziger
  Einfügehunk (`@@ -7,0 +8,212 @@`) mit **null** entfernten Zeilen, die Historie also bytegleich;
  alle referenzierten Pfade per `git ls-files` vorhanden. Es wurde **kein** Test-, Build- oder
  Datenbanklauf ausgeführt — dieser Schritt ändert keinen Code.
- **In der Prüfung korrigierte Sachfehler:** die Runner wenden Migrationen und Smokes
  **verschränkt** und nicht sequenziell an (die Verschränkung ist zwingend, sonst scheitern die
  Negativfälle aus `20_ap14b_data.sql`); die **Migrationskette** ist wegen `0013` **nicht durchgehend
  additiv**, während `19a` (`app/supabase/test/19a_ap14b_grant_reset.sql`) eine **Testdatei** und
  keine Migration ist und die zwingende Reihenfolge beziehungsweise Verschränkung des Testlaufs
  belegt, nicht die Additivität einer Migration; `0002_storage.sql` trägt keine AP-Nummer (AP2 ist `0003`); `0017` enthält **vier**
  Audittrigger; der JWT trägt an Nutzdaten nur `sub` und `sid`, Auth.js ergänzt `iat`, `exp`
  und `jti`.
- **Provenienz der AP14B-CI-Kennungen (geklärt, kein Widerspruch):** es gibt zwei aufeinanderfolgende
  grüne Commitstände. Zum Fachstand `530a1f0` (2026-08-03 08:39:47 +0200) gehören CI `30790933496` und
  Container-Image `30790933449`; zum nachfolgenden Dokumentationsstand `a86d7a6` (2026-08-03 08:45:06
  +0200) gehören CI `30791223313` und Container-Image `30791223304` — jeweils `completed/success`.
  `530a1f0` ist Vorfahr von `a86d7a6` (`git merge-base --is-ancestor` Exit 0, von Claude selbst erhoben).
  Die operative Statusdatei `.claude/automation/status/fortschritt.json` nennt zutreffend das spätere
  Paar; der Dateistand von `a86d7a6` hielt im Text noch das frühere fest. Die Laufergebnisse selbst hat
  Codex über die GitHub-API erhoben; Claude hat sie nicht selbst abgerufen.
- **Weiterhin offen und ausdrücklich nicht behauptet:** produktives Deployment, Restore, DNS,
  Reverse-Proxy-Route, MinIO-Provisionierung, Browser-/Offline-Abnahme, Aufbewahrungsfristen,
  RC1, Tag, Release und die V1-Entscheidung. `deploy/README.md` nannte zum Stand von AP15-2
  weiterhin „0001…0016" und war damit überholt — **mit AP15-3 behoben** (siehe Abschnitt „AP15-3").

## AP15-3 — Runtime- und CI-Wahrheit konsolidiert (2026-08-03, ergänzt 2026-08-08, gepusht als `0f3d0bd`, korrigiert mit `47704e0`)

- **Umfang:** vier versionierte Dateien — `deploy/README.md`, `app/.env.example`,
  `.github/workflows/ci.yml` und `deploy/scripts/rollback.sh` (dort nur der Kopfkommentar) — plus
  die Abschlussnotizen in `PROJEKT_WISSEN.md` und `PROJEKTSTATUS.md`. Keine Änderung an Produktcode,
  SQL, Migrationen, RLS, Compose, `Dockerfile` oder Tests; in `rollback.sh` ist ausschließlich
  Kommentartext geändert, alle ausführbaren Zeilen bleiben bytegleich. Nichts archiviert,
  umbenannt, verschoben oder gelöscht.
- **`deploy/README.md`:** Die Migrationen stehen jetzt als 17 versionierte Dateien `0001`–`0017` in
  fester Anwendungsreihenfolge, ohne Pauschalaussage zu Additivität oder Idempotenz. Die überholte
  Aussage „die CI führt keine Migrationen aus" ist richtiggestellt: der CI-Job `database` wendet
  gegen eine leere, temporäre Testdatenbank zuerst die drei versionierten Bootstrap-Dateien aus
  `app/supabase/bootstrap/` und danach die Migrationen `0001`–`0017` in der vom Runner
  festgelegten, mit den Smokes verschränkten Reihenfolge an — Bootstrap getrennt von der
  nummerierten Migrationskette —, während Containerstart und produktives Deployment keine Migration
  ausführen. Ebenso richtiggestellt: die Startprüfung erzwingt nur Anwesenheit und Nichtleere der
  Pflichtvariablen, nicht ihr Format — ein Platzhalter in `DATABASE_URL`, `AUTH_SECRET` oder
  `AUTH_URL` fällt beim Start nicht auf.
- **`deploy/scripts/rollback.sh`:** Der Kopfkommentar behauptete, die Migrationen des Projekts seien
  additiv. Er sagt jetzt quellentreu: das Rollback betrifft ausschließlich das Anwendungs-Image, das
  Datenbankschema wird nicht zurückgesetzt, Rückwärtsmigrationen sind nicht vorgesehen und die Kette
  ist nicht rückspielbar; bei Schema-Inkompatibilität ist ein Forward-Fix erforderlich. Nur
  Kommentartext, keine ausführbare Zeile.
- **`app/.env.example`:** eine auskommentierte Zeile `# AUTH_URL=http://localhost:3000` mit wahrer
  Einordnung — im Containerbetrieb Pflicht (Startabbruch mit Exit-Code 78), lokal optional; ist sie
  gesetzt, muss `S3_PUBLIC_BASE_URL` denselben Origin haben. Keine echte interne Adresse.
- **`.github/workflows/ci.yml`:** ein neuer Schritt „Unit-Tests (hartes Gate)" mit
  `npm run test:unit` im Job `verify`, ohne `continue-on-error`. Die vorhandenen Unit-Tests laufen
  damit erstmals in der CI; im Lauf `31273906163` ist dieser Schritt auf dem Runner
  `completed/success` (durch Codex berichtet). Kein Test, kein Job und kein npm-Skript geändert.
- **Betriebsgrenzen, unverändert offen:** CI-Prüfungen sind kein Nachweis einer produktiven
  Umgebung und kein Nachweis der echten Reverse-Proxy-Route. Offen bleiben die produktive
  MinIO-Provisionierung, Sicherung und Recovery der Objektdaten, der Healthcheck des
  Compose-Dienstes `minio`, die Endpunkte der internen IT und die signierte GET-URL im Browser.
- **Nachweise, von Claude selbst lokal erhoben:** Unit-Tests 97/97 Exit 0 (`fail 0`, `skipped 0`),
  TypeScript Exit 0, ESLint Exit 0, Produktions-Build Exit 0, `git diff --check` Exit 0 — diese vier
  App-Gates stammen aus dem Korrekturlauf vom 2026-08-03; die Ergänzung vom 2026-08-08 ändert nur
  Dokumentation und einen Kommentar. Im Lauf vom 2026-08-08 zusätzlich erhoben:
  `bash -n deploy/scripts/rollback.sh` Exit 0 und der mechanische Vergleich der ausführbaren Zeilen
  von `rollback.sh` gegen `HEAD` ohne Unterschied (Kommentare und Leerzeilen ausgeschlossen). Kein
  Datenbank-, Docker-, Compose-, MinIO- oder Playwright-Lauf ausgeführt und keiner behauptet.
- **GitHub-CI zu AP15-3 (2026-08-08).** Der Commit `0f3d0bdba30934ac503dde766789e602b0225529`
  (`chore(ci): align AP15-3 runtime truth`) ist auf `main` gepusht. Container-Image `31273906147`
  ist `completed/success`; im CI-Lauf `31273906163` sind `database`, `container` und `objectstore`
  `completed/success`, der Job `verify` ist **rot** im Schritt
  `npm audit --audit-level=high --omit=dev`: `nanoid <3.3.17`, Severity high, GHSA-2v37-7h3g-55p8,
  Pfad `node_modules/postcss/node_modules/nanoid`. Innerhalb dieses roten Jobs sind die vorgelagerten
  Schritte grün: `Unit-Tests (hartes Gate)` ist `completed/success` (19:14:36Z–19:14:38Z), ebenso
  Lint, TypeScript, Service-Worker-Syntax und Build. Der Job `verify` blieb allein deshalb rot, weil
  erst der nachfolgende harte Schritt `Audit Produktion (high/critical als Gate)` scheiterte; der
  informative Dev-Audit und die Playwright-Schritte wurden danach übersprungen. Das mit AP15-3
  eingeführte Unit-Test-Gate ist damit auf dem Runner belegt. Dieser Lauf bleibt der zunächst rote
  Produktionsaudit-Lauf des Featurecommits; der vollständig grüne Gesamtlauf folgte erst mit dem
  Korrekturcommit `47704e0` (siehe „Grüner CI-Folgelauf"). Die Schritt-, Zeit-, Lauf- und
  Jobangaben sind durch Codex berichtet und von Claude nicht selbst abgerufen.
- **Korrektur des Produktionsaudits (2026-08-08, committet als `47704e0`).** Einzige geänderte
  Abhängigkeitsdatei ist `app/package-lock.json`; `app/package.json` ist bitgleich zu `HEAD`. Unter
  dem bestehenden Override `postcss 8.5.24` löst nanoid jetzt auf `3.3.18` statt `3.3.16` auf —
  innerhalb der von PostCSS deklarierten Range `^3.3.16`, ohne neue direkte Abhängigkeit und ohne
  neuen Override. Erzeugt mit `npm update nanoid --package-lock-only --ignore-scripts` (Exit 0);
  aus dem HEAD-Stand wiederholt ausgeführt ergibt sich derselbe Blob `1e973c34`. Nachweise, von
  Claude selbst erhoben: `npm ci --ignore-scripts` Exit 0 ohne Lockfile-Änderung,
  `npm ls nanoid postcss --omit=dev --all` Exit 0 mit
  `next@16.2.12 -> postcss@8.5.24 (overridden) -> nanoid@3.3.18`,
  `npm audit --audit-level=high --omit=dev` Exit 0 (`found 0 vulnerabilities`), Unit-Tests 97/97
  Exit 0 (`fail 0`, `skipped 0`), TypeScript Exit 0, ESLint Exit 0, Produktions-Build Exit 0,
  `git diff --check` Exit 0. Diese Nachweise stammen aus dem lokalen Korrekturlauf vor dem Commit.
- **Nebenbefund im Lockfile-Diff.** Neben der nanoid-Auflösung entfernt npm 11.13.0 fünf
  versionslose `dev`/`optional`-Stub-Einträge (`@emnapi/core`, `@emnapi/runtime`,
  `@napi-rs/wasm-runtime`, `@tybys/wasm-util`, `tslib`). Das ist kein Paketupdate: ein Kontrolllauf
  `npm install --package-lock-only --ignore-scripts` **ohne** nanoid-Update entfernt dieselben fünf
  Einträge. Kein weiteres Paket ändert Version, `resolved` oder `integrity`. Der dev-Audit
  `npm audit --audit-level=high` bleibt lokal Exit 1 (`brace-expansion`, `js-yaml`, beide nur unter
  `eslint`/`minimatch`); dieser Schritt ist in `.github/workflows/ci.yml` ausdrücklich informativ
  und mit `continue-on-error: true` versehen und blockiert die CI nicht.
- **Grüner CI-Folgelauf (2026-08-08).** Zum Korrekturcommit
  `47704e027371fe4a0c0b70c579ee26f09756029a` (`fix(deps): update transitive nanoid`) auf `main` ist
  der CI-Lauf `31276526201` `completed/success`; alle vier Jobs sind `completed/success`: `verify`
  (`93150848358`), `database` (`93150848347`), `container` (`93150848324`) und `objectstore`
  (`93150848342`). Der Container-Image-Lauf `31276526192` ist ebenfalls `completed/success`. Damit
  ist AP15-3 technisch abgeschlossen. Die Lauf- und Jobkennungen sind durch Codex berichtet und von
  Claude nicht selbst abgerufen; lokal belegt hat Claude nur, dass `47704e02` der HEAD von `main`
  ist und `app/package-lock.json` mit nanoid `3.3.18` enthält. Der informative dev-Audit bleibt
  unverändert Exit 1 und ist kein CI-Gate. Commit und Push erfolgten außerhalb dieses
  Claude-Laufs; kein Merge, kein Tag, kein Release, keine RC1- oder V1-Freigabe. AP14
  Betrieb/Abnahme, die sichtbare GUI und die V1-Entscheidung bleiben unverändert offen.

## AP15-4/AP15-5 — fünf PostgreSQL-Suiten als Linux-CI-Gate (2026-08-08/09, auf `main` als `9aaebdf`)

- **Auditbefund AP15-4 (read-only, keine Datei geändert).** Die frühere Aussage, im
  Linux-Runner `app/supabase/test/run_db_tests.sh` laufe nur die Admin-Suite, war überholt: er
  startete bereits `ap14b-admin-users` und `ap15-dashboard-metrics`. Ausschließlich lokal liefen
  `ap14b-platform`, `ap14b-masterdata-inventory` und `ap14b-images`; diese drei kannten zudem keinen
  Pflichtmodus und endeten bei fehlenden Verbindungsvariablen still mit Exit-Code 0.
- **Umfang AP15-5.** Commit `9aaebdf7df0f76b5d80d1e39801e42480ac82b37`
  (`test(ci): gate all postgres integration suites`) auf `main`, zwölf Dateien:
  `.github/workflows/ci.yml`, `app/supabase/test/run_db_tests.sh`, die vier Suiten
  `ap14b-platform`, `ap14b-masterdata-inventory`, `ap14b-images` und `ap14b-admin-users`,
  `app/test/integration/module-hooks-app.mjs` sowie fünf Auftragsdateien unter
  `.claude/automation/tasks/`. Den Pflichtmodus erhielten die ersten drei Suiten; in
  `ap14b-admin-users` und `module-hooks-app.mjs` ist ausschließlich Kommentartext geändert. Kein
  Produktcode, keine Migration, kein Paket, kein Lockfile, kein neuer Job und kein Secret.
- **Verhalten.** Der bestehende CI-Job `database` führt die fünf Suiten in fester Reihenfolge aus:
  `ap14b-platform` → `ap14b-masterdata-inventory` → `ap14b-images` → `ap14b-admin-users` →
  `ap15-dashboard-metrics`. Jede läuft in einem eigenen Prozessblock mit
  `AP14B_REQUIRE_INTEGRATION=1` und beendet den Runner fail-closed, bevor die nächste Suite startet.
  Die Stellung der Plattformsuite an erster Stelle ist gekoppelt: ihr Fall I13 sichert
  `usableAdminCount() == 0` als Ausgangslage zu, und die Admin-Fixtures der
  Benutzerverwaltungssuite würden dort mitgezählt.
- **Abgrenzung MinIO.** Die Bildsuite läuft gegen den prozessinternen synthetischen S3-Endpunkt
  `app/test/integration/s3-test-endpoint.mjs`, ausdrücklich **kein** MinIO-Ersatz. Der echte
  MinIO-Nachweis bleibt allein der getrennte Job `objectstore`.
- **Historische Smokes.** `00_stub_auth_storage.sql` und die Präfixe `10` bis `14` bleiben
  unverändert als Historienevidence und werden **nicht** in die aktuelle CI-Kette aufgenommen; sie
  sind gegen die heutige Kette nicht lauffähig. Keine Löschung, keine Archivierung, keine
  Umbenennung. Im Job `database` laufen `15` bis `24` samt Bootstrap und Migrationen `0001`–`0017`.
- **Nachweise, von Claude im AP15-5-Lauf selbst lokal erhoben (Windows, PostgreSQL 18.4,
  temporäres Wegwerfcluster).** Die gesamte SQL-Kette lief ohne eine einzige `SMOKE … FAIL`-Zeile;
  die fünf Suiten ergaben 32 + 31 + 37 + 31 + 10 = **141/141**, `fail 0`, `skipped 0`, Exit 0.
  Temporäres Cluster, Datenbank, Rolle, Port und Artefakte wurden restlos entfernt, der Dienst
  `postgresql-x64-18` blieb unangetastet. Statisch und unabhängig von Codex: Shell- und
  Node-Syntax sowie `git diff --check` je Exit 0; fünf Suitenaufrufe genau einmal und in der
  belegten Reihenfolge; fünf Pflichtmodus-Zuweisungen; drei Pflichtmodus-Negativläufe Exit 1, deren
  Meldung ausschließlich Variablennamen nennt; dieselben drei Suiten ohne Pflichtmodus Exit 0 und
  vollständig übersprungen.
- **GitHub-CI zu `9aaebdf` (durch Codex berichtet, von Claude nicht selbst abgerufen).** Der
  CI-Lauf `31282034577` ist `completed/success` mit allen vier Jobs `verify` (`93164818889`),
  `objectstore` (`93164818903`), `database` (`93164818909`) und `container` (`93164818928`), je
  `completed/success`; der Container-Image-Lauf `31282034552` ist ebenfalls `completed/success`.
- **Grenzen.** Der lokale Nachweis ist ein Windows-Nachweis und ersetzt den Linux-Runner nicht; er
  belegt weder MinIO-Betrieb noch eine produktive Umgebung. `shellcheck` ist auf dem Arbeitsrechner
  nicht installiert und wurde nicht ausgeführt. Offen bleiben die verbliebenen AP15-Fachbefunde
  (`fehlalarm`-Semantik, Datumsherkunft und Tagesgrenze der Tageskennzahlen, Filteroptionen in drei
  Transaktionen, Vollmengen-Reads der Listen), AP14 Betrieb und Abnahme, echte IT-Endpunkte und
  Reverse-Proxy-Route, Browser-/Offline-Abnahme, CSP-Auswertung, RC1, V1, Tag und Release. Commit
  und Push erfolgten außerhalb dieses Claude-Laufs; kein Merge, kein Tag, kein Release, keine RC1-
  oder V1-Freigabe.

## AP15-b — Fehlalarm-Semantik, Datumsgrenze, Filteroptionen, Vollmengen-Export (2026-08-11, Korrekturlauf F1/F2/F5 am 2026-08-12, uncommitted)

- **Auftrag (wörtlich, 2026-08-11):** „Bearbeite ausschließlich AP15-b: Fehlalarm-Semantik,
  Datumsherkunft/Tagesgrenze, Filteroptionen und Vollmengen-Export-Pfad. Keine Änderungen an
  Auth-/Deployment-Grundarchitektur, Repository-Sichtbarkeit, Release-Status oder fremden
  uncommitteten Dateien. Vorhandene Änderungen unter `.claude/agents` und `run-*.ps1` nicht
  anfassen. Tests und Evidence je Teilaufgabe dokumentieren. Stoppen, sobald DoD erfüllt oder
  eine fachliche Entscheidung fehlt; nicht committen, pushen oder orchestrieren.“ Damit sind
  genau die vier in AP15-1/AP15-5 als offen benannten Fachbefunde bearbeitet
  (`fehlalarm`-Semantik, Datumsherkunft/Tagesgrenze der Tageskennzahlen, Filteroptionen in den
  drei Transaktionen, Vollmengen-Reads der Listen).
- **Status:** Ausschließlich lokale, uncommittete Änderungen im Arbeitsbaum. Kein `git commit`,
  kein `git push`, kein Aufruf von `.claude/agents`/Orchestrierung. `.claude/agents/kb-*.md` und
  `run-*.ps1` unverändert gelassen.

**a) Fehlalarm-Semantik**
- Neue Spalte `public.incidents.is_false_alarm boolean not null default false`
  (`app/supabase/migrations/0018_ap15b_incident_metrics.sql`, additiv zu 0001–0017). Die
  Spaltenanlage ist **idempotent**: Abschnitt 1 der Migration stellt `NOT NULL DEFAULT false` über
  die Folge 1a–1e her (`drop trigger if exists`, `add column if not exists`, `set default`,
  Backfill der verbliebenen NULL-Werte, `set not null`) und führt damit auch auf einem
  vorveränderten Schema zum Zielzustand. Grund: `add column if not exists` wird vollständig
  übersprungen, sobald die Spalte aus einem Vorlauf bereits existiert — lag sie dort nullable und
  ohne Default vor, wurden `NOT NULL` und Default gerade nicht nachgezogen.
- Waechter `tg_incident_guard_false_alarm` als **BEFORE INSERT OR UPDATE** (SQLSTATE `42501`), da
  RLS selbst nicht spaltengranular ist (`incidents_update` erlaubt weiterhin `is_staff()` ODER dem
  zugewiesenen Monteur das UPDATE der Zeile als Ganzes) — gleiches Muster wie
  `tg_protect_profile_active_admin` (0017). Nur `before update` ließ einen `admin` die
  Kennzeichnung bei der ANLAGE setzen und die Disponent-Regel damit über den Anlageweg umgehen;
  der INSERT-Zweig lässt eine Anlage ohne bzw. mit `false` für jede Rolle durch, damit die
  Vorgangsanlage nicht bricht.
- `public.incident_list_view` um `is_false_alarm` ergänzt (vollständige Neudefinition, keine
  bestehende Spalte entfernt/verschoben).
- Neue Funktion `setIncidentFalseAlarm(incidentId, value)` in `app/src/lib/incidents.ts`
  (parametrisiertes UPDATE, `42501` → freundliche Meldung). In der operativen Liste ist der neue
  Fehlalarm-Filter jetzt auch sichtbar verdrahtet; der Wert reist über `fehlalarm=1|0` in die
  bestehende Query-/Export-Kette.
- **Offene fachliche Entscheidung (nicht geraten, wörtlich umgesetzt):** der Auftrag sagt „nur
  die Disponent-Rolle“ — das schließt `admin` aus und weicht von der sonst durchgängigen
  `is_staff()`-Konvention (admin+disponent) ab. Der Waechter prüft exakt
  `current_user_role() = 'disponent'`, nicht `is_staff()`. Falls `admin` ebenfalls berechtigt sein
  soll, ist das eine gesonderte Entscheidung und erfordert eine Anpassung der Migration.

**b) Datumsherkunft & Tagesgrenze**
- Neu: `app/src/lib/date-local.ts` (`startOfTodayBerlin()`/`startOfTodayBerlinIso()`),
  zeitzonenfeste Berechnung der Europe/Berlin-Mitternacht ohne externe tz-Bibliothek
  (`Intl.DateTimeFormat`, Selbstkorrektur bei Sommer-/Winterzeit-Wechsel am Referenztag).
- Verdrahtet in `app/src/app/(app)/dashboard/page.tsx` (ersetzt die lokale
  `startOfToday()`/`setHours(0,0,0,0)`, betrifft „Heute übernommen“ und „Heute erstellt“) und in
  `app/src/lib/images-server.ts` (`getTodaysImageCount()`, „Heute hochgeladene Bilder“) — beide
  liefen bisher auf Mitternacht in der Zeitzone des Node-Prozesses statt Europe/Berlin.
  `incident_list_view.created_date_local` war bereits korrekt (0009) und blieb unverändert.
- `app/test/ap15b-date-local.test.mjs`: 7 auf 8 Fälle erweitert. Zwei ursprüngliche
  Testerwartungen waren fehlerhaft (verwechselten „Start des laufenden Kalendertags“ mit „Start
  des folgenden Tages“) und wurden korrigiert; die Implementierung war in beiden Fällen bereits
  richtig. Ein zusätzlicher Fall deckt jetzt den tatsächlichen Sommerzeit-Wechsel ab (Referenz
  NACH der Umstellung am 2026-03-29, Mitternacht des Tages lag davor) — genau der Zweig, den die
  Selbstkorrektur in `startOfTodayBerlin()` behandelt und den die ursprünglichen 7 Fälle nicht
  auslösten.
- Neu ergänzt: `app/test/ap15b-incident-list-url.test.mjs` mit reinem URL-Mapping für
  `fehlalarm=1|0` sowie Roundtrip gegen `buildIncidentListQueryString()`.

**c) Filteroptionen**
- Datumsfilter (`date_from`/`date_to`) bestanden bereits korrekt gegen `created_date_local` — keine
  Änderung nötig.
- Neu: Fehlalarm-Statusfilter `falseAlarm?: boolean` in `IncidentListFilters`
  (`app/src/lib/incident-list.ts`), URL-Parameter `fehlalarm=1|0`
  (`app/src/lib/incident-list-url.ts`), SQL-Bedingung in `fetchList()`
  (`app/src/lib/incidents.ts`) — wirkt dadurch automatisch in allen drei Transaktionen
  (`listIncidentsPaged`, `listIncidentsForExport`, neu `listIncidentsForFullExport`).

**d) Vollmengen-Export-Pfad**
- Neue Konstante `INCIDENT_FULL_EXPORT_CAP = 20000` (`incident-list.ts`); die interaktive
  UI (`exportIncidentList`/`listIncidentsForExport`) bleibt unverändert bei `INCIDENT_EXPORT_CAP`
  (5000).
- Neue Funktion `listIncidentsForFullExport()` (`incidents.ts`) und Server-Action
  `exportIncidentListFull()` (`incident-list-actions.ts`), Rollenprüfung (kein Monteur) wie beim
  bestehenden Export. CSV-Spalten beider Exporte um „Fehlalarm“ ergänzt (additiv am Ende), damit
  der neue Filter im Export auch sichtbar ist.

**Nachweise des ursprünglichen Laufs vom 2026-08-11 (von Claude selbst im Device-Bridge-Sandbox
erhoben, kein Netz, kein lokaler Postgres-Client):**
- `node --test` auf `app/test/ap15b-date-local.test.mjs` ist in dieser Sandbox aktuell
  umgebungsbedingt blockiert (`spawn EPERM`), obwohl die zugrundeliegende Funktion direkt per
  Modulaufruf verifiziert werden konnte. Der Blocker liegt also im Test-Harness bzw. der Sandbox,
  nicht in der Logik selbst.
- `npm run typecheck` läuft jetzt in der lokalen PowerShell sauber, weil `app/package.json`
  auf explizite `node ./node_modules/typescript/bin/tsc --noEmit --incremental false` umgestellt
  wurde; dieselbe Umstellung gilt fuer `npm run lint` mit `node ./node_modules/eslint/bin/eslint.js`.
- `node --input-type=module` mit direkter Funktionsprüfung der `date-local`-Fälle: `AP15B_DATE_LOCAL_OK`.
- `node --input-type=module` zur URL-Kette (`parseIncidentListQuery`/`buildIncidentListQueryString`)
  konnte wegen `@/lib`-Aliasauflösung ohne Test-Harness in dieser Sandbox nicht direkt verwendet
  werden; dafür liegt jetzt ein dedizierter Unit-Test vor (`ap15b-incident-list-url.test.mjs`).
- `node ./node_modules/eslint/bin/eslint.js` lief auf den geänderten Dateien grün; auch
  `npm run lint` ist nach der Script-Umstellung wieder grün.
- `npm run test` laeuft in dieser lokalen PowerShell jetzt ebenfalls gruen (Typecheck + Lint +
  108/108 Unit-Tests, ohne DB-Runner).
- `node --test` auf `app/test/ap15b-date-local.test.mjs` bleibt in dieser Sandbox umgebungsbedingt
  blockiert (`spawn EPERM`).
- **Am 2026-08-11 nicht verifizierbar (kein Netz, kein psql):** tatsächliches DB-Verhalten der
  neuen Migration 0018 (Spalte, Waechter-Trigger, View-Neudefinition), Korrektheit des neuen
  Fehlalarm-Filters gegen echte Daten, vollständiger Lauf des Vollmengen-Exports gegen eine echte
  Treffermenge > 5000 Zeilen. Diese Lücke ist mit dem Korrekturlauf geschlossen (nächster Block);
  die damalige Empfehlung, die Datenbanksuite vor einem Merge laufen zu lassen, ist damit erledigt.

**Korrekturlauf AP15-b (2026-08-12, weiterhin uncommitted) — Aufnahme in die Prüfketten**
- Migration `0018` und der neue SQL-Smoke `app/supabase/test/25_ap15b_incident_metrics.sql`
  (Fallkennung `W`) stehen jetzt in der Kette **beider** Läufer (`app/supabase/test/run_db_tests.sh`
  und das Windows-Gegenstück `run_ap14b_local.ps1`) — und zwar HINTER
  `24_ap15_dashboard_metrics.sql`, damit 24 der letzte absolut zählende Eintrag der Kette bleibt,
  sowie die Migration unmittelbar VOR ihrem Smoke (dieselbe Konvention wie 0015/21, 0016/22,
  0017/23). Der CI-Schrittname nennt beide: „Datenbankpruefungen (Migrationen 0001-0018, Smokes
  15-25, sechs Integrationssuiten)“ (`.github/workflows/ci.yml`).
- Neu ist die **sechste** Integrationssuite `app/test/integration/ap15b-incident-list.int.mjs`
  (Fehlalarmpfad in `src/lib/incidents.ts`, Vollmengen-Export in
  `src/lib/incident-list-actions.ts`), an derselben Steuerung `AP14B_INTEGRATION` wie die fünf
  bisherigen. Sie läuft ausdrücklich als LETZTE, und der Grund liegt in ihren Fixtures: sie legt
  zum Nachweis der Vollmengengrenze `INCIDENT_FULL_EXPORT_CAP + 1` Vorgänge an, und diese Zeilen
  samt abgeleiteten Aufgabenzeilen überdauern den Lauf, weil `public.incidents` wegen der
  unbedingten Löschsperre `trg_incident_tasks_no_delete` (0011) nicht per DELETE aufgeräumt werden
  kann. Jede Suite, die über die GESAMTE sichtbare Menge zählt — namentlich
  `ap15-dashboard-metrics.int.mjs` —, würde dadurch deutlich langsamer.

**Messwerte des Korrekturlaufs (von Claude selbst erhoben, in temporären
`postgres:18`-Wegwerfcontainern gegen PostgreSQL 18.4 (Debian 18.4-1.pgdg13+1)):**
- Vollständiger Lauf des echten Läufers `run_db_tests.sh` mit `AP14B_INTEGRATION=require` auf einem
  FRISCHEN Container: **Exit 0**, Gesamtdauer **32 Sekunden**, **33 Kettendateien**, **391** Zeilen
  `SMOKE … OK`, **0** Zeilen `SMOKE … FAIL`, **alle sechs** Integrationssuiten ausgeführt.
- Der neue SQL-Smoke `25_ap15b_incident_metrics.sql` liefert **16 Fälle** (`W-FIXTURES`, `W1`–`W14`,
  `W-ENDE`), alle OK.
- Die neue Integrationssuite `ap15b-incident-list.int.mjs` liefert **11 von 11** Fällen (`L1`–`L11`),
  `fail 0`, `skipped 0`.
- Vollmengenfixture: **20001** Vorgänge in EINEM Bulk-INSERT in **10,3 Sekunden**; Aufräumbilanz
  danach 20006 Vorgänge und 60018 Aufgabenzeilen mit dem Präfix `26a00000-`, die mit der
  Testdatenbank entfallen.
- **F1 gegengeprüft:** gegen die Migration im Stand VOR der Korrektur schlägt Fall `W2` fehl
  (Exit 3, Meldung „attnotnull=false, atthasdef=false, default=NULL - erwartet true/true/false“).
  Der Regressionstest bemerkt eine Rückkehr des Befunds also tatsächlich.
- **F2 gegengeprüft:** gegen einen Waechter, der INSERTs durchlässt, schlägt Fall `W5` fehl
  (Exit 3, Meldung „der Administrator hat einen Vorgang MIT Fehlalarm-Kennzeichnung angelegt
  (Befund F2) statt 42501“).
- **Ursache von F1 erstinstanzlich gemessen:** bei vorhandenem Waechter bricht der Backfill
  `update public.incidents set is_false_alarm = false where is_false_alarm is null` mit SQLSTATE
  `42501` ab und die NULL-Zeile bleibt stehen; nach `drop trigger if exists` läuft derselbe
  Backfill mit Exit 0 und 0 verbleibenden NULL-Zeilen. `public.current_user_role()` liefert im
  Eigentümerkontext ohne gesetzte Anwendungsidentität **NULL**.
- Baseline vor dem Lauf und Statik: TypeScript **Exit 0**, ESLint **Exit 0**, Unit-Tests **108 von
  108**, `fail 0`, **Exit 0**.

**Offener fachlicher Blocker: Befund F7 ist NICHT behoben (Entscheidung bei Dennis)**
- `setIncidentFalseAlarm` und `exportIncidentListFull` haben weiterhin **keinen produktiven
  Aufrufer**. Neu ist ausschließlich ein **Testaufrufer** in
  `app/test/integration/ap15b-incident-list.int.mjs` — Testabdeckung ist keine Verdrahtung.
- Eine produktive Verdrahtung ist nicht ohne **sichtbare GUI-Entscheidung** und nicht ohne
  **Rollenentscheidung** möglich und deshalb Dennis vorbehalten (`CLAUDE.md`: keine
  GUI-/Designentscheidung eigenständig treffen).
- **Vollmengen-Export.** `04-UI-UX/LISTENKONZEPT.md` legt für den CSV-Export ausdrücklich
  „Obergrenze 5.000 mit Hinweis“ fest. Die einzige typkompatible Anbindestelle ist die vorhandene
  Schaltfläche „CSV-Export (gefiltert)“ in
  `app/src/components/incidents/list/OperationalList.tsx`; sie auf 20000 umzuhängen wäre eine
  stille Verhaltensänderung gegen diese Festlegung, und jede andere Variante fügt sichtbare
  Bedienfläche hinzu. Offen sind außerdem Beschriftung, Position, die Meldung oberhalb der
  Obergrenze und die Frage, welche Rollen auslösen dürfen — `01-Anforderungen/ROLLEN_UND_RECHTE.md`
  führt „CSV-Export“ nur für den Administrator, der Code erlaubt heute `admin` und `disponent`.
- **Fehlalarm-Kennzeichnung.** Der Zustand ist heute nur im CSV sichtbar, nicht in Liste oder
  Detail; `is_false_alarm` ist nicht Teil des Detail-Datentyps und müsste erst projiziert werden.
  Zusätzlich kollidiert der Begriff mit dem bereits vorhandenen Vorgangsstatus `fehlalarm`
  (`app/src/lib/status.ts`, Label „Fehlalarm“); das fachliche Verhältnis von Flag und Status ist
  nirgends festgelegt. Und die Regel „nur Disponent“ bricht erstmals das im UI durchgängige
  `isStaff`-Muster (ein `admin` ist Staff, darf aber nicht setzen).
- Diese Fragen sind als **Entscheidungsvorlage für Dennis offen**. Dieser Abschnitt nennt bewusst
  keine Empfehlung für eine der Varianten.

**Erster echter Lauf auf Dennis' eigenem Rechner (2026-08-16, native PostgreSQL 18, kein Container)**
- Ausgeführt von Dennis selbst: `app\supabase\test\run_ap14b_local.ps1 -TemporaryCluster` gegen die
  native lokale PostgreSQL-18-Installation (`C:\Program Files\PostgreSQL\18\bin`), NICHT gegen
  Docker — das Skript baut sich ein eigenes, temporäres Cluster per `initdb`/`pg_ctl` auf einem
  separaten Port (55432) und entfernt es rückstandslos wieder; der vorhandene Windows-Dienst
  `postgresql-x64-18` bleibt unberührt. Damit ist die bisher offene Lücke „PostgreSQL-Verifikation
  ausschließlich in Wegwerfcontainern, nie auf Dennis' eigener Umgebung“ geschlossen.
- **Ergebnis: `ERGEBNIS: AP10/AP11/AP12/AP13/AP14B/AP15/AP15-b DATENBANKTESTS ERFOLGREICH.`** Alle
  SQL-Smokes grün, einschließlich `W1`–`W14` (Fehlalarm-Kernnachweise F1/F2 erneut bestätigt).
- **Alle sechs Node-Integrationssuiten grün, 154 von 154 Fällen, 0 Fehler:** Plattform 32/32,
  Stammdaten/Inventar 31/31, Bilder 37/37, Benutzerverwaltung 31/31, Dashboard-Kennzahlen 10/10,
  AP15-b Fehlalarm/Vollmengen-Export **L1–L13, 13/13** (gegenüber `L1`–`L11` im vorherigen
  Container-Lauf sind `L12`/`L13` neu hinzugekommen: fail-closed Typprüfung des Filters und ein
  Test der Server-Action `setFalseAlarm`). Vollmengenfixture (20001 Vorgänge) erneut bestätigt,
  Vollmengengrenze (`CAP`/`CAP+1`) erneut belegt. Aufräumbilanz: Port frei, Clusterverzeichnis und
  Arbeitsverzeichnis restlos entfernt.
- Vereinzelte Konsolenzeilen wie „Stammdaten speichern fehlgeschlagen …“ oder „Objektspeicher:
  Operation fehlgeschlagen …“ innerhalb der Bild-/Inventarsuiten sind KEINE Fehlschläge, sondern
  von der Anwendung selbst protokollierte, bewusst provozierte Negativfälle (u. a. `IB22`–`IB24`,
  `IB28`); die jeweilige Suite schließt direkt danach mit `fail 0`.
- **Möglicher Widerspruch zum Abschnitt „Offener fachlicher Blocker: Befund F7“ unten:** Test `L13`
  prüft explizit die Server-Action `setFalseAlarm` (Disponent setzt/nimmt zurück, Administrator und
  unbrauchbarer Wert bleiben ohne Wirkung) — laut eigener Durchsicht von
  `app/src/lib/incident-actions.ts` und `app/src/components/incidents/IncidentControls.tsx` in
  einer früheren Sitzung existiert dort bereits ein produktiver Aufrufer (Fehlalarm-Umschalter,
  nur für `role === "disponent"` sichtbar) sowie ein Filter/Export-Button in `OperationalList.tsx`.
  Der Blocker-Abschnitt „F7 ist NICHT behoben“ stammt aus dem Korrekturlauf vom 2026-08-12 und
  wurde nach der UI-Verdrahtung offenbar nicht mehr aktualisiert. **Das ist hier bewusst nicht
  stillschweigend korrigiert** — der Review-Chat sollte den F7-Abschnitt gegen den aktuellen
  Code-/Testbestand abgleichen und den Status richtigstellen, statt dass zwei widersprüchliche
  Aussagen im selben Dokument stehen bleiben.

**Bewusst außerhalb des Korrekturlaufs offen geblieben**
- `filters.falseAlarm` hat keine Vorabtypprüfung wie `status`/`priority`/`date_*` in `fetchList()`;
  über den Server-Action-Weg kann ein unbrauchbarer Wert daher zu einer ungefangenen Ausnahme statt
  zur bisherigen leeren Liste führen. Ausdrücklich nicht Gegenstand des Korrekturauftrags
  (Negativliste), unverändert offen.
- Die Exportberechtigung ist als Negativliste formuliert (`session.role === "monteur"`), nicht als
  Positivliste — unverändert offen.
- Die Befunde F4 und F8 bis F13 des Architektur-Gates bleiben unverändert offen.
- Der Stand bleibt insgesamt uncommitteter Arbeitsbaumstand zur Prüfung durch ChatGPT/Codex: keine
  Abnahme, keine Freigabe, kein Merge, kein Tag.

**Richtigstellung durch den Review-Chat (2026-08-16, gegen den Codebestand abgeglichen)**
- Seit 2026-08-16 nimmt Claude (Cowork-Chat „Orchestrator/Review", Fable 5) die bisherige
  Codex-Rolle wahr (Entscheidung Dennis); die Umsetzung erfolgt durch einen getrennten
  Worker-Cowork-Chat, Koordination über `00-Projektsteuerung/AUFTRAG_<n>.md` /
  `MELDUNG_<n>.md` / `REVIEW_<n>.md`.
- **F7 ist im Arbeitsbaum behoben:** produktive Aufrufer existieren — Fehlalarm-Umschalter in
  `IncidentControls.tsx` (sichtbar nur bei `role === "disponent"`, Server-Action `setFalseAlarm()`
  in `incident-actions.ts`) sowie Fehlalarm-Filter und Vollmengen-Export-Button in
  `OperationalList.tsx`; belegt zusätzlich durch Test `L13`. Der Abschnitt „Offener fachlicher
  Blocker: Befund F7 ist NICHT behoben" oben beschreibt den Stand vom 2026-08-12 **vor** der
  UI-Verdrahtung und ist überholt. **Die fachliche Abnahme bleibt offen:** die Verdrahtung nimmt
  sichtbare GUI-/Rollenentscheidungen vorweg (Vollmengen-Export-Button vs. LISTENKONZEPT-Obergrenze
  5.000; „nur Disponent" vs. `isStaff`-Muster; Verhältnis Flag ↔ Status `fehlalarm`) — diese
  Entscheidungen liegen weiterhin bei Dennis.
- **Die Vorabtypprüfung von `filters.falseAlarm` existiert inzwischen** (`incidents.ts:732`,
  fail-closed leere Menge statt Wurf; Test `L12`). Der erste Punkt unter „Bewusst außerhalb …
  offen geblieben" ist damit überholt.
- **Dokumentationslücke Architektur-Gate:** die Befundliste F4/F8–F13 ist im Vault nirgends
  inhaltlich dokumentiert; aus den Laufprotokollen rekonstruierbar ist nur **F10 (mittel):
  Exportberechtigung als Negativliste** (`incident-list-actions.ts`) — eine künftige vierte Rolle
  wäre ohne Codeänderung exportberechtigt. F4/F8/F9/F11–F13 sind ohne den ursprünglichen
  Codex-Gate-Bericht nicht nachvollziehbar; der Review-Chat behandelt sie als unbelegt und wird
  bei der RC1-Vorbereitung ein eigenes, vollständiges Review-Gate über den AP15-b-Gesamtdiff
  laufen lassen, statt sich auf die verlorene Liste zu stützen.
- **AUFTRAG_1 umgesetzt und freigegeben** (`REVIEW_1.md`): `ap15b-incident-list-url.test.mjs`
  läuft mit eigenem `registerHooks()`-Resolve-Hook; vom Review-Chat selbst nachgemessen:
  Einzeltest 3/3, Exit 0; Gesamtlauf `node --test test/*.test.mjs` 64 Einträge, 63 pass, einziger
  roter Eintrag die umgebungsbedingte Altlast `ap14b-auth.test.mjs` (fehlendes natives
  argon2-Binding in der Prüf-Sandbox). Kein Commit, kein Push.

**AUFTRAG_2 umgesetzt und freigegeben (2026-08-16, `REVIEW_2.md`):** Rollenprüfungen in
`incident-list-actions.ts` vollständig als Allowlist `STAFF_ALLOWED_ROLES = ["admin","disponent"]`
(beide Exporte und beide Massenaktionen; Meldungstexte und Verhalten für die drei existierenden
Rollen unverändert; statischer Wächtertest in `ap15b-callers.test.mjs`). **Befund F10 damit
vollständig erledigt**; der Punkt „Exportberechtigung als Negativliste" unter „Bewusst außerhalb …
offen geblieben" ist überholt. Vom Review-Chat selbst nachgemessen: 4 Allowlist-Verwendungen,
Wächtertest 5/5, Gesamtlauf 65/64/1 (nur Altlast `ap14b-auth`), `tsc` Exit 0.

**AUFTRAG_3 umgesetzt und freigegeben mit Auflage (2026-08-16, `REVIEW_3.md`):** shadcn/ui-Fundament
in `app/` (components.json, `src/lib/utils.ts`, 9 Copy-in-Komponenten unter
`src/components/ui/shadcn/`, 9 neue Dependencies inkl. `radix-ui`-Meta-Paket, `vaul`, `sonner`,
`react-day-picker`, `tw-animate-css`), Token-Anbindung in `globals.css` nachweislich rein additiv
(81 Zeilen hinzu, 0 gelöscht) auf bestehende AP8-Tokens gemappt; keine bestehende Seite/Komponente
verändert, nichts importiert die neuen Komponenten (toter Code beabsichtigt). Vom Review-Chat
selbst nachgemessen: `tsc` Exit 0, ESLint Exit 0, `npm audit --omit=dev` 0 Schwachstellen.
**Neue Test-Baseline: `node --test test/*.test.mjs` = 115/115/0, Exit 0** — das native
argon2-Binding lädt jetzt in der Sandbox (Nebeneffekt der npm-Installationen); die Altlast
`ap14b-auth` (vorher 1 roter Ladefehler-Eintrag, jetzt 51 grüne Einzelfälle: 65−1+51=115) ist
erledigt. **Auflage/offen:** `npm run build` und `npm ci --ignore-scripts` sind in beiden
Cowork-Sandboxes umgebungsbedingt blockiert (EPERM auf `.fuse_hidden`-Artefakte fremder
Session-UID im OneDrive-Mount, in der Review-Sandbox reproduziert — kein Code-Defekt);
**lokale Gegenprüfung durch Dennis vor einem Commit erforderlich.** Anmerkung: das vorbestehende,
undokumentierte `--test-isolation=none` im `test:unit`-Script sollte dokumentiert oder
zurückgenommen werden. Nächste Scheibe: `AUFTRAG_4.md` (Branding „Bereitschaftsapp HLK",
entscheidungsfrei lt. Entscheidung Dennis).

**Entscheidungen Dennis vom 2026-08-16 (GUI-Phase, verbindlich):**
- **UI-Basis:** shadcn/ui als Copy-in-Grundlage (Radix-basiert), ergänzt nach Bedarf um `vaul`
  (Bottom-Sheets mobil), `sonner` (Toasts) und `react-day-picker` (Datumsfilter); Tremor nur als
  Kopiervorlage fürs Dashboard. Begründung: Code bleibt vollständig im Vault reviewbar, a11y über
  Radix, kompatibel mit dem bestehenden Designsystem (AP8-Tokens, Dark Mode).
- **Erfassung: Variante A** — eine Seite auf beiden Geräten; Desktop zweispaltig (Zuordnung |
  Störung), Mobil untereinander mit **eingeklappten optionalen Abschnitten**, Priorität als große
  Tippflächen statt Dropdown, Hauptknopf unten in der Daumenzone (Desktop oben rechts). Kein
  Schritt-Assistent.
- **Erfassung ergänzen:** `Kabeltyp` als **optionales** Feld (Auswahl aus den bestehenden
  Stammdaten `cable_types`); die Objektangaben müssen auch **LST-Elemente** abdecken (Objekt ist
  nicht zwingend ein Kabel).
- **Begriff:** In der sichtbaren Oberfläche heißt ein Vorgang künftig **„Meldung"**
  (Erfassung = „Neue Meldung", Liste = „Meldungen" usw.). **Nur UI-Labels und sichtbare Texte** —
  Datenbank-, Code- und API-Bezeichner (`incidents`, `incident_no`, Routen) bleiben unverändert;
  eine Umbenennung der technischen Schicht wäre ein eigenes, risikoreiches Arbeitspaket und ist
  nicht beauftragt.
- **App-Name (Branding):** „Bereitschaftsapp HLK" (Objektumfang umfasst neben Kabeln auch
  LST-Elemente). Umsetzung im Rahmen der GUI-Phase (sichtbarer Titel/AppShell/PWA-Manifest);
  Branding bleibt ansonsten separat wie bisher festgelegt.
- **GUI-Reihenfolge:** 1. Erfassung, 2. Liste der Meldungen, 3. Disponentenansicht,
  4. Dashboard (zuletzt, niedrige Priorität).
- **Nachtrag (Entscheidungen Dennis, 2026-08-16, zweiter Block — zu
  `01-Anforderungen/ANFORDERUNG_DISPO_METADATEN.md`):**
  (a) **Gewerk- und Funktions-Katalog beide pflegbar** als Stammdaten-Seiten (wie Kabelarten),
  Startwerte aus der Excel (Gewerke: 50 Hz, LST, TK, OSE, LWL-LST, LWL-TK, Unbekannt;
  Funktionen: BÜW, LBÜW, örtl. LST).
  (b) **Anlage/Objektart: katalog­gestützter Freitext** — Eingabefeld mit Vorschlägen aus dem
  pflegbaren Objektarten-Katalog; ein neuer, nicht im Katalog vorhandener Begriff ist nur
  zulässig, wenn er dabei ausdrücklich in den Katalog **eingepflegt** wird (kein stilles
  Vorbeischreiben am Katalog).
  (c) **„In Klärung" als Kennzeichen an der Meldung** (Ja/Nein wie in der Excel), kein neuer
  Statuswert.
  (d) **Bereitschaftsplan** (Einsatzplanungs-Matrix) wird **nach Erfassung + Liste** und vor
  der Disponentenansicht eingereiht, damit diese anzeigen kann, wer Bereitschaft hat.
- **Nachtrag (Entscheidungen Dennis, 2026-08-16, dritter Block — löst die offenen
  AP15-b-/Architektur-Fragen):**
  (a) **Bildspeicher: Dateisystem statt MinIO** — der IT-Rückmeldung vom 2026-08-03 wird
  gefolgt; ADR-011 wird in der MinIO-Passage geändert (formaler ADR-Nachtrag folgt als eigene
  Doku-Scheibe). Umbaupaket gemäß `CODEX_ANFRAGE_BILDSPEICHER_DATEISYSTEM.md`: Storage-Schicht
  (`IMAGE_STORAGE_DIR`, atomares rename, Sharding), sitzungsgeprüfte Bildauslieferungsroute
  statt signierter URLs, Dockerfile/Compose/Portainer-Anpassung, CI-Job `objectstore` durch
  Dateisystem-Äquivalent ersetzen. Datenbank-/RLS-Stand aus AP14B bleibt erhalten.
  (b) **Fehlalarm-Kennzeichnung: Admin + Disponent** (isStaff-Muster) — Migration 0018
  (Wächter `tg_incident_guard_false_alarm`) und UI-Sichtbarkeit werden von „nur Disponent"
  auf admin+disponent angepasst.
  (c) **Fehlalarm: Kennzeichen löst den Statuswert ab** — der Statuswert `fehlalarm` wird
  ausgemustert (Bestandsdaten migrieren; abgeschlossene Fehlalarm-Meldungen künftig
  Status „erledigt" o. ä. + Kennzeichen). Eigenes Arbeitspaket mit Migration und Anpassung
  von Statusmodell, Zählungen und Filtern.
  (d) **CSV-Export: beide Exporte bleiben, Rollen Admin + Disponent** — gefilterter Export
  Obergrenze 5.000, Vollmengen-Export 20.000; `04-UI-UX/LISTENKONZEPT.md` und
  `01-Anforderungen/ROLLEN_UND_RECHTE.md` werden entsprechend aktualisiert (Doku-Scheibe).
- **Neuer bestätigter Referenzstand (2026-08-16): `986f891` auf `main`, CI vollständig grün.**
  Dennis hat den gesamten AP15-b-/GUI-Arbeitsbaum selbst committet und gepusht — drei Commits:
  `41cf12e` („feat: AP15-b Fehlalarm/Export, shadcn-Fundament, Branding Bereitschaftsapp HLK"),
  `1671c2e` („fix(ci): test:unit ohne --test-isolation", Node-22-Kompatibilität — die Option
  existiert erst ab Node 24 und stammte aus einem lokalen Node-24-Lauf; in der Node-22-Sandbox
  reproduziert) und `986f891` („test(e2e): Manifestname Bereitschaftsapp HLK"). Der CI-Lauf zu
  `986f891` ist mit allen vier Jobs (verify, database, container, objectstore) **grün** — durch
  Dennis von der Actions-Seite berichtet, von Claude nicht selbst abgerufen. Damit sind erstmals
  CI-bestätigt: **Migration 0018** samt Smoke 25 und sechster Integrationssuite, das
  shadcn-Fundament, das Branding und die F10-Allowlist. Der frühere Referenzstand `9aaebdf`/
  `45dfcb3` ist Vorfahr und überholt.
  **Review-Lehre aus dem roten Zwischenlauf:** Branding-/UI-Fundstellenlisten müssen neben
  `src/` auch `e2e/` (und `test/`) umfassen — `e2e/public.spec.ts` prüfte den Manifestnamen und
  war in AUFTRAG_4 nicht enthalten. Außerdem gehört bei package.json-Skriptänderungen künftig
  `npm run test:unit` (nicht nur `node --test` direkt) in die Prüfkette, damit Node-Versions-
  abhängige Optionen auffallen.
- **Nachweis 2026-08-17 (schließt eine Hauptauflage):** Dennis hat die Migrationen
  **0019, 0020, 0021 und 0022** lokal gegen seine echte PostgreSQL-18-Instanz (Datenbank
  `kb_dev`) mit `ON_ERROR_STOP=1` eingespielt — **alle vier ohne Fehler**. Damit ist die in
  REVIEW_6/7/10/14 festgehaltene Auflage „nur Code-Review, kein DB-Lauf" für die
  Migrationsanwendung erledigt. **Weiterhin offen:** die SQL-Smokes 26–29 und der CI-Job
  `database` (fail-closed Rollen-/Rechteprüfungen gegen eine frische Datenbank).
- **Arbeitsmodell geändert (2026-08-17):** der zweite Cowork-Chat („Worker") ist stillgelegt;
  der Orchestrator/Review-Chat startet Sonnet-Ausführungsagenten und prüft deren Ergebnisse
  selbst nach. Tagesstand, gebaute Scheiben (AUFTRAG 5–14) und offene Punkte:
  `00-Projektsteuerung/UEBERGABE_STAND_2026-08-17.md`.
- **Neues Anforderungsthema:** Pflegeformular für die Disposition zur **Metadaten-Pflege**.
  Fachliche Grundlage ist eine Excel-Datei von Dennis, die **noch nicht im Vault liegt**
  (Stand 2026-08-16 keine xlsx/csv im Vault gefunden); Anforderungsaufnahme startet, sobald die
  Datei vorliegt (Ablage vorgesehen unter `99-Anlagen/` oder `01-Anforderungen/`).

**Nachtrag 2026-08-18 — erster CI-Lauf der Smokes 26 ff.: Ursache geklärt, Testdefekt (AUFTRAG_15).**
Der von Dennis gelieferte CI-Lauf des Jobs `database` (temporäre Datenbank
`kabelbereitschaft_test_20260817_142941_3237`) bricht in `28_hlk_bereitschaftsplan.sql` in Fall
**Z7** ab: `SMOKE Z7 FAIL SQLSTATE kein Fehler … statt 42501 beim Loeschversuch des Monteurs`,
Prozess-Exit 1. Alle Smokes davor bis einschließlich Z6 sind grün; Z8 ff. und
`29_hlk_dispo_board.sql` sind wegen des Abbruchs **nie gelaufen**.
**Ursache ist die Erwartung im Testfall, nicht Migration 0021:** `42501` entsteht bei
fehlendem Tabellenrecht oder verletzter `with check` (insert/update); die `using`-Bedingung
einer RLS-Policy **filtert** beim `delete` dagegen nur die Treffermenge. `app_user` besitzt
`delete` auf `public.on_call_plan` (0021, Abschnitt 3, dort begründet), die Policy
`on_call_plan_delete` trägt `using (public.is_staff())` — ein Monteur löscht damit **0 Zeilen
ohne Fehler**. Genau deshalb ist Z6 (`insert`) grün und Z7 (`delete`) rot. Die Schutzwirkung
selbst besteht: der Monteur entfernt keine Planzeile. Korrektur in AUFTRAG_15/REVIEW_15: Z7
prüft jetzt kein SQLSTATE mehr, sondern kein Fehler + `row_count = 0` + unveränderte
Gesamtzeilenzahl + Fortbestand der Zeile, letzteren bewusst im **Administrator-Kontext**
gelesen. Vom Review-Chat selbst nachgemessen: Diff **1 Datei / 31+ / 6−**, Änderungen
ausschließlich im Z7-Block, kein `'42501'`-Vergleich mehr in Z7, `node --test test/*.test.mjs`
**177/177, Exit 0**. Migration 0021 unverändert. **Auflage:** der eigentliche Nachweis ist ein
grüner SQL-Lauf (kein PostgreSQL in der Sandbox) — CI-Job `database` oder Dennis lokal; danach
läuft erstmals Smoke 29, dort sind weitere Erstbefunde möglich. Kein Commit, kein Push.
Gegengeprüft: kein weiterer Fall in 26/28/29 erwartet `42501` aus einem `using`-Zeilenfilter
(Z8, AA5 und AA9 stützen sich auf ein fehlendes Tabellenrecht, X4 nur auf `insert`).

**Nachtrag 2026-08-18 — Commit-Blocker im Arbeitsbaum: 152 Dateien auf CRLF umgestellt.**
Bei derselben Nachmessung gefunden: `git status --porcelain` nennt **207** geänderte Dateien,
davon sind nur **43** echte Inhaltsänderungen (`git diff --stat -w`: 1547+/443−). **152** Dateien
tragen im Arbeitsbaum CRLF, in HEAD LF; **141** davon sind inhaltlich byteweise identisch zu
HEAD (reine Zeilenendeänderung), **11** tragen zusätzlich echte Änderungen. Eine
`.gitattributes` existiert nicht, `core.autocrlf` und `core.eol` sind nicht gesetzt — Git
normalisiert also nicht. Betroffen sind **alle sieben Shell-Skripte** sowie `app/Dockerfile`,
`deploy/compose*.yml`, beide Workflows und `run_ap14b_local.ps1`; belegt an
`app/supabase/test/run_db_tests.sh` (HEAD `#!/usr/bin/env bash$`, Arbeitsbaum
`#!/usr/bin/env bash^M$`, 655 CR). Folge: würde der Arbeitsbaum so committet, scheiterte der
CI-Job `database` **vor der ersten SQL-Anweisung** (`env: 'bash\r'`), ebenso der Containerstart
über `entrypoint.sh` — also **unabhängig von AUFTRAG_15**. Der bisherige rote Lauf zu `3c1343f`
ist nicht betroffen, weil dort die LF-Fassung im Commit steht. Vorgehen, Messwerte, Dateiliste
und ein kopierfertiger PowerShell-Block: `00-Projektsteuerung/BEFUND_CRLF_ARBEITSBAUM.md`.
**Nicht ausgeführt** — Arbeitsbaum-Wiederherstellung ist destruktiv und `.claude/**` ist für
Claude gesperrt; Entscheidung und Ausführung bei Dennis. Ursache der Umstellung ist **offen**
(Editor-/Werkzeuglauf oder OneDrive); eine `.gitattributes` (`* text=auto eol=lf`,
`*.ps1 text eol=crlf`) ist als Wiederholungsschutz vorgeschlagen, aber als repo-weiter Eingriff
Dennis' Entscheidung.

**Entscheidung Dennis vom 2026-08-18 (Stammdaten-Akkordeon, verbindlich):**
(a) **Eine neue Übersichtsseite `/stammdaten`** mit Akkordeon; das Aufklappen zeigt die
Pflege **inline**, kein Seitenwechsel. Die 13 bestehenden Einzelrouten bleiben erhalten und
direkt aufrufbar. (b) **Flache Reihenfolge ohne Obergruppen:** VzG-Strecken → Bauabschnitte →
Ansprechpartner → Rest, wobei „Rest" die bestehende Reihenfolge aus `lib/roles.ts` behält
(Kunden, Monteure, Teams, Kabelarten, Gewerke, Funktionen, Objektarten, Qualifikationen,
Bereitschaftsnummern, Einstellungen).

**AUFTRAG_16 umgesetzt und freigegeben mit Auflagen (2026-08-18, `REVIEW_16.md`):** neue
Seite `app/src/app/(app)/stammdaten/page.tsx` mit 13 Akkordeon-Abschnitten in der
entschiedenen Reihenfolge, alle beim Aufruf zugeklappt, `type="multiple"`, je Abschnitt ein
Link „Einzelseite öffnen" außerhalb des Triggers (kein verschachteltes interaktives Element);
neuer Copy-in `app/src/components/ui/shadcn/accordion.tsx` über das **bereits vorhandene**
`radix-ui`-Meta-Paket — **keine neue Abhängigkeit**, `package.json`/`package-lock.json`
unberührt; `lib/roles.ts` um **genau einen** Eintrag `/stammdaten` als erstes Element der
Stammdaten-Gruppe ergänzt. Die 13 Client-Komponenten unter `components/masterdata/` und die
13 Einzelseiten sind **unverändert**; ihre 13 `subtitle`-Texte sind zeichengleich übernommen
(gegengeprüft). Rollengate `admin`/`disponent` steht vor der Datenladung. Vom Review-Chat
selbst nachgemessen: `npx tsc --noEmit` **Exit 0**, `node --test test/*.test.mjs`
**181/181, fail 0, Exit 0** (Baseline 177 + 4 Wächterfälle: Vollständigkeit der 13
Komponenten, Positionsvergleich der Reihenfolge, Gate vor Ladung, `roles.ts`-Eintrag), alle
drei neuen Dateien mit **LF** (0 CR). Umfangsprüfung über Dateizeitstempel statt `git status`,
weil der Arbeitsbaum 200+ fremde Änderungen aus AUFTRAG 11–14 und die offene CRLF-Umstellung
trägt. Die Animationsnamen `animate-accordion-up`/`-down` sind belegt: `tw-animate-css`
(in `globals.css` importiert) liefert `--animate-accordion-*` samt Keyframes.
**Auflagen:** (1) **Sichtprüfung durch Dennis** — sichtbare Oberfläche, in der Sandbox nicht
darstellbar; (2) `npm run build` und ESLint lokal.
**Merkposten:** die Seite lädt 20 Listen in einem `Promise.all` und rendert das Markup aller
13 Abschnitte auch im zugeklappten Zustand (bei heutigen Datenmengen unkritisch; Ausweg wäre
Laden je Abschnitt über `Suspense` als eigene Scheibe); `listContacts()`/`listTechnicians()`
haben unverändert **keine Obergrenze** — kein neu eingeführtes Risiko, gehört aber in die
CSV-Import-/Kontakte-Scheibe. Beim Testlauf entstand `app/testout.log` (0 Byte, nicht
gitignoriert, aus der Sandbox nicht löschbar) — **lokal entfernen**, sonst kommt es bei
`git add -A` mit. Kein Commit, kein Push.

**Entscheidungen Dennis vom 2026-08-18 (Disposition der Monteure, verbindlich):** Block D aus
`ANFORDERUNG_GUI_RUNDE_2.md` ist mit AUFTRAG_14 im Kern gebaut (belegt gegengeprüft: D11, D12,
D14, D15 umgesetzt; D13 teilweise). Dennis hat dazu ergänzt und entschieden:
(a) **Mehrfach-Tageszuweisung über einen Dialog „von–bis"** (gewählt gegen „Auswahl bleibt
haften" und „Zeitraum ziehen") — Gegenstand von AUFTRAG_18.
(b) **Soll-Besetzung: zwei Monteure je angelegtem Bauabschnitt und Tag** — ausdrücklich
„Standard", also **Anzeige ohne harte Grenze**; weder Über- noch Unterbesetzung wird
blockiert. Die Dispo-Zeile hat keinen Sollwert.
(c) **Doppelbelegung ist erlaubt, aber nicht unbemerkt:** derselbe Monteur am selben Tag ein
zweites Mal (anderer Bauabschnitt oder Dispo) → **Hinweis mit Rückfrage**; bestätigt der
Disponent, ist es zulässig. Deshalb **kein** Datenbank-Constraint.
(d) **Die Monteurliste rechts bleibt vollständig:** eingeplante Monteure werden **markiert**,
verschwinden aber nicht und bleiben bedienbar.
(e) Der **Disponent wird aus derselben Personalliste** geplant wie die Bereitschaft (im
Bestand schon so).
(f) **Keine Umbenennung** — Route `/bereitschaftsplan`, Menüpunkt und Titel bleiben
„Bereitschaftsplan"; eine Umbenennung hat Dennis nicht verlangt.

**AUFTRAG_17 umgesetzt und freigegeben mit Auflage (2026-08-18, `REVIEW_17.md`):** in
`OnCallPlanClient.tsx` umgesetzt: (1) **Bugfix** — das „×" der Wochenmatrix rief `onRemove`
ohne `stopPropagation`, das Klickereignis blubberte auf `<td onClick={onCellClick}>`; bei
ausgewähltem Monteur entfernte ein Klick die Zuweisung **und legte gleichzeitig eine neue an**
(in der Monatsansicht war es korrekt gelöst). (2) Sollwert-Konstante
`SOLL_BESETZUNG_BEREITSCHAFT = 2` mit Anzeige „n/2" je Bereitschaftszelle über die bestehenden
AP8-Badge-Utilities (`badge-success` bei genau 2, `badge-warning` bei Unterbesetzung,
`badge-info` bei Überbesetzung — bewusst nicht `danger`, es ist kein Fehler); reine Anzeige.
(3) Doppelbelegungsprüfung in **einem** gemeinsamen Prüfpunkt `handleDropOrClickAssign()`,
durch den nachgemessen **alle drei** Schreibeinstiege laufen (Drop, Klick Woche, Klickpfad
Monat); Rückfrage über `window.confirm` mit konkretem Ort, Abbruch führt zu keinem
Serveraufruf und erhält die Monteurauswahl. (4) Markierung der eingeplanten Monteure als
Tagesanzahl, Liste nachgemessen **ohne** Filter. Kein Constraint, keine Migration.
**Grenze ausdrücklich offengelegt:** die Prüfung arbeitet gegen den **geladenen** Zeitraum —
eine Dublette außerhalb der sichtbaren Woche/des Monats und ein gleichzeitiger zweiter
Bearbeiter werden nicht erkannt; es ist eine Bedienhilfe, keine Zusicherung. Vom Review-Chat
selbst nachgemessen: `npx tsc --noEmit` **Exit 0**, `node --test test/*.test.mjs`
**192/192, fail 0, Exit 0** (Baseline 181 + 11 Wächterfälle), neue Testdatei mit LF,
Badge-Utilities in `globals.css` als vorhanden nachgezählt. **Auflage:** Sichtprüfung durch
Dennis; `npm run build`/ESLint lokal. **Gestaltungsfrage an Dennis (bewusst offen):** eine
leere Zelle zeigt „0/2" in `badge-warning` — in einem frisch geöffneten künftigen Monat leuchtet
damit die ganze Matrix gelb. **Danach offen (AUFTRAG_18):** Dialog „von–bis", Verschieben ohne
Maus bzw. in der Monatsansicht, Drag-Feedback der Zielzelle, Sperrzustand während einer Aktion
(heute erzeugt ein Doppelklick zwei Aktionen), Tastaturbedienung der Zielzellen, Leerzustände
der Monatsansicht und die Fehlerbox auf AP8-Tokens (heute hart `bg-red-50`/`text-red-700`).
Kein Commit, kein Push.

**AUFTRAG_18 bis 22 umgesetzt und freigegeben mit Auflagen (2026-08-18, `REVIEW_18_bis_22.md`):**
- **18 — „von–bis"-Dialog** (Entscheidung Dennis): der Dialog erscheint **vor** dem Schreiben in
  allen drei Neuzuweisungspfaden (Drop, Klick Woche, Klickpfad Monat); der Verschiebepfad bleibt
  einzeltägig und ohne Dialog. „Von" ist der angeklickte Tag und festgesetzt, „Bis" ein
  Datumsfeld; „Nur diesen Tag" ist vorbelegt. Neue Server-Action `assignOnCallRange()` mit
  derselben Rollen-Allowlist und denselben Eingabeprüfungen wie die Bestandsactions, **beide**
  Grenzen (Bis vor Von, 92 Tage) serverseitig wiederholt, **eine** `withUserTransaction` mit je
  Tag `insert … on conflict … do nothing`. Die `on conflict`-Formulierungen treffen Spaltenliste
  **und** Prädikat der beiden partiellen Unique-Indizes aus `0022` (vom Review gegen die
  Indexköpfe abgeglichen) — ein belegter Tag wird übersprungen statt die Transaktion mit `23505`
  zu sprengen. `MAX_RANGE_DAYS = 92` ist **eine** Quelle (Action definiert, Oberfläche
  importiert). Doppelbelegungsprüfung läuft über **alle** Tage des Zeitraums, gesammelt in einer
  Rückfrage; Grenze unverändert: nur gegen den **geladenen** Zeitraum, keine
  Nebenläufigkeitsgarantie. **Kompromiss, offen benannt:** die Erfolgsmeldung nutzt dieselbe
  Fläche wie die Fehlermeldung (um keine neue Farbklasse einzuführen) und sieht dadurch wie ein
  Fehler aus — gehört in die Bedienmängel-Scheibe.
- **20 — Browser-Schutz der 92-Tage-Grenze** (Befund des Review-Chats, nicht des Agenten):
  `isoDatesInRange()` baute die Tagesliste unbegrenzt auf, **bevor** die Grenze prüfte; ein
  Tippfehler im Jahr (`2926-…`, von `<input type="date">` akzeptiert) hätte ~330.000 Durchläufe
  erzeugt und den Tab eingefroren — genau der Fall, gegen den die Grenze schützen soll. Behoben
  durch früh abbrechenden Zähler **vor** dem Listenaufbau plus hartes Sicherheitsnetz in
  `isoDatesInRange()` (nie mehr als `MAX_RANGE_DAYS + 1`). Rechnerisch belegt: 92 statt ~330.000
  Schritte. Der Serverpfad war nie betroffen.
- **21 — Logo im Dark Mode weiß** (Anforderung Dennis): Ursache war **nicht** das Logo —
  `Logo.tsx` trug seit AUFTRAG_12 `dark:invert`. Kaputt war `globals.css:9`: die Variante band
  `dark:` **ausschließlich** an `[data-theme="dark"]`, während der zweite Dunkelfall
  („System" + dunkles Betriebssystem) über `@media (prefers-color-scheme: dark)` mit
  `:root:not([data-theme="light"])` läuft — dort waren **alle** `dark:`-Utilities unwirksam.
  Neue Blockform mit zwei Zweigen, der zweite **deckungsgleich** zum bestehenden Tokenblock;
  der Ausschluss `:not([data-theme="light"])` ist zwingend (sonst weißes Logo auf weißem Grund
  bei ausdrücklich hellem Theme auf dunklem OS). **Kein Tokenwert berührt** (per `/tmp`-Kopie
  und Diff belegt, drei Farbblöcke unverändert vorhanden). **Nebeneffekt, gewollt:** von den 20
  `dark:`-Utilities in `app/src/` werden neben den 2 Logo-Stellen auch die **18** übrigen
  (Ring-/Feldfarben der shadcn-Copy-ins) unter „System = dunkel" erstmals aktiv — sichtbare
  Veränderung an Formularfeldern und Fokusringen in genau diesem Modus.
- **19 und 22 — zwei Wächterkorrekturen, kein Produktivcodefehler.** Beide betrafen statische
  Wächtertests, die eine Momentaufnahme des Quelltextes festschrieben: 19 zählte die
  Allowlist-Prüfungen gegen die feste Zahl 4 (die fünfte Action aus 18 machte ihn zwangsläufig
  rot) — jetzt Anzahl gegen Anzahl der **exportierten** Actions plus untere Schranke; 22 suchte
  die Grenzprüfung als **Zeichenkette**, die 20 ersetzen musste — jetzt als Muster **plus**
  Reihenfolgeprüfung (Vergleich vor `isoDatesInRange(`), also strenger als vorher. **Beide
  Wirksamkeiten sind gegengeprobt** (Regel zurückgedreht → rot mit sprechender Meldung →
  zurückgenommen → grün, mit Hash- bzw. `git diff --stat`-Vergleich als Nachweis der
  Unverändertheit).
- **Review-Lehre (in einer Sitzung zweimal aufgetreten):** ein statischer Wächter darf **keine**
  wörtliche Formulierung des Quelltextes festschreiben, sondern muss die **Absicht** prüfen
  (Anzahl gegen Anzahl, Muster statt Zeichenkette, Reihenfolge statt Vorkommen). Sonst wird er
  bei der nächsten sachlich richtigen Änderung rot und erzeugt einen Korrekturauftrag ohne
  Nutzen. Bei neuen Wächtern von Anfang an so bauen — und ihre Wirksamkeit einmal gegenproben,
  sonst ist grün wertlos.
- Vom Review-Chat selbst nachgemessen (Abschlussstand): `node --test test/*.test.mjs`
  **208/208, fail 0, Exit 0**; `npx tsc --noEmit` **Exit 0**; Umfang über Dateizeitstempel
  geprüft; neue Testdateien mit LF. Testentwicklung der Sitzung: 177 → 181 → 192 → 204 → 208.
- **Auflagen:** Sichtprüfung durch Dennis in **allen vier** Theme-Zuständen (Logo und die 18 nun
  aktiven `dark:`-Stellen); `npm run build` und ESLint lokal (ESLint brach zweimal am Zeitlimit
  ~178 s ab — kein Befund, aber kein Nachweis); SQL-/CI-Nachweis (Smokes 26–29, Job `database`)
  weiterhin offen; **CRLF-Bereinigung vor dem Commit** (`BEFUND_CRLF_ARBEITSBAUM.md`).
  Kein Commit, kein Push.

**Befund 2026-08-18 — scheduled task `kb-review-zyklus` schrieb als zweiter Orchestrator in den
Vault; deaktiviert.** Der Task aus dem stillgelegten Zwei-Chat-Modell (cron `*/10 * * * *`, war
`enabled: true`) hat während der laufenden Arbeit eigenständig `REVIEW_18_19_20.md` und
`AUFTRAG_20K.md` angelegt und den **eigenen** Abschnitt des Orchestrator-Chats in
`CHAT_STATUS.md` auf `arbeitet` gesetzt. `AUFTRAG_20K` beschreibt **dieselbe** Korrektur an
**derselben** Testdatei wie `AUFTRAG_22` — zwei Agenten hätten dieselbe Datei bearbeiten können;
nur die Reihenfolge hat das verhindert. `AUFTRAG_20K.md` ist als **gegenstandslos**
gekennzeichnet (Inhalt bleibt als Historie). Der Task hält zudem weiterhin einen „Worker-Chat"
für aktiv und deutet die Arbeit dieses Chats als dessen Arbeit. **Inhaltlich war sein Review
nicht falsch** (dieselben Befunde, dazu zwei eigene Messwerte: `npm audit --audit-level=high
--omit=dev` → 0 Schwachstellen, Exit 0; zwei ESLint-Abbrüche am Zeitlimit) — **eine** Aussage
darin ist richtigzustellen: er notiert den Prozess-Exit eines Testlaufs mit einem roten Fall als
`0`; eigene Messung ergibt Exit **1**. Der Task wurde auf Grundlage der ausdrücklichen Anweisung
im Übergabestand vom 2026-08-17 **deaktiviert**, nichts gelöscht, kein Prompt geändert.
Entscheidung über deaktiviert lassen / Prompt auf reines Gegenlesen umschreiben / löschen liegt
bei Dennis: `00-Projektsteuerung/BEFUND_SCHEDULED_TASK_DOPPELSCHREIBER.md`.

**AUFTRAG_23 umgesetzt und freigegeben mit Auflage (2026-08-18, `REVIEW_23.md`) — Dispo-Board,
Bedienmängel Teil 1 (Rückmeldung und Robustheit).** In `OnCallPlanClient.tsx`:
(M1/M2) aus `error: string|null` wurde `feedback: {kind:"success"|"error"; message}` — die
Zeitraum-Anlage meldet nur bei `createdCount > 0` Erfolg, der „0 Tage"-Sonderfall behält seinen
Wortlaut und erscheint als Fehler; die harten Farbklassen (`bg-red-50`, `text-red-700`,
`border-red-300`, `hover:text-red-600`) sind **restlos** ersetzt (eigener Grep über die ganze
Datei: keine Treffer), stattdessen `card` + `badge-success`/`badge-danger` und
`hover:text-destructive`. Die verwendeten Tokens sind als vorhanden nachgezählt
(`--color-destructive`, `--color-surface-2`, `--color-border`, `--ring`); `globals.css` wurde
**nicht** angefasst. (M3) Drag-Feedback über `onDragEnter`/`onDragLeave` an Wochenmatrix und den
beiden Ablageflächen, Rücksetzen auch im `drop`-Pfad. (M4) **`busy` bricht jetzt als erste
Bedingung** in `onCellDrop`, `onCellClick`, der Entfernen-Ablagefläche und dem Tagesklick der
Monatsansicht ab — vorher deaktivierte `busy` nur Schaltflächen, während Zellklicks weiterliefen
und ein Doppelklick zwei Aktionen erzeugte; zusätzlich `aria-busy` und reduzierte Deckkraft.
(M5) „—"-Platzhalter von `canEdit` entkoppelt, Monatsansicht mit eigenem Leerzustand (für
Monteure ohne Bedienaufforderung). (M6) `minHeight: "44px"` aus `AssignedChip` entfernt,
Trefferfläche jetzt über `px-2 py-4 -mx-2 -my-4` (Innenabstand plus gegenläufiger negativer
Rand) — die Matrix wird nicht mehr von jeder Zuweisung auf ≥44 px aufgezogen; `touchStyle` bleibt
für Schaltflächen. Der Regressionswächter `stopPropagation` aus AUFTRAG_17 ist erhalten.
Vom Review-Chat selbst nachgemessen: `npx tsc --noEmit` **Exit 0**, `node --test test/*.test.mjs`
**226/226, fail 0, Exit 0** (Baseline 208 + 18 neue), keine harte Farbklasse mehr, neue Testdatei
mit LF, Umfang genau zwei Dateien.
**Auflage:** Sichtprüfung durch Dennis; besonders (a) die Ring-Hervorhebung auf Tabellenzellen
mit `border-collapse` (browserabhängig beschnitten) und (b) die vergrößerte, unsichtbare
Trefferfläche des „×", die sich mit benachbarten Chips überlappen **kann** — falls ein Klick den
falschen Chip trifft, ist das die Ursache. **Offen als Teil 2 (AUFTRAG_24, noch nicht
beauftragt):** Tastaturbedienung der Zielzellen und Verschieben in der Monatsansicht.
Kein Commit, kein Push.

**Arbeitsbaum-Hygiene 2026-08-18 (Abschluss der Sitzung):** die CRLF-Umstellung aus
`BEFUND_CRLF_ARBEITSBAUM.md` ist **weitgehend bereinigt** — gemessen tragen nur noch **39**
versionierte Dateien CR, davon **32 unter `.claude/`** (für Claude gesperrt, rein kosmetisch,
nicht CI-relevant) und **7 Binärdateien** (xlsx, png, jpg, ico), deren CR-Bytes auch in HEAD so
stehen, also nichts zu tun. **Alle sieben Shell-Skripte, `app/Dockerfile`, `deploy/compose*.yml`
und beide Workflows sind wieder LF** — der Blocker für den CI-Job `database` und den
Containerstart ist damit weg. Zusätzlich entfernt: `app/testout.log` (Testartefakt, nicht
gitignoriert). `git status` nennt jetzt 238 Einträge bei **43** echten Inhaltsänderungen
(`git diff --stat -w`) — der Rest sind die neuen Dateien aus AUFTRAG 11–23. Verbleibend für
Dennis: die 32 `.claude/`-Dateien (einzeiliger Befehl in `BEFUND_CRLF_ARBEITSBAUM.md`), dann
Commit und CI.

**Build-Blocker 2026-08-18 (AUFTRAG_24, `REVIEW_24.md`) — und die daraus folgende Prüflücke.**
Dennis' lokaler `npm run build` (Next 16.2.12, Turbopack) brach mit **13 Fehlern** ab, alle aus
**einer** Ursache: `app/src/lib/on-call-plan-actions.ts` trägt `"use server"`, und dort sind
**ausschließlich `async function`-Exporte** zulässig (Typ-Exporte sind unschädlich). Der in
AUFTRAG_18 ergänzte Wert-Export `export const MAX_RANGE_DAYS = 92;` verletzt das; Turbopack
verwirft daraufhin **alle** Exporte des Moduls — daher die zwölf Folgemeldungen „Export … doesn't
exist" / „The module has no exports at all" für die vier völlig intakten Server-Actions.
**Behoben:** die Konstante liegt jetzt in dem neuen, seiteneffektfreien Modul
`app/src/lib/on-call-plan-limits.ts` **ohne** Direktive; Actions-Datei und Client-Komponente
importieren von dort. Verhalten unverändert (reine Verlagerung). Vom Review-Chat selbst
nachgemessen: kein Wert-Export mehr in einer `"use server"`-Datei, die Zahl **92** steht genau
einmal (`on-call-plan-limits.ts:20`), beide Importe belegt, `npx tsc --noEmit` **Exit 0**,
`node --test test/*.test.mjs` **227/227, fail 0, Exit 0**.
**Prüflücke, die das offengelegt hat — wichtig für jede künftige Scheibe:** es ist eine
Next.js-/Turbopack-Regel, **keine** TypeScript-Regel. Dennis' Läufe zeigten ESLint still, `tsc`
still und **226/226 grün** — und den Build rot. `tsc`, ESLint und die Unit-Tests decken die
Next-Direktiven **nicht** ab; `npm run build` läuft in den Cowork-Sandboxes umgebungsbedingt
nicht. Ein grünes Review aus dieser Umgebung ist deshalb ausdrücklich **ein Review ohne Build**
und in der Abschlussmeldung so zu benennen, nicht als Fußnote.
**Neuer Wächter gegen genau diese Fehlerklasse** (in `auftrag18-dispo-zeitraum.test.mjs`): über
**alle** Dateien unter `app/src`, deren erste fünf Zeilen die Direktive tragen, muss jeder
`export` `export async function` oder ein Typ-Export sein. Gegengeprobt mit einer Wegwerfdatei
(rot mit sprechender Meldung, danach entfernt, wieder grün). Die zunächst enthaltene feste
Anzahl (`assert.equal(…, 9)`) wurde durch eine **untere Schranke** `>= 9` ersetzt — dieselbe
Bruchstelle wie in AUFTRAG_19/22, die Schranke schützt zugleich davor, dass der Dateiscan ins
Leere läuft und der Test stillschweigend nichts mehr prüft. **Andere Direktiv-Regeln (z. B.
`"use client"`-Grenzen) bleiben weiterhin nur im Build sichtbar.**
**Auflage:** Dennis lässt `npm run build` erneut laufen; erst danach ist der Stand
committierbar.

**Nachweis 2026-08-19 — lokaler Produktions-Build grün, Auflage erledigt.** Dennis hat nach
AUFTRAG_24 `npm run build` erneut ausgeführt: **Exit 0**. Damit ist die seit AUFTRAG_3 in jedem
Review mitgeführte Auflage „`npm run build` lokal durch Dennis" für den Stand der Aufträge
15–24 **erfüllt**; zusammen mit seinen Läufen von `npx eslint .` (still), `npx tsc --noEmit`
(still) und `npm run test:unit` (**226/226**, inzwischen 227/227) ist die vollständige statische
Prüfkette einmal grün gelaufen. Dieselben Läufe hatten zuvor den Build-Blocker aus AUFTRAG_24
aufgedeckt — die Kette wirkt also.
**Merkposten zur Ausgabe:** der erfolgreiche Lauf schreibt Warnungen (`Couldn't load fs`,
`Couldn't load zlib`) nach stderr; PowerShell stellt stderr grundsätzlich als roten
`NativeCommandError` dar, was wie ein Abbruch **aussieht**, aber keiner ist. Der Text steht
nicht im installierten `next`-JavaScript und stammt daher sehr wahrscheinlich aus dem nativen
Windows-Binary (`@next/swc-win32-x64-msvc`), das in den Cowork-Sandboxes nicht existiert.
**Verlässlich ist allein `$LASTEXITCODE`** sowie die Artefakte, die Next erst am Ende eines
erfolgreichen Builds schreibt (`.next/BUILD_ID`, `routes-manifest.json`,
`prerender-manifest.json`, `required-server-files.json`, `next-server.js.nft.json`) — beim
echten Fehlschlag zuvor fehlten sie sämtlich. Künftig `npm run build 2>&1 | Select-Object
-Last 40` plus `$LASTEXITCODE` verwenden, statt die Rotfärbung zu deuten.
**Damit noch offen vor dem Commit:** die 32 CRLF-Dateien unter `.claude/`, der lokale
Datenbanklauf (`run_ap14b_local.ps1 -TemporaryCluster`, dort läuft **Smoke 29 zum ersten Mal**)
und die Sichtprüfungen (`/stammdaten`, Dispo-Board, Logo in allen vier Theme-Zuständen).

**Datenbanklauf 2026-08-19 (Dennis, `run_ap14b_local.ps1 -TemporaryCluster`) — Z7 durch, neuer
Defekt in Z12; AUFTRAG_25/`REVIEW_25.md`.** Der Fix aus AUFTRAG_15 **wirkt**: Z7 ist
durchgelaufen, der Lauf kommt rund 200 Zeilen weiter. Migrationen 0001–0022 und die Fälle Z1–Z11
sind damit erstmals gegen echtes PostgreSQL 18 gelaufen, Aufräumbilanz sauber. Abbruch dann in
**Z12** mit `No function matches the given name and argument types` an
`select count(*), max(detail) …`: `audit_events.detail` ist **`jsonb`** (`0001_init.sql:367`),
und für `jsonb` existiert **keine** Aggregatfunktion `max()` (keine Ordnungsoperatorklasse). Die
Anweisung scheiterte an der Funktionsauflösung, war also **grundsätzlich** nie ausführbar —
erneut **kein Produktcodefehler**, sondern Prüfcode aus AUFTRAG_10, der bis dahin nie erreicht
wurde. **Behoben** durch zwei Anweisungen statt einer (erst `count(*)` prüfen, dann `detail` der
einen Zeile lesen); geprüfte Aussage und alle drei Fehlermeldungen **wörtlich erhalten**.
Vom Review-Chat nachgemessen: keine `max/min/sum(detail)`-Stelle mehr in den Smokes 26–29,
`$$`-Bilanz in 28 **15/15**, Umfang genau eine Datei (`29_hlk_dispo_board.sql` unberührt),
Node-Suite 227/227. **Vorabdurchsicht** von 29 (vollständig, 612 Zeilen) und des Rests von 28
gegen die Migrationen: **kein weiterer nicht ausführbarer Fund**.
**Auflage:** Dennis lässt den Datenbanklauf erneut laufen; **Smoke 29 ist weiterhin nie
gelaufen**, dort sind Erstbefunde möglich — auch inhaltliche, nicht nur syntaktische.

**Review-Lehre (drittes Auftreten desselben Musters in zwei Tagen): ungelaufener Prüfcode ist
kein Nachweis, sondern eine Vermutung.** Erst Z7 (unerreichbare SQLSTATE-Erwartung, weil `using`
bei `delete` filtert statt abzuweisen), dann zwei zu starre Node-Wächter (feste Anzahl, wörtliche
Zeichenkette), jetzt `max(detail)` auf `jsonb`. Gemeinsame Ursache: die Migrationen 0019–0022
waren längst gegen eine echte Datenbank eingespielt, die zugehörigen **Smokes aber nie** — und
genau dort steckten die Fehler. Konsequenz für kommende Scheiben: ein neu geschriebener Smoke
gilt erst als Nachweis, wenn er **einmal gelaufen** ist; bis dahin ist er in jeder Meldung und
jedem Review als „geschrieben, **nicht ausgeführt**" zu führen — nicht als erbrachter Nachweis.

**Datenbanklauf 2026-08-19, zweiter Durchgang — Smoke 28 vollständig grün, Smoke 29 erstmals
gelaufen (AUFTRAG_26).** Der Lauf erreicht erstmals `29_hlk_dispo_board.sql`; damit sind
Migrationen 0001–0022 und die **Smokes 15–28 vollständig** gegen echtes PostgreSQL 18 belegt
(Z7 aus AUFTRAG_15 und Z12 aus AUFTRAG_25 beide erledigt, Aufräumbilanz sauber). Smoke 29 bricht
sofort in der eigenen Fixture-Prüfung ab: `SMOKE AA-FIXTURES FAIL 6 statt 5 Stammdatenzeilen`.
**Ursache: Rechenfehler in der Sollzahl**, kein Produktcodefehler und kein Datenproblem — die
Datei legt 3 Profile, 1 Bauabschnitt und 2 Techniker an (Summe **6**), und die Erfolgsmeldung
desselben Blocks sagt es selbst („drei Identitaeten, ein Bauabschnitt und zwei Techniker"); der
zweite Techniker für die FK-Gegenprobe war ergänzt worden, ohne die Zahl mitzuziehen. **Behoben:**
Sollzahl auf 6, Herleitung (3+1+2) in den Fehlertext aufgenommen, damit sie beim nächsten
Fixture-Zuwachs nicht wieder auseinanderläuft.
**Rechenprobe über die gesamte Datei** (beauftragt, damit nicht jeder Zehn-Minuten-Lauf an der
nächsten falschen Zahl stirbt): **22** Vergleichsstellen geprüft — Policy-Zahlen (2 bzw. 3),
sichtbare Qualifikationen (2), Zuordnungen (2), Restbestand nach Rollback (0), die
SQLSTATE-Proben (23514, 42501, 23505, 23503) und die dynamischen Vorher/Nachher-Vergleiche.
**Genau eine** Korrektur, **keine** unsichere Stelle. Vom Review-Chat nachgemessen: `$$`-Bilanz
**16/16**, Umfang genau eine Datei, Node-Suite **227/227, Exit 0**.
**Auflage:** Dennis lässt den Datenbanklauf erneut laufen. Smoke 29 ist damit weiterhin **nicht
durchgelaufen** — bisher ist nur seine erste Prüfung passiert; die Fälle AA1 ff. sind ungelaufen.

**Arbeitsmodell 2026-08-19 (Entscheidung Dennis): scheduled task `kb-review-zyklus` wieder
aktiviert, Prompt auf das Ein-Chat-Modell umgestellt.** Der Task läuft weiter alle 10 Minuten,
sein Auftragstext war aber noch für das stillgelegte Zwei-Chat-Modell geschrieben (er suchte
„Worker-Meldungen", nannte die überholte Baseline 115/115 und eine längst abgearbeitete
Reihenfolge) — daraus entstand am 2026-08-18 der Doppelauftrag `AUFTRAG_20K`. Neuer Prompt:
(a) er versteht sich ausdrücklich als **Automatiklauf**, nicht als der interaktive Chat;
(b) **Kollisionsregel** — steht „Orchestrator/Review (Chat 1)" in `CHAT_STATUS.md` auf `arbeitet`
mit Zeitstempel jünger als 30 Minuten, beendet er den Durchgang **ohne zu schreiben**, und er
ändert niemals den Abschnitt von Chat 1; (c) er legt **keinen** Auftrag an, dessen Gegenstand
schon in einem vorhandenen `AUFTRAG_*.md` steht; (d) aktuelle Baseline **227/227**, aktuelle
Umgebungsgrenzen (kein Build, kein ESLint, kein PostgreSQL) und die aktuelle Liste offener
Themen; (e) die Projektlehren zu Wächtertests und zu ungelaufenem Prüfcode sind aufgenommen.
`CHAT_STATUS.md`: der zweite Abschnitt heißt jetzt **„Automatiklauf (Chat 2)"** statt „Worker".

**Datenbanklauf 2026-08-19, dritter Durchgang — SQL-Kette vollständig grün (AUFTRAG_27,
`REVIEW_27.md`).** Der Lauf hat Bootstrap, **Migrationen 0001–0022 und die Smokes 15–29**
hinter sich und scheitert erst in der Node-Phase; auch `ap14b-platform.int.mjs` lief durch.
Damit sind die Korrekturen aus AUFTRAG_15 (Z7), 25 (Z12) und 26 (Fixture-Sollzahl) gegen eine
echte PostgreSQL-18-Instanz **belegt**, und **Smoke 29 ist erstmals vollständig gelaufen**.
Rot waren zwei Fälle der Suite `ap14b-masterdata-inventory.int.mjs` mit **einer** Ursache:
**IM6** scheiterte an der exakt verglichenen Feldliste `ContactRow` — die Zeile trägt zusätzlich
`function_id` und `function_label` aus AUFTRAG_6 / Migration `0019` (belegt: `0019` Abschnitt 4
legt `contacts.function_id` als FK auf `contact_functions` an, der Spaltenkommentar hält fest,
dass das Freitextfeld `function` unverändert daneben bestehen bleibt; `masterdata.ts` führt alle
drei; `REVIEW_6.md` grün). **Die Projektion war richtig, veraltet war der Test** — Erwartung
ergänzt, Prüfung bleibt exakt (`deepEqual` über sortierte Schlüssel), nicht auf „enthält"
gelockert. **IM7 war ein Folgefehler**: die Meldung `2 !== 1` betrifft die **Vorbedingung**
`before.phones.length === 1` (Zeile 1014), weil IM6 abbrach, bevor sein zweiter
`saveContact`-Aufruf die Nummern von zwei auf eine reduzierte — **kein** Transaktionsproblem.
**Ausdrücklich offen:** die Zusage „`saveContact` hinterlässt bei einem Fehler im zweiten Schritt
keinen Teilstand" wurde in diesem Lauf **gar nicht geprüft**; sie ist weder belegt noch
widerlegt und gilt erst nach einem Lauf, in dem IM7 sie tatsächlich erreicht — **nicht**
rückwirkend als „war schon in Ordnung" verbuchen. Die übrigen 19 Feldlisten der Suite wurden
gegen die heutigen Projektionen geprüft, keine weitere Abweichung. Vom Review-Chat nachgemessen:
Umfang genau eine Datei, **21** `assertKeys`-Aufrufe unverändert, exakte Vergleichsform erhalten,
`node --check` Exit 0, Node-Suite **227/227, Exit 0**.
**Noch nie gelaufen (seit 0019–0022):** `ap14b-images`, `ap14b-admin-users`,
`ap15-dashboard-metrics`, `ap15b-incident-list` — dort sind weitere Befunde derselben Art
möglich. `assertKeys` gibt es allerdings nur in der Stammdaten-Suite.
**Einordnung: vierter Befund in Folge, bei dem der PRÜFCODE hinterherhinkte, nicht die
Anwendung** (Z7, Z12, Fixture-Sollzahl, Feldliste). Alle vier aus Scheiben, deren Migrationen
längst gegen eine echte Datenbank liefen, deren Prüfcode aber nie. Umgekehrt gelesen: die
Anwendung selbst hat sich in dieser Prüfrunde bislang **nicht** als fehlerhaft erwiesen.

**Automatiklauf bewährt sich (2026-08-19).** Der wieder aktivierte scheduled task hat
eigenständig `REVIEW_26.md` geschrieben, dabei die neue **Kollisionsregel eingehalten**
(eigener Abschnitt „Automatiklauf (Chat 2)", Chat 1 unberührt, danach zurück auf `frei`),
**keinen** neuen Auftrag angelegt und mit eigenen Messwerten dasselbe Urteil erreicht wie dieser
Chat. Damit funktioniert das Modell „interaktiver Chat plus unabhängiges automatisches
Gegenlesen" ohne Schreibkonflikt.

**NACHWEIS 2026-08-19 — vollständiger Datenbanklauf grün. Die größte offene Auflage seit dem
2026-08-17 ist damit erledigt.** Dennis' Lauf von `run_ap14b_local.ps1 -TemporaryCluster` endet
mit der Abschlusszeile

> `ERGEBNIS: AP10/AP11/AP12/AP13/AP14B/AP15/AP15-b DATENBANKTESTS ERFOLGREICH.`

Belegt ist damit gegen eine **frische, temporäre PostgreSQL-18-Instanz** (eigenes Cluster auf
Port 55432, nicht der Windows-Dienst):

- **Bootstrap und Migrationen 0001–0022** in der vorgesehenen Reihenfolge, `ON_ERROR_STOP`;
- **alle SQL-Smokes 15–29**, einschließlich der drei in dieser Sitzung korrigierten Fälle
  Z7 (AUFTRAG_15), Z12 (AUFTRAG_25) und der Fixture-Sollzahl von Smoke 29 (AUFTRAG_26);
- **alle Node-Integrationssuiten**, einschließlich der vier, die seit den Migrationen 0019–0022
  nie gelaufen waren (`ap14b-images`, `ap14b-admin-users`, `ap15-dashboard-metrics`,
  `ap15b-incident-list` — letztere mit 13/13);
- **Aufräumbilanz vollständig**: Port frei, Clusterverzeichnis und Arbeitsverzeichnis entfernt,
  temporäre Anmelderolle und Testdatenbank gelöscht.

**Damit ist auch die Zusage aus IM7 erstmals wirklich geprüft:** `saveContact` hinterlässt bei
einem Fehler im zweiten Schritt keinen Teilstand. Im vorherigen Lauf war IM7 nur an seiner
Vorbedingung gescheitert und die Zusage ungeprüft geblieben (siehe `REVIEW_27.md`) — jetzt ist
sie belegt, nicht rückwirkend angenommen.

**Stand der Nachweise für die Scheiben AUFTRAG_15–27:** lokaler Produktions-Build **Exit 0**,
ESLint still, `npx tsc --noEmit` **Exit 0**, Unit-Tests **227/227**, vollständiger
Datenbanklauf **grün**. Die einzige verbliebene Prüfung ist der **CI-Lauf nach dem Push** —
er wiederholt die Kette auf einer frischen Umgebung und prüft zusätzlich Container und
Objektspeicher.

**Vor dem Commit bleibt:** die 32 CRLF-Dateien unter `.claude/` (kosmetisch, nicht CI-relevant,
Einzeiler in `BEFUND_CRLF_ARBEITSBAUM.md`) und die **Sichtprüfungen im Browser**
(`/stammdaten`-Akkordeon, Dispo-Board einschließlich „von–bis"-Dialog und Besetzungsanzeige,
Logo in allen vier Theme-Zuständen) — keine davon ist durch einen Testlauf ersetzbar.

**Befund 2026-08-19 — verwaiste `.git/index.lock` blockiert den Commit und bläht `git status`
künstlich auf.** `git add -A` und `git commit` scheitern mit
`fatal: Unable to create '…/.git/index.lock': File exists. Another git process seems to be
running…`. Gemessen: die Datei ist **0 Byte groß und vom 2026-08-17, 19:09** — also zwei Tage
alt und kein laufender Vorgang. Sie ist derselbe OneDrive-/FUSE-Effekt, der schon am 2026-07-26
zur „Lock-Quarantäne" unter `C:\Backup` geführt hat; im `.git`-Verzeichnis liegen bis heute
**18 weitere** Altlasten dieser Art (`HEAD.lock.*`, `index.lock.*`, `*.lock.stale`,
`*.lock.trash*`). Nur die exakten Namen `index.lock` und `HEAD.lock` wirken als Sperre, die
übrigen sind Müll ohne Wirkung.
**Zweite, unmittelbare Folge — wichtig für die Beurteilung des Stands:** solange die Sperre
liegt, kann Git den **Index nicht auffrischen**. `git status` meldet dann jede Datei als
`modified`, deren Zeitstempel sich geändert hat, auch wenn ihr **Inhalt identisch** ist. Genau
das erklärt Dennis' Liste mit **184** geänderten Dateien: eigene Messung im selben Arbeitsbaum
ergibt `git diff --numstat` → **44** Dateien mit echter Inhaltsänderung und **0** Dateien mit
reiner Modusänderung; `git diff --raw` auf Stichproben (`Willkommen.md`,
`deploy/scripts/db-backup.sh`, `app/src/lib/auth-service.ts`, `.gitignore`) liefert **keine**
Ausgabe, sie sind also unverändert. `core.fileMode` steht bereits auf `false`.
**Erwarteter Stand nach dem Entfernen der Sperre:** rund **44** geänderte plus **69** neue
Dateien statt 184 + 69. **Vorgehen wie 2026-07-26: verschieben, nicht löschen** — die Lock-Datei
wird zur Seite gelegt, damit sie im Zweifel noch da ist.

## Definitionen und Begriffe
- **AP1–AP7:** Arbeitspakete (Grundgerüst → Vorgänge → Material → Bilder → Offline/PWA → E2E/Härtung → Release Readiness).
- **Outbox:** IndexedDB-Warteschlange vorgemerkter Notizen/Statusänderungen.
- **Upload-Queue:** IndexedDB-Warteschlange für Bild-Uploads.
- **Client-Action-ID:** stabile Idempotenz-ID je Offline-Aktion.
- **Konflikt:** serverseitige Änderung (`updated_at`) seit lokaler Erfassung → keine stille Überschreibung.
- **@public/@app:** E2E-Testklassen ohne bzw. mit authentifiziertem Anwendungsstack. `@public`
  läuft lokal und in der CI ohne externes Backend; `@app` läuft später gegen die interne
  PostgreSQL-/Auth.js-Testumgebung mit synthetischen Daten. Eine Test-Supabase ist durch ADR-011
  aufgehoben.

## Wichtige Änderungen (mit Datum)
- 2026-07-19 AP3: Material-/Lagerverwaltung (Migration 0004), Commit `ac7b4d1`.
- 2026-07-19 AP4: Bilddokumentation/CSV (Migration 0005), Commit `e9e16ac`.
- 2026-07-19 AP5: Offline/PWA, Commit `e13b4cf`.
- 2026-07-19 AP6: E2E + Idempotenz (Migration 0006), Commit `88336f8`.
- 2026-07-19 AP7: Release Readiness/Security/Doku (Commit siehe CHANGELOG).

## Offene Punkte (nicht verifiziert / benötigt Infrastruktur)
- **Push AP4–AP7 nach GitHub** (Zugangsdaten) – lokal committet, nicht gepusht.
- Öffentliche Browsertests laufen lokal und in der CI ohne externes Backend. Die authentifizierten
  `@app`-E2E folgen später gegen die interne PostgreSQL-/Auth.js-Testumgebung mit synthetischen
  Daten (Browser-Systembibliotheken erforderlich). Keine Supabase-Stage, kein Supabase-Zugang zu
  beschaffen.
- a11y-Browserlauf, PWA-Installation/SW-Update-Runtime, Benutzerwechsel im Browser.
- Deployment- und Recovery-Test (Zielinfrastruktur), Performance-Messungen.
- CSP auf durchsetzend umstellen (nach Browser-Verifikation).
- postcss-Schwachstelle (moderate, build-time) – mit Next-Update beheben.
- Middleware→Proxy-Migration (Next 16 Deprecation).
- Aufbewahrungsfristen für Soft-Delete/Audit (fachlich/juristisch festzulegen – nicht erfunden).

## Nachtrag AP8 (2026-07-19)
- **GUI/UX:** zentrales Designsystem in `globals.css` (Tokens) + `components/ui/`-Primitive;
  Dark Mode (Light/Dark/System) über `data-theme` + `prefers-color-scheme`, Umschalter in der
  Seitenleiste, No-FOUC-Init. App-Chrome (AppShell) theme-fähig; Skeleton-Ladezustände; Fokus/A11y/
  Safe-Area verbessert. Keine Fachfunktion geändert.
- **Entscheidung:** Politur bewusst konservativ und buildsicher; volle `dark:`-Ausgestaltung aller
  Altscreens + App-Screenshots/visuelle Feinabnahme sind Folgeausbau (Browser + interne
  PostgreSQL-/Auth.js-Testumgebung nötig; keine Test-Supabase).
- Commit AP8: siehe CHANGELOG. Push weiterhin offen (Zugangsdaten).

## Nachtrag AP9 (Stammdaten & Einstellungen)
- Migration `0007_ap9_master_data.sql` (additiv): customers, vzg_lines, contacts (+Telefonnummern,
  +M:N Bauabschnitte), technicians, teams (+M:N Mitglieder), cable_types (Seed), app_settings
  (Singleton); `construction_stages` um `wus_bst`/`default_on_call_number_id` erweitert; Enum
  `phone_type`. RLS `is_staff()` (admin+disponent), Monteur nur lesend; `construction_stages`
  auf `is_staff()` erweitert. Löschen fachlich nur über `is_active`.
- `tg_audit` feldgenau (CREATE OR REPLACE, `detail.op` erhalten) – eine Auditlösung.
- UI: Navigationsgruppe „Stammdaten" + 8 token-basierte, responsive CRUD-Seiten; Monteur-CSV-Import
  (Vorschau/Validierung/Dublettenerkennung, keine stille Überschreibung).
- Verifiziert lokal: lint/tsc/build grün; AP9-Smoke 26/26; Bestandssmokes 10/11/12/13 grün; CSV-Test 14/14.
- Commit `feat: implement master data management (AP9)`. AP8.1-Branding nicht Teil des Commits.

## Nachtrag AP10 (Vorgangserfassung auf Stammdatenbasis)
- Migration `0008`: incidents.customer_id/vzg_line_id (FK, nullable), NOT-NULL auf km_from/vzg_line_number
  gelöst; `incident_cable_positions` (Kabelart positionsbezogen, kein incidents.cable_type_id);
  transaktionale RPCs `create_incident_ap10`/`update_incident_ap10` (SECURITY INVOKER); Backfill vzg/customer.
- Erfassungs-/Bearbeitungsmaske neu (AP8-Tokens, abhängige Dropdowns, Pflicht ≥1 Kabelposition).
- Offline-Neuanlage NICHT Teil von AP10; Bilder zweiphasig; AP9-Kontakte noch nicht verknüpft.
- Verifiziert lokal: lint/tsc/build; AP10-Smoke 12/12; Backfill ok; Regression 11/13/14 grün.
- Commit `feat: integrate master data into incident creation (AP10)`; AP8.1-Branding nicht im Commit.

## Nachtrag AP11 (Operative Vorgangsliste)
- Migration `0009`: View `incident_list_view` (`security_invoker`) für RLS-konforme, serverseitige
  Suche/Filter/Sortierung/Pagination inkl. Aggregaten (Bilder/Kabelarten/Monteure) + `search_text` +
  `created_date_local`. Reads `listIncidentsPaged`/`listIncidentsForExport`; Typen/Helfer in `incident-list.ts`.
- `/vorgaenge` = zentrale operative Liste (staff-only), URL als Zustandsquelle; Desktop-Tabelle (Sticky) +
  Mobile-Karten; Auswahl + vorbereitete (deaktivierte) Massenaktionen; CSV-Export der gefilterten Menge (Cap 5.000).
- StatusBadge/PriorityBadge nutzen jetzt das AP8-Badge-Primitive (Tones). Dashboard bis AP15 unverändert.
- Offene Hinweise abgeleitet (kein Aufgabenmodell); keine Offline-Liste; kein Audit durch die Liste.
- Verifiziert lokal: lint/tsc/build; AP11-Smoke 8/8; Performance 600; Regression 11/13/14/15 grün.
- Commit `feat: implement operational incident list (AP11)`; AP8.1-Branding nicht im Commit.

## Nachtrag Stabilisierung und Roadmap (2026-07-26)
- **Git:** AP9–AP11 wurden nach `origin/main` gepusht; funktionaler AP11-Stand ist `1b8d071`.
  `main` und `origin/main` sind synchron und enthalten zusätzlich die nachfolgenden
  Dokumentations-Commits.
- **Sicherung:** Vollständige, hashidentisch verifizierte Dateisystemkopie unter
  `C:\Backup\Kabelbereitschaft_2026-07-25_191847`; vollständiges Git-Bundle unter
  `C:\Backup\kabelbereitschaft_main_2026-07-26.bundle`.
- **Locks:** Die verwaisten `.git/index.lock` und `.git/HEAD.lock` wurden nach
  `C:\Backup\Kabelbereitschaft_Lockquarantaene_2026-07-26_093108` verschoben. Git-Integrität
  anschließend bestätigt; die übrigen Altlasten blieben unangetastet.
- **Roadmap:** AP12–AP15 sind in `00-Projektsteuerung/ROADMAP_AP12_AP15_ENTWURF.md` geplant.
  Dennis hat AP12 am 2026-07-27 mit „Mach jetzt weiter“ ausdrücklich zur Implementierung
  freigegeben.
- **Datenschutz:** V1 (Aufbewahrungsfristen für Personen-, EXIF-/GPS- und Auditdaten) bleibt offen
  und wirkt als Produktionssperre. Stage/Test bis zur Entscheidung ausschließlich mit
  synthetischen Daten.
- **Repository:** Am 2026-07-26 wurde vorübergehend ein frischer GitHub-Clone unter
  `C:\dev\Kabelbereitschaft` angelegt und kurzzeitig als führender Arbeitsort geführt.
  **Diese Festlegung hat Dennis am 2026-07-26 ausdrücklich aufgehoben** (siehe folgender
  Abschnitt).
- **Branding:** AP8.1 getrennt als Commit `04253a2` auf Branch
  `feat/ap8.1-branding` gesichert und nach GitHub gepusht. TypeScript, ESLint und
  Next.js-Produktions-Build im frischen Clone erfolgreich.
- **Lokale Laufzeit:** Der unqualifizierte Windows-Befehl `node` wird auf diesem Rechner
  derzeit fälschlich als `C:\Windows\System32\Node.js` über Visual Studio geöffnet.
  Die belastbaren Prüfungen wurden deshalb mit
  `C:\Program Files\nodejs\node.exe` ausgeführt. Diese Windows-Zuordnung ist vor dem
  regulären Entwicklerbetrieb separat zu korrigieren.

## Verbindlicher Arbeitsort (Entscheidung Dennis, 2026-07-26)

Diese Festlegungen gelten dauerhaft und ersetzen alle früheren Standortaussagen.

- **Diese Datei ist die zentrale und für alle Projektchats verbindliche Projektübersicht.**
  Neue Entscheidungen und Statusinformationen werden hier konsolidiert; zusätzliche parallele
  Übersichts- oder Statusdokumente werden nicht angelegt.
- **Einziger Projekt- und Arbeitsort** ist der Kabelbereitschaft-Vault
  `C:\Users\DennisKühnhold\OneDrive - W & S Technik GmbH\Kabelbereitschaft-App\Kabelbereitschaft-App`.
- `C:\dev\Kabelbereitschaft` war ein **vorübergehender technischer Clone** und wurde am
  2026-07-26 nach vollständiger Kontrolle in den Windows-Papierkorb verschoben;
  `C:\dev` selbst blieb bestehen.
- Nach dem geprüften Inventar vom 2026-07-26 enthält der Dev-Ordner **keine einzigartige
  relevante Projektdatei**: 226 verglichene Dateien, keine ausschließlich dort vorhanden;
  alle Abweichungen waren durch den Commit `455c71d`, den ausgecheckten Branch oder
  generierte Artefakte erklärbar.
- **Fehlender Werkzeug- oder Ordnerzugriff darf niemals zur eigenständigen Anlage eines
  Ersatzordners führen.** Kein Ausweichen auf Sitzungs-, Ausgabe- oder temporäre Ordner, keine
  zusätzliche Repository-Kopie, keine eigenmächtige Verlagerung des Projekts.
- Bei fehlendem Zugriff **halten Claude bzw. Codex an**, nennen den exakten Blocker (Pfad oder
  Dienst) und bitten Dennis um Zugang. Ein Arbeitsschritt darf nicht in einer Sandbox simuliert
  und als erledigt gemeldet werden.
- **Neue dauerhafte Projektdateien und Arbeitsergebnisse entstehen ausschließlich im Vault.**
- Die Sicherungen unter `C:\Backup` (Vollsicherung, Git-Bundle, Lock-Quarantäne) bleiben
  unverändert und sind **keine Arbeitsorte**.
- Das **Risiko von Git-Schreiboperationen in OneDrive bleibt bekannt und bewusst akzeptiert**.
  Es wird transparent dokumentiert und durch Vollsicherung, Git-Bundle, GitHub-Remote und
  Lockprüfung abgesichert. Ein erneuter Umzug aus OneDrive wird nicht vorgeschlagen, solange
  Dennis diese Entscheidung nicht ausdrücklich ändert.
- **Branding** bleibt auf `feat/ap8.1-branding` (`04253a2`, auf GitHub gesichert) und ist
  **nicht** nach `main` gemergt.
- **AP12 ist seit 2026-07-27 ausdrücklich freigegeben und technisch abgeschlossen.** Implementiert sind
  Migration `0010_ap12_incident_details.sql`, die neuen AP12-RPCs, Mehrfach-Kabelpositionen
  mit Menge/Einheit/Zustand, Kontakt-FK und historischer Snapshot, minimierte
  Monteur-Kontaktprojektion, die erweiterte Vorgangsdetail-/Bearbeitungsoberfläche sowie die
  Pflege der Bereitschaftsnummern. TypeScript, ESLint und Next.js-Produktions-Build sind
  erfolgreich. Der lokale PostgreSQL-18-Lauf mit Migrationen 0001–0010 und den AP10–AP12-
  Smoke-Tests ist ebenfalls vollständig erfolgreich; die temporäre Testdatenbank wurde
  anschließend entfernt. Der Teststarter behandelt PostgreSQL-NOTICE-Ausgaben korrekt über
  den Prozess-Exitcode, und die AP11-Zähltests sind gegen vorangehende Fixture-Daten isoliert.
  Der geprüfte AP12-Stand wurde als Commit `761e89d` (`feat: implement AP12 incident details`)
  nach `origin/main` gepusht; `main` und `origin/main` waren anschließend identisch und die
  Arbeitskopie sauber.
- **V1** (Aufbewahrungsfristen) bleibt offen und wirkt als **Produktionssperre**; Stage und Test
  ausschließlich mit synthetischen Daten.

## AP13 — freigegebene Architektur (Entscheidung Dennis, 2026-07-27)

Die Architektur ist unter den folgenden verbindlichen Präzisierungen freigegeben. **Die
Implementierung ist inzwischen erfolgt und lokal technisch verifiziert — siehe folgender
Abschnitt.** Details in Roadmap B.3 (Version 1.14).

- **Zuständigkeit:** `assignee_profile_id` → `profiles(id)` ist die einzige berechtigungswirksame
  persönliche Zuständigkeit. `assignee_team_id` und `assignee_role` sind rein informative Filter-
  und Anzeigeattribute und erscheinen nicht in RLS-Ausdrücken. Aufgaben dürfen unzugewiesen sein.
  Keine Kopplung an `technicians` — **V3 bleibt unverändert.**
- **Wertebereiche:** `text` mit Check-Constraints, **keine neuen PostgreSQL-Enums** (konsistent zu
  AP12 `condition_code`). Status `open`/`in_progress`/`acknowledged`/`void`, Priorität
  `low`/`normal`/`high`; deutsche Bezeichnungen nur in der UI. `acknowledged_at` und
  `acknowledged_by` sind genau dann beide gesetzt, wenn `status = 'acknowledged'`, sonst beide
  `NULL`. Quittieren in RC1 nur durch Staff. Aufgaben können nicht gelöscht werden.
- **Ableitungen:** höchstens ein `derived`-Datensatz je `(incident_id, task_type)`. Zutreffende
  Ursache erzeugt die Aufgabe oder setzt sie von `void` auf `open`; entfallene Ursache setzt sie
  auf `void`; eine bereits quittierte, weiter bestehende Aufgabe bleibt `acknowledged`. Die
  Synchronisierung läuft **datenbankseitig über Trigger** auf `incidents`,
  `incident_assignments`, `incident_images` und `incident_cable_positions` — eine Aktualisierung
  erst beim Seitenaufruf ist unzulässig. Mit Migration 0011 erfolgt ein idempotenter Backfill;
  `deriveOpenHints()` entfällt danach, damit keine Doppelanzeige entsteht.
- **Monteur-Sicht:** kein direktes Tabellenrecht auf `incident_tasks`, deshalb **keine
  `security_invoker`-Projektion**. Zugriff über eine eng begrenzte **`SECURITY DEFINER`-RPC** mit
  festem `search_path`, Prüfung auf angemeldeten Benutzer und `is_assigned_to_incident()`;
  Rückgabe ausschließlich `incident_id`, `task_type`, `title`, `status`, `due_at` — keine
  Zuständigkeitsfelder, keine Namen, keine Auditfelder. `REVOKE` für `public`/`anon`,
  `GRANT EXECUTE` nur an `authenticated`.
- **Bulk-Statusänderung:** `SECURITY INVOKER` unter der Benutzersession, Obergrenze 200 Vorgänge
  als harter Fehler. **Ein äußerer RPC-Aufruf mit abgefangenen Subtransaktionen je Eintrag** —
  keine unabhängig committeten Einzeltransaktionen; ein unerwarteter technischer Fehler rollt den
  gesamten Aufruf zurück. Konflikt über `expected_updated_at`; stabile Codes `ok`, `conflict`,
  `not_found`, `guard_rejected`, `invalid_status`. Je Erfolg genau ein Auditeintrag und ein
  Status-Historieneintrag über die bestehenden Trigger.
- **Bulk-Monteurzuweisung:** `p_monteur_id` muss ein aktives `profiles`-Profil mit Rolle `monteur`
  sein. Additiv und idempotent, bestehende aktive Monteure bleiben, identische Zuweisung ist ein
  erfolgreiches No-op. Da `incidents.updated_at` konkurrierende Zuweisungen nicht zuverlässig
  erkennt, führt jedes Eingabeelement zusätzlich die **erwartete sortierte Menge aktiver
  `monteur_id`-Werte**; Abweichung ergibt `conflict`. Einzel- und Bulk-Zuweisung nutzen denselben
  kontrollierten RPC-/Sperrpfad. Eigener Auditeintrag je Zuweisung; Historieneintrag nur bei
  echter Statusänderung.
- **Liste:** `has_open_task` additiv in `incident_list_view`; offen sind ausschließlich `open` und
  `in_progress`.

## AP13 — Umsetzung: technisch abgeschlossen (2026-07-28)

**Status: technisch abgeschlossen.** Commit, Push und grüner CI-Nachweis liegen vor.

### Umgesetzter Umfang

- Migration `0011_ap13_tasks_bulk.sql`, additiv und wiederholbar: Tabelle `incident_tasks` mit
  `text`-Spalten und Check-Constraints (kein Enum), Kohärenz-Constraint für
  `acknowledged_at`/`acknowledged_by`, partieller Unique-Index
  `(incident_id, task_type) where source = 'derived'`, Indizes auf `(incident_id, status)`,
  `(assignee_profile_id, status)` und `(status, due_at)`, `tg_touch_updated`, `tg_audit`,
  dreifache Löschsperre (keine Delete-Policy, `revoke delete`, abweisender Trigger), RLS
  ausschließlich für `is_staff()`.
- Gehärtete interne Reconciliation `sync_incident_tasks_internal` als `SECURITY DEFINER` mit festem
  `search_path`; `EXECUTE` für `public`, `anon` und `authenticated` entzogen, Aufruf nur über
  Trigger. Notwendig, weil die Trigger auch durch zulässige Monteur-Aktionen ausgelöst werden.
- Trigger auf `incidents` (`vzg_line_id`/`vzg_line_number`), `incident_assignments`,
  `incident_images` und `incident_cable_positions`; idempotenter Backfill in der Migration;
  Staff-Refresh `refresh_incident_tasks_ap13`.
- Ableitungslogik für `no_monteur`, `no_images`, `no_cable`, `historic_vzg`: Ursache vorhanden →
  Aufgabe erzeugen oder aus `void` wieder `open`; Ursache entfallen → **immer** `void`, wobei
  `acknowledged_at` und `acknowledged_by` atomar auf `NULL` gesetzt werden. Eine quittierte Aufgabe
  bleibt nur `acknowledged`, solange ihre Ursache besteht.
- Minimierte Monteur-Sicht `get_assigned_incident_tasks` als `SECURITY DEFINER`: weist
  `auth.uid() is null` ab, prüft `is_assigned_to_incident()`, liefert nur `incident_id`,
  `task_type`, `title`, `status`, `due_at`.
- `has_open_task` wird **RLS-konform innerhalb** der `security_invoker`-View `incident_list_view`
  ermittelt; es gibt bewusst **keinen** allgemein aufrufbaren Definer-Helfer, der den
  Aufgabenstatus fremder Vorgänge preisgeben könnte.
- Bulk-Statusänderung `bulk_update_incident_status_ap13` als `SECURITY INVOKER`: Obergrenze 200 als
  harter Fehler, ein äußerer Aufruf mit **abgefangener Subtransaktion je Eintrag**, unerwartete
  technische Fehler rollen den Gesamtaufruf zurück, Konfliktprüfung über `expected_updated_at`,
  Codes `ok`/`conflict`/`not_found`/`guard_rejected`/`invalid_status`.
- Monteurzuweisung `assign_incident_monteur_ap13` als gemeinsamer gesperrter Pfad für Einzel- und
  Bulk-Aufruf (`select … for update`), Vergleich von `expected_updated_at` **und** der erwarteten
  sortierten Menge aktiver `monteur_id`-Werte, additiv und idempotent mit No-op bei bestehender
  Zuweisung, Statuswechsel nur aus `neu`; `bulk_assign_incident_monteur_ap13` nutzt denselben Pfad.
- Oberfläche und Server Actions: Aufgabenanzeige im Vorgangsdetail (Staff bearbeitbar, Monteur nur
  minimierte Liste), Filter „hat offene Aufgabe" mit URL-Parameter, aktivierte Massenaktionsleiste
  mit Teilerfolgsbericht je Vorgang, Einzelzuweisung auf den RPC-Pfad umgestellt.
  `deriveOpenHints()` ist aus Anzeige und CSV-Export entfernt; die CSV führt stattdessen
  „Offene Aufgabe" mit Ja/Nein. Keine Offline-Aufgabenbearbeitung.

### Prüfergebnisse (bestätigt)

- TypeScript, ESLint und Next.js-Produktions-Build: erfolgreich.
- Lokaler PostgreSQL-Lauf über `app/supabase/test/run_ap12_local.ps1`: Migrationen **0001–0011**
  erfolgreich, Smokes **AP10, AP11, AP12 und AP13** erfolgreich, keine `SMOKE … FAIL`-, `ERROR`-
  oder `FATAL`-Meldung, Abschlusszeile
  `ERGEBNIS: AP10/AP11/AP12/AP13 DATENBANKTESTS ERFOLGREICH.`
- Ausdrücklich nachgewiesen: **E20a–E20c** (quittierte Aufgabe bleibt bei fortbestehender Ursache
  `acknowledged`; entfallene Ursache führt zu `void` mit beiden Quittierungsfeldern `NULL`;
  Wiederauftreten öffnet dieselbe Aufgabe unquittiert wieder) und **E21a–E21c** (kein frei
  nutzbarer Definer-Helfer, fremder Monteur ohne View-Zeile, zugewiesener Monteur mit genau einer
  View-Zeile und `has_open_task = false` bei gleichzeitig funktionierender RPC-Sicht).
- Temporäre Testdatenbank `kabelbereitschaft_ap12_test_20260728_104535` anschließend entfernt.
- Zwei Testaufbaufehler wurden im Vorlauf behoben (kein Produktfehler): `ON_ERROR_STOP` steht in
  `18_ap13_tasks.sql` auf `on`, die pauschalen Rechte früherer Smokes werden für `app_user` gezielt
  entzogen (`DELETE` auf `incident_tasks`, `EXECUTE` auf `sync_incident_tasks_internal`), und die
  Auditabfragen nutzen die tatsächlichen Spalten `entity`/`entity_id` im Admin-Kontext.

### Abschluss: Commit, Push und grüne CI (2026-07-28)

- AP13-Commit `76d93cae0764cbfe13d9cbd9bb25b54cb3c9506b`, Abhängigkeitskorrektur
  `e1025327ab25b72192b59eba73015681a0bd0912`, PWA-Korrektur
  `5c60031e3765753c6a1df8d7bf8d0a0b97716605`. `main` = `origin/main` =
  `5c60031e3765753c6a1df8d7bf8d0a0b97716605`, Arbeitskopie sauber.
- GitHub-CI-Lauf `30376903965`: Ergebnis `success` (https://github.com/DKuehnhold/Kabelbereitschaft/actions/runs/30376903965). Produktions-Audit erfolgreich;
  TypeScript, ESLint und Produktions-Build erfolgreich; Playwright Chromium installiert;
  alle 11 öffentlichen E2E-/a11y-Tests erfolgreich.
- **PWA-Korrektur:** `ServiceWorkerRegister.tsx` merkt sich beim Einrichten, ob die Seite
  bereits von einem Service Worker kontrolliert wurde. Nur dann löst ein späterer
  Controllerwechsel einen Reload aus; die erste Aktivierung beim Erstbesuch lädt nicht mehr
  neu. Die axe-core-Prüfungen auf `/login` und `/offline` sind damit grün, ohne den Service
  Worker im Test zu blockieren.

### Offen

**V1** bleibt Produktionssperre (Stage und Test nur mit synthetischen Daten), Branding bleibt
separat auf `feat/ap8.1-branding` (`04253a2`, nicht gemergt), **kein RC1-Tag**. AP14B
`data-incidents-tasks-sync` ist seit dem 2026-07-31 gemergt (Commit `6b9d8dd`); Stammdaten und
Inventar sind seit dem 2026-08-01 gemergt (Commit `79d8844`). **Bilder und Uploads** sind seit dem
2026-08-01 mit Commit `edfafb4` und CI-Korrektur `cbe17b3` (Pull Request #5) gemergt und durch den
CI-Job `objectstore` gegen einen echten MinIO-Container belegt (siehe „AP14/B — Bilder und
Uploads auf MinIO“). Damit sind die AP14/B-Datenpfade technisch abgeschlossen; **AP14 insgesamt
bleibt offen** (echte IT-Adressen und Same-Origin-Reverse-Proxy, Betrieb und Deployment,
vollständige `@app`-/Offline-Abnahme, CSP-Auswertung). Nächstes nicht-visuelles Paket ist die
administrative Benutzerverwaltung nach ADR-011 (Reset mit temporärem Passwort und
`must_change_password`, Deaktivierung, Rollenwechsel, jeweils mit Sitzungswiderruf und Audit).
Die Browser-E2E der Massenaktionen bleibt diesen Ablösungen nachgeordnet.
