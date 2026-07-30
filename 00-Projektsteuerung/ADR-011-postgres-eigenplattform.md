# ADR-011 – Ablösung Supabase durch PostgreSQL-basierte Eigenplattform

> **Status: angenommen / verbindlich.** Beschlossen am 2026-07-30 · Entscheider: Dennis Kühnhold
> (Erstfassung als Entwurf: 2026-07-28 18:30)
> Die Zielplattform ist damit verbindlich entschieden: **PostgreSQL 18, Auth.js v5, MinIO und
> Containerbetrieb hinter dem internen Reverse-Proxy.** Supabase Cloud und selbst gehostetes
> Supabase sind ausgeschlossen.
> **Umsetzungsstand (nicht Entscheidungsstand):** Die technische Umsetzung ist noch nicht
> vollständig — auf `main` ist die AP14/B-Auth-Basis gemergt, offen sind die Ablösung der
> Datenmodule (AP14B `data-incidents-tasks-sync`), MinIO und der Betrieb. Dieser offene
> Umsetzungsstand ist ausdrücklich **kein** Grund, die Architekturentscheidung weiter
> „Entwurf“ zu nennen.

**Verhältnis zum Bestand.** Die Supabase-Architektur (ADR 2, 3, 9 in `ENTSCHEIDUNGEN.md`) bleibt die
**historische Ist-Architektur** von AP1–AP13 und war für den damaligen Auftragsstand richtig: sie hat
die Autorisierung von Beginn an in die Datenbank gelegt, das Datenmodell trägt sich unverändert in die
Zielarchitektur, und die 51 RLS-Policies sind das Ergebnis, das hier bewusst erhalten wird. Dieser ADR
ersetzt eine Plattformentscheidung, er korrigiert keinen Fehler.

---

## 1. Kontext

**Zielentscheidung (Dennis, 2026-07-28):** Stage und Produktion werden ausschließlich mit PostgreSQL
betrieben. Supabase ist keine Zielplattform mehr — weder Cloud noch selbst gehostet. Es darf keine
dauerhafte Hybridarchitektur entstehen. Kein externer Backend-as-a-Service tritt an die Stelle von
Supabase.

**Ist-Stand im Repository (verifiziert am 2026-07-28, Commit `e102532`):**

| Merkmal | Wert |
|---|---|
| Dateien in `app/src` mit Supabase-Bezug | 23 (von ca. 12.150 Zeilen `src/`) |
| RLS-Policies | 51 |
| `auth.uid()`-Aufrufe in Migrationen | 56, verteilt auf 7 der 11 Migrationen |
| `auth.users`-Referenzen | 43 |
| Storage-Referenzen (`storage.objects`/`buckets`/`foldername`) | 10, im Kern `0002_storage.sql` |
| Migrations-SQL im Bestand | 2.659 Zeilen, `0001`–`0011` |
| Produktiver Datenbestand | **keiner** — V1 sperrt den produktiven Datenanfall |

**Der entscheidende Freiheitsgrad:** weil kein produktiver Bestand existiert und Stage/Test gemäß V1
ausschließlich synthetische Daten führen, ist keine Datenmigration zu leisten, sondern ein Neuaufbau.
Passworthashes aus Supabase Auth wären ohnehin nicht übernehmbar.

**Was Supabase heute leistet und ersetzt werden muss:** Authentifizierung und Sessionerneuerung
(`@supabase/ssr`, `app/src/middleware.ts`), die Identitätsquelle `auth.uid()` für alle Policies, sowie
die Bildablage mit privatem Bucket und signierten URLs.

---

## 2. Entscheidungen

### 2.1 Authentifizierungsverfahren

**Entschieden:** Auth.js v5 mit Credentials-Provider, kurzlebigen JWT-Sitzungen und einer
serverseitigen Widerrufstabelle in PostgreSQL. Kein externer Identitätsprovider, keine eigene
Implementierung kryptografischer Tokenformate.

Hintergrund der Kombination: der Credentials-Provider von Auth.js unterstützt keine
Datenbank-Sessions, sondern ausschließlich JWT. Ein reines JWT-Modell kann eine Sitzung nicht vor
Ablauf beenden — für eine Anwendung mit Sperrung von Benutzern und Rollenwechsel durch den
Administrator ist das nicht ausreichend. Die Widerrufstabelle schließt genau diese Lücke, ohne die
Tokenerzeugung selbst zu bauen.

**Verbindliche Auflagen:**

- Der JWT enthält ausschließlich `sub` (Benutzer-ID), `sid` (Sitzungs-ID) und die Ausstellungs- und
  Ablaufzeit. **Keine Rolle, keine Berechtigungen, keine Anzeigenamen.**
- Rollen- und Berechtigungsentscheidungen werden **nie** aus JWT-Claims übernommen, sondern in
  derselben Transaktion aus der Datenbank gelesen, in der auch die fachliche Abfrage läuft.
- Gesperrte, deaktivierte oder widerrufene Benutzer werden serverseitig erkannt; die Widerrufsprüfung
  läuft bei **jeder** sicherheitsrelevanten Sitzungsauswertung.
- JWT-Lebensdauer kurz (Vorschlag: 10 Minuten), stille Erneuerung solange die Sitzung gültig und nicht
  widerrufen ist; absolute Sitzungsobergrenze getrennt davon (Vorschlag: 12 Stunden).
- Keine Tokens in IndexedDB, Local Storage oder Service-Worker-Caches. Der bestehende Service Worker
  cacht `/api/*` und `/auth/*` bereits grundsätzlich nicht; die vorhandene `@app`-E2E-Prüfung
  „keine Tokens in IndexedDB" bleibt Bestandteil der Abnahme.
- Auth-Geheimnisse (`AUTH_SECRET`) ausschließlich als Runtime-Secret, niemals im Image.

### 2.2 Ablauf- und Widerrufsmodell

**Tabellen** (Namen als Vorschlag, endgültig in `0012`):

- `auth_accounts` – Authentifizierungskonto: `id`, `email` (eindeutig, normalisiert),
  `password_hash`, `must_change_password`, `is_disabled`, `failed_attempts`, `locked_until`,
  `created_at`, `updated_at`.
- `auth_sessions` – ausgestellte Sitzungen: `id` (= `sid` im JWT), `account_id`, `issued_at`,
  `expires_at`, `revoked_at`, `revoked_reason`, `last_seen_at`. Die Tabelle ist die
  **Widerrufsquelle**: eine Sitzung gilt nur als gültig, wenn ein Datensatz existiert,
  `revoked_at is null` und `expires_at > now()`.

**Ablauf je Request mit Schutzbedarf:**

1. Cookie lesen, JWT-Signatur und Ablauf prüfen (Auth.js).
2. `sid` in `auth_sessions` prüfen: vorhanden, nicht widerrufen, nicht abgelaufen.
3. Konto prüfen: nicht deaktiviert, nicht gesperrt.
4. Erst danach Transaktion öffnen, `SET LOCAL app.user_id`, Rolle aus `profiles` lesen, fachliche
   Abfrage ausführen.

**Widerrufsauslöser:** Abmeldung (nur die eigene Sitzung), Passwortänderung (alle Sitzungen des
Kontos), Deaktivierung oder Rollenänderung durch den Administrator (alle Sitzungen des Kontos),
administrativer Zwangswiderruf. Jeder Widerruf erzeugt einen Auditeintrag.

**Bewusste Restlücke:** zwischen Widerruf und Ablauf des ausgestellten JWT besteht kein Zeitfenster,
weil Schritt 2 bei jedem geschützten Request läuft — der Preis ist eine Datenbankabfrage pro Request.
Das ist akzeptiert; sie liegt in derselben Verbindung wie die fachliche Abfrage.

### 2.3 Passwort-Hashing und Accountverwaltung

**Entschieden:** Argon2id über `@node-rs/argon2` (vorkompilierte Binärpakete, damit im Runtime-Image
keine Build-Werkzeuge nötig sind). Parameter mindestens nach aktueller OWASP-Empfehlung, zentral
konfiguriert und versionierbar, damit ein späteres Nachziehen der Kosten möglich bleibt.

**Passwort-Reset für RC1 – ausschließlich administrativ, ohne SMTP:**

- Der Administrator setzt ein temporäres Passwort und übergibt es außerhalb des Systems.
- `must_change_password = true` erzwingt den Wechsel bei der nächsten Anmeldung; bis dahin ist jede
  andere Route gesperrt.
- Temporäre Passwörter werden nicht dauerhaft protokolliert.
- Passwörter erscheinen **niemals** im Klartext in Datenbank, Logs, Auditdaten oder Dokumentation.
  Auditiert werden ausschließlich die Ereignisse „Reset durch Administrator" und „Passwort geändert"
  mit Zeitpunkt, handelndem und betroffenem Konto.
- Ein öffentliches „Passwort vergessen"-Verfahren ist **nicht** Bestandteil von RC1 und wird nicht
  vorbereitet. Ein späterer SMTP- oder Identitätsprovider-Anschluss ist eine gesonderte Entscheidung.
- Alle Sitzungen des Kontos werden bei Reset und bei Passwortwechsel widerrufen (2.2).

### 2.4 Rollenmodell

**Portiert werden ausschließlich die bestehenden Rollen** `admin`, `disponent`, `monteur`
(`profiles.role`, Enum, ADR 4 bleibt gültig). Semantik, Hilfsfunktionen und Policy-Inhalte bleiben
unverändert.

**Die Rolle `kunde` ist fachlich vorgesehen, aber ausdrücklich nicht Bestandteil dieser Ablösung.**
Sie ist ein eigenes fachliches Arbeitspaket und setzt voraus, dass mindestens geklärt ist:

1. Welche Vorgänge darf ein Kunde sehen?
2. Ist die Sichtbarkeit auf eigene Meldungen, die eigene Organisation oder zugeordnete Bauabschnitte
   begrenzt?
3. Welche Bilder darf ein Kunde sehen?
4. Welche Timeline-, Material-, Personen- und Auditinformationen bleiben verborgen?
5. Darf ein Kunde ausschließlich melden oder auch ergänzen und kommentieren?

**In der Portierung entsteht keine provisorische Kundenberechtigung** — kein Enum-Wert, keine Policy,
kein UI-Zweig, kein Platzhalter. Die Rolle wird erst mit ihrer fachlichen Regel eingeführt.

### 2.5 Durchsetzung der Autorisierung

**Entschieden:** RLS bleibt maßgeblicher Autorisierungsträger. ADR 3 gilt inhaltlich weiter; nur der
Identitätslieferant wechselt.

- PostgreSQL ist der einzige Datenbankdienst.
- Jede fachliche Operation läuft in einer **expliziten Transaktion**; die Identität wird darin mit
  `SET LOCAL app.user_id = $1` gesetzt. `SET LOCAL` endet mit der Transaktion und kann deshalb nicht
  über eine Poolverbindung in den nächsten Request ausbluten.
- Die Anwendung verbindet sich mit einer nicht privilegierten Rolle (`app_user`): kein `SUPERUSER`,
  kein `BYPASSRLS`, kein Eigentum an den Tabellen.
- **Datenbankzugriffe außerhalb des kontrollierten Wrappers müssen fehlschlagen.** Der Wrapper ist der
  einzige Weg zu einer Verbindung; ein direkter Pool-Zugriff wird durch Kapselung und ESLint-Regel
  unterbunden.
- **Fehlende Identität wird explizit erkannt und abgebrochen.** Es wird sich ausdrücklich *nicht*
  darauf verlassen, dass `app.user_id`-loses Arbeiten „zufällig" keine Zeilen liefert: bei
  authentifizierungspflichtigen Operationen bricht der Wrapper mit einem klaren Fehler ab, bevor SQL
  ausgeführt wird. Die RLS-Verweigerung ist die zweite, nicht die erste Verteidigungslinie.
- Zusätzlich serverseitige Rollenprüfung in Server Actions und Route Handlern, durchgängig
  parametrisierte Abfragen, Schutz **aller** mutierenden Endpunkte.
- **Kein Policy-Inhalt wird gelockert.** Jede Abweichung von der heutigen fachlichen Wirkung ist ein
  Finding und keine Designentscheidung.

### 2.6 Ersatz für `auth.uid()`

Neue Funktion `app.current_user_id()`, `STABLE`, liest `current_setting('app.user_id', true)::uuid`
und gibt bei fehlender oder ungültiger Einstellung `NULL` zurück. Damit verhalten sich alle Policies
identisch zum heutigen Zustand „nicht angemeldet": sie verweigern.

Die drei Hilfsfunktionen `is_admin()`, `is_staff()`, `is_assigned_to_incident()` behalten Namen,
Signatur und Semantik; nur ihr Rumpf wechselt von `auth.uid()` auf `app.current_user_id()`. Damit
bleibt der Änderungsdruck auf die Policies klein: neu erzeugt werden nur die Policies mit direktem
`auth.uid()`-Bezug.

### 2.7 Benutzer-, Profil- und Technikerobjekte

Vier Objekte, die **nicht** gleichgesetzt werden:

| Objekt | Zweck | Bestand heute |
|---|---|---|
| Authentifizierungskonto | Anmeldedaten, Passworthash, Sperre | `auth.users` (Supabase) |
| Fachliches Benutzerprofil | Rolle, Aktivstatus, Anzeigename; Träger der Autorisierung | `public.profiles` |
| Techniker-/Monteur-Stammdatensatz | Stammdaten, Einsatzplanung | `public.technicians` (AP9) |
| Sitzung / Widerruf | ausgestellte Sitzungen, Widerruf | existiert nicht |

`profiles.id` ist heute Fremdschlüssel auf `auth.users(id)`, `technicians.profile_id` bleibt gemäß
**V3** eine optionale, informative Zuordnung ohne Login-Kopplung.

**Auflage:** die 43 `auth.users`-Referenzen werden erst nach einer **vollständigen Referenzanalyse**
umgestellt — Fremdschlüssel, Trigger (insbesondere die automatische Profilanlage bei neuem
Auth-Benutzer aus `0001_init.sql`), Views und Policies. Die Analyse ist Teil von `0012` und wird als
Tabelle dokumentiert, bevor eine Beziehung geändert wird. Kein stillschweigendes Verschmelzen von
Konto und Profil.

### 2.8 Ersatz für Supabase Storage

**Entschieden:** MinIO als selbst betriebener, S3-kompatibler Bildspeicher im Compose-Stack.

- Persistentes Volume, privater Bucket, **nicht** öffentlich exponiert (kein veröffentlichter Port,
  nur internes Netz).
- Zugangsdaten ausschließlich als Runtime-Secrets.
- Pfadstruktur `incidents/{incident_id}/{image_id}/{filename}`.
- Backup und Wiederherstellung berücksichtigen PostgreSQL-Datensätze **und** MinIO-Objekte
  konsistent; ein Bild ohne Datenbankzeile und eine Datenbankzeile ohne Objekt sind beides Fehler und
  werden im Recovery-Test geprüft.

**Bewusster Verlust und Kompensation:** Migration `0002_storage.sql` setzt die Bildsichtbarkeit heute
über Policies auf `storage.objects` **in der Datenbank** durch. Diese Ebene entfällt. Kompensiert wird
sie durch 2.9 — die Sichtbarkeit wird weiterhin von der Datenbank entschieden, nur nicht mehr vom
Objektspeicher selbst.

### 2.9 Geschützte Bildzugriffe

**Download:** geschützter Route Handler `GET /api/images/[id]`. Reihenfolge verbindlich:

1. Bildzeile aus `incident_images` innerhalb des Transaktions-Wrappers lesen — **RLS entscheidet über
   die Sichtbarkeit**.
2. Nur bei Treffer den Objektschlüssel bilden und das Objekt mit internen MinIO-Zugangsdaten holen.
3. Antwort **streamen** (Web-`ReadableStream`), nicht vollständig in den Arbeitsspeicher laden;
   Abbruch des Clients beendet den Objektabruf; Obergrenzen und Zeitlimits gesetzt.
4. `Cache-Control: no-store, private`, `Content-Disposition` gesetzt, kein `ETag` über
   benutzerübergreifend gemeinsame Schlüssel.

Kein dauerhaft öffentlicher Objektzugriff. Browser- und Service-Worker-Caches speichern geschützte
Bilder nicht benutzerübergreifend — der bestehende Service Worker cacht `/api/*` nicht, das bleibt so
und wird in der Abnahme geprüft.

**Upload:** presignierte URLs sind zulässig, wenn der Server Objektpfad, Dateityp, Größe und die
Vorgangsberechtigung **vorher** festlegt beziehungsweise validiert und die Gültigkeit eng begrenzt ist
(Vorschlag: 5 Minuten, einmalige Verwendung, fester Schlüssel). Die bestehende serverseitige Härtung
aus AP4 (Magic-Bytes, Größe, Kategorie, Hash, HEIC-Ablehnung) bleibt vollständig erhalten und wird
nicht durch den Presigned-Pfad umgangen: entweder läuft der Upload weiter über
`/api/images/upload`, oder die Validierung erfolgt vor der Ausstellung und wird nach dem Upload
serverseitig gegen das abgelegte Objekt nachgeprüft. Die Entscheidung zwischen beiden Varianten fällt
in der Umsetzung von B6 auf Basis eines Messwerts, nicht vorab.

### 2.10 Migrationsstrategie

**Keine bestehende Migration wird verändert. `0001`–`0011` bleiben unangetastet.** Eine nachträglich
vor `0001` eingefügte Datei `0000` ist **verworfen** — sie würde eine dokumentierte, bereits
ausgeführte Historie rückwirkend verfälschen.

Stattdessen ein **getrenntes Bootstrap-Verfahren** außerhalb der numerierten Kette:

```
app/supabase/bootstrap/
  01_roles.sql              Rollen app_user / anon / authenticated, keine Rechte über das Nötige
  02_compat_auth.sql        Kompatibilitätsschicht: Schema auth + minimale auth.users
  03_compat_storage.sql     Kompatibilitätsschicht: Schema storage + minimale Objekttabellen
  README.md                 Zweck, Reihenfolge, Endlichkeit der Kompatibilitätsschicht
app/supabase/migrations/
  0001 … 0011               unverändert
  0012_ap14b_platform_auth.sql        Zielplattform: app.current_user_id(), Auth-Tabellen, FK-Umhängung, Policies
  0013_ap14b_drop_supabase_compat.sql Entfernt die Kompatibilitätsschemata auth und storage
```

**1 · Bootstrap einer vollständig neuen PostgreSQL-Instanz.** Reihenfolge:
`bootstrap/01` → `02` → `03` → `migrations/0001…0011` → `0012` → `0013`. Der Bootstrap ist
**kein** Migrationsschritt, sondern die Herstellung der Voraussetzungen, die die historische Kette
erwartet. Er wird nur bei einer leeren Instanz ausgeführt. Inhaltlich ist er die produktionsreife
Fassung des heutigen Teststubs `app/supabase/test/00_stub_auth_storage.sql`, der damit entfällt.

**2 · Ausführung der historischen Migrationen.** Unverändert, in numerischer Reihenfolge, über ein
Skript `deploy/scripts/db-migrate.sh` mit `ON_ERROR_STOP=on`, einer Datei pro Transaktion und
Protokoll je Datei. Kein automatischer Aufruf in der CI, kein automatischer Aufruf beim
Containerstart. Produktionsmigrationen ausschließlich nach manueller Freigabe.

**3 · Ablösung der Kompatibilitätsschemata.** `0012` führt die Zielobjekte ein, hängt die Beziehungen
nach der Referenzanalyse (2.7) um und ersetzt in den Hilfsfunktionen und Policies `auth.uid()`.
Danach referenziert kein Objekt mehr `auth.*` oder `storage.*`.

**4 · Zielzustand ohne Supabase-Stubs.** `0013` prüft zunächst, dass keine Abhängigkeit mehr besteht,
und entfernt dann `drop schema auth cascade` / `drop schema storage cascade`. Findet die Prüfung noch
eine Referenz, bricht die Migration mit klarer Meldung ab statt zu löschen. Damit ist die
Kompatibilitätsschicht per Konstruktion endlich — sie kann nicht dauerhaft mitlaufen.

**5 · Wiederholbarkeit und Fehlerbehandlung.** Jede Datei ist idempotent (`if not exists`,
`create or replace`, `drop policy if exists` vor `create policy`) und einzeln wiederholbar. Ergänzend
wird eine schlanke Nachweistabelle `platform_migrations` vorgeschlagen (`filename`, `sha256`,
`applied_at`, `applied_by`) — heute existiert kein Ledger, die Reihenfolge wird manuell gehalten. Das
Skript verweigert die Anwendung, wenn eine bereits angewendete Datei mit abweichendem Hash erneut
auftaucht. Fehlerfall: Abbruch der Datei, kein Teilzustand über Dateigrenzen hinweg, Forward-Fix
bevorzugt (bestehende Projektregel: additive Migrationen, kein destruktives Rollback).

### 2.11 Daten

**Neuaufbau, keine Datenmigration.** Kein produktiver Bestand vorhanden; V1 sperrt den produktiven
Datenanfall. Stage und Test führen bis zur V1-Entscheidung ausschließlich synthetische Personen-,
EXIF- und GPS-Daten. Benutzer werden neu angelegt; der erste Administrator entsteht über ein
dokumentiertes, einmalig ausgeführtes Bootstrap-Kommando, nicht über einen Seed mit festem Passwort.

### 2.12 Teststrategie

- Die neun SQL-Smokes (`app/supabase/test/10`–`18`) laufen bereits heute gegen reines PostgreSQL 18
  und werden das primäre Regressionsnetz. Sie werden aus der PowerShell-Bindung gelöst und in der CI
  gegen einen `postgres`-Service ausgeführt.
- **Neue Pflichtnachweise:** (a) fehlende `app.user_id` führt zum expliziten Abbruch im Wrapper,
  nicht zu leeren Mengen; (b) `SET LOCAL` überträgt keine Identität zwischen zwei Requests auf
  derselben Poolverbindung; (c) `app_user` besitzt weder `SUPERUSER` noch `BYPASSRLS`; (d) Widerruf
  einer Sitzung wirkt beim nächsten Request; (e) `must_change_password` sperrt alle anderen Routen;
  (f) Bildzugriff eines nicht zugewiesenen Monteurs wird verweigert, obwohl das Objekt existiert.
- Jede der 51 Policies wird vor und nach der Portierung als Text verglichen; inhaltliche Abweichung
  ist ein Finding.
- Die `@app`-E2E werden **erstmals ausführbar**, weil der Stack seine Datenbank selbst mitbringt.
  Genau das ist der Nachweis, an dem AP14 bisher scheiterte.

### 2.13 Rollbackstrategie

- Arbeitspaket B läuft vollständig auf `feat/ap14b-postgres-platform`; kein Merge nach `main` ohne
  grüne Prüfungen und Freigabe.
- Datenbank: Volume verwerfen und neu aufbauen — zulässig, weil kein produktiver Bestand existiert.
- Anwendung: Rücksprung auf den vorherigen Image-Digest.
- **Kein Hybridbetrieb als Rückfallebene.** Zwei parallele Autorisierungswege wären das größere
  Risiko als ein sauberer Rücksprung.
- Zwischen B5 und B8 existiert ein unvermeidlicher Übergangszustand, in dem beide Zugriffswege im
  Code liegen. Er ist auf den Branch begrenzt und endet mit B8 (Entfernung der Supabase-Pakete).

---

## 3. Konsequenzen

**Positiv:** keine Cloudabhängigkeit; Stage und Test vollständig lokal lauffähig; die `@app`-E2E
werden erstmals möglich; die Autorisierung bleibt in der Datenbank; das Datenmodell aus AP1–AP13
bleibt unverändert gültig.

**Negativ:** Authentifizierung, Sessionverwaltung, Passwortverfahren und Bildzugriff werden
Eigenverantwortung. Die Storage-Autorisierung verliert ihre Datenbankebene und wird durch den Route
Handler kompensiert. Der gesamte Datenzugriffslayer (23 Dateien) wird von `supabase-js` auf
parametrisiertes SQL umgestellt. Der Betrieb gewinnt zwei Zustandsdienste (PostgreSQL, MinIO) mit
eigener Backup- und Wiederherstellungsverantwortung.

**Nicht berührt:** ADR 4 (Rolle als Feld), 5 (Bestand als View), 6 (Bestandsguard), 7 (unveränderbare
Chronik), 10 (EXIF serverseitig) sowie V1, V2, V3, V4.

---

## 4. Abgrenzung und Reihenfolge

**Arbeitspaket A** (Docker-, PostgreSQL- und CI-Grundlage) enthält **keine** Supabase-Ablösung. Der
`postgres`-Container ist dort vorbereitet, aber von der Anwendung noch nicht genutzt. Der Compose-Stack
gilt bis zum Abschluss von B ausdrücklich als **nicht produktionsfähig**.

**Arbeitspaket B** setzt diesen ADR um, in der Reihenfolge B1–B9 gemäß Umsetzungsbericht zu A.

---

## 5. Offene Punkte

| # | Punkt | Zuständig |
|---|---|---|
| 1 | Fachliche Sichtbarkeitsregeln der Rolle `kunde` (2.4) | Dennis, eigenes AP |
| 2 | Endgültige Wahl Upload-Weg: bestehender Route Handler oder presignierter Upload (2.9) | Umsetzung B6, messwertbasiert |
| 3 | Nachweistabelle `platform_migrations` einführen oder Reihenfolge weiter manuell halten (2.10/5) | Dennis |
| 4 | V1 – Aufbewahrungsfristen; bleibt Produktionssperre, unabhängig von diesem ADR | Dennis / Recht |
| 5 | Argon2id-Parameter und Passwortregeln festlegen | Umsetzung B4 |
| 6 | Späterer SMTP- oder Identitätsprovider-Anschluss (nicht RC1, nicht vorbereitet) | gesonderte Entscheidung |

---

## Freigabe

- [ ] Freigabe zur Ausgabe als PDF/Word/Excel

Freigegeben von: —
Freigabedatum: —
