# Projektwissen – Kabelbereitschaft
> Stand: 2026-07-31 · Nur bestätigte Ergebnisse. Nicht ausgeführte Prüfungen sind als offen markiert.

> **Aktueller Stand (2026-07-31).** Zielplattform bleibt ADR-011: PostgreSQL 18, Auth.js v5, MinIO
> und Containerbetrieb hinter dem internen Reverse-Proxy; Supabase ist kein Ziel. Bestätigter
> Repository-Stand ist `main` = `origin/main` = `6b9d8dd7b4b937b3a2cb055b509557ed17313430`
> (`feat: migrate incident and task data paths to PostgreSQL`); der frühere Stand
> `22db6dad8958146be4de667a55e89ba170e73b7c` ist ein Vorfahre und damit überholt. Die Datenpfade
> für **Vorgänge, Aufgaben und Offline-Sync** sind auf PostgreSQL 18 migriert, lokal und in der CI
> verifiziert. Die weiter unten mit „(2026-07-28, nicht committet)“ gekennzeichneten
> AP14/B-Abschnitte beschreiben den Stand jenes Tages, sind in diesen Merges enthalten und behalten
> ihre historischen Prüfnachweise unverändert. Nächster nicht-visueller Arbeitsblock ist die
> Ablösung der verbliebenen Supabase-Datenpfade in **Stammdaten und Inventar** nach
> PostgreSQL/RLS; Bilder und Uploads folgen mit dem MinIO-Bildspeicher. V1 bleibt
> Produktionssperre, Branding bleibt separat, GUI-/Designarbeit wartet auf Dennis.

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
  RLS, Auth.js v5, MinIO und Tailwind. Noch vorhandene Supabase-Bibliotheken und
  -Zugriffe sind ausschließlich abzulösender Altbestand aus AP1–AP13.
- **Sicherheit:** RLS ist maßgeblich; signierte URLs für private Bilder; keine Secrets im Client/Offline-Speicher.
- **CSV:** Semikolon + UTF-8-BOM (deutsches Excel), Formel-Injektionsschutz.
- **PWA/Offline:** handgeschriebener Service Worker (kein next-pwa), IndexedDB-Outbox/Upload-Queue,
  Sync über `/api/sync` + `/api/images/upload`.
- **Idempotenz (AP6):** Tabelle `sync_actions` (`unique(actor, client_action_id)`), Dedup + Kompensation.
- **HEIC:** nicht akzeptiert (keine zuverlässige Browser-Vorschau/Verarbeitung).
- **Sicherheitsheader (AP7):** harte Header durchsetzend; CSP zunächst Report-Only.
- **Release:** Semantic Versioning; erster RC `v1.0.0-rc.1`; **Tag/Release nur mit Nutzerfreigabe**.
- **Migrationen:** additiv/idempotent; aktuell `0001`–`0014` (Stand 2026-07-31).
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

**Noch offen (Präzisierung 2026-07-31):** Arbeitspaket B löst die verbleibenden
Supabase-Abhängigkeiten schrittweise ab. Auth-Basis sowie Vorgänge, Aufgaben und Offline-Sync sind
abgelöst (siehe „AP14/B — Datenpfade …“); Stammdaten, Inventar sowie Bilder und Uploads laufen
weiterhin über Supabase.
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
  Variablengruppen Laufzeitpflicht.

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
  für Vorgänge, Aufgaben und Offline-Sync mit Migration `0014_ap14b_data_grants.sql` geliefert;
  offen bleibt sie für Stammdaten, Inventar sowie Bilder und Uploads.
- CSP und `connect-src` nennen weiterhin Supabase, weil die Datenmodule noch dorthin sprechen.
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
- **Grenze:** Stammdaten, Inventar sowie Bilder und Uploads laufen unverändert über Supabase
  (u. a. `masterdata.ts`, `masterdata-actions.ts`, `inventory.ts`, `inventory-actions.ts`,
  `image-actions.ts`, `image-upload-core.ts`, `images-server.ts`, `lib/supabase/server.ts`,
  `lib/supabase/client.ts`, `database.types.ts`). AP14 insgesamt ist **nicht** abgeschlossen:
  Browser-/Offline-Abnahme, CSP-Durchsetzung, MinIO sowie Betrieb und Deployment bleiben offen.

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
`data-incidents-tasks-sync` ist seit dem 2026-07-31 gemergt (Commit `6b9d8dd`). Nächster
nicht-visueller Arbeitsblock ist die Ablösung der verbliebenen Supabase-Datenpfade in
**Stammdaten und Inventar** nach PostgreSQL/RLS; Bilder und Uploads folgen mit dem
MinIO-Bildspeicher. Die Browser-E2E der Massenaktionen bleibt diesen Ablösungen nachgeordnet.
