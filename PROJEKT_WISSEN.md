# Projektwissen – Kabelbereitschaft
> Stand: 2026-08-03 · Nur bestätigte Ergebnisse. Nicht ausgeführte Prüfungen sind als offen markiert.

> **Aktueller Stand (2026-08-03).** Zielplattform bleibt ADR-011: PostgreSQL 18, Auth.js v5, MinIO
> und Containerbetrieb hinter dem internen Reverse-Proxy; Supabase ist kein Ziel. Bestätigter
> technischer Referenzstand ist `8b65f4ed9c1175ddec3aca5045a5a59906b95c68`
> (`feat: add RLS-bound dashboard status metrics`) auf `main`. AP15-1 berechnet die fünf
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
> Abnahme sowie die CSP-Auswertung sind **nicht** erbracht. Nächster nicht-visueller Arbeitsblock
> ist **AP15 Dokumentkonsolidierung**. Die sichtbare GUI der Benutzerverwaltung wartet
> weiterhin auf die gemeinsame Designentscheidung mit Dennis.
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
- **Migrationen:** additiv/idempotent; aktuell `0001`–`0017` (Stand 2026-08-03). Sie liegen
  vollständig auf `main`.
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

## AP15-2 — quellentreue operative Dokumentkonsolidierung (2026-08-03, nicht committet)

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
  Negativfälle aus `20_ap14b_data.sql`); die Kette ist wegen `0013` und `19a` **nicht durchgehend
  additiv**; `0002_storage.sql` trägt keine AP-Nummer (AP2 ist `0003`); `0017` enthält **vier**
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
  RC1, Tag, Release und die V1-Entscheidung. `deploy/README.md:344` nennt weiterhin
  „0001…0016" und ist damit überholt — die Datei stand nicht auf der Positivliste.

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
