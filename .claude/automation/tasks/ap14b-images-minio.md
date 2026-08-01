# AP14B Datenmigration 3 – Bilder und Uploads auf MinIO

## Ziel und Ausgangspunkt

Ersetze den letzten produktiven Supabase-Restbestand in **Bildern und Uploads**
durch PostgreSQL 18, Auth.js v5 und einen privaten MinIO-Bildspeicher gemäß
ADR-011. Die bestehende sichtbare Galerie, Uploadmaske und Offline-Warteschlange
bleiben funktional und äußerlich unverändert. Nach erfolgreicher Ablösung werden
die nicht mehr benötigten Supabase-Clientdateien, Umgebungsvariablen, Pakete und
CSP-Freigaben entfernt.

Arbeite ausschließlich im bestehenden Vault. Lies vor Beginn vollständig
`AGENTS.md`, `CLAUDE.md`, `PROJEKT_WISSEN.md`, `PROJEKTSTATUS.md`,
`00-Projektsteuerung/ROADMAP_AP12_AP15_ENTWURF.md`,
`00-Projektsteuerung/ADR-011-postgres-eigenplattform.md`,
`03-Architektur/BILDDOKUMENTATION.md`, `03-Architektur/SICHERHEIT.md`,
`deploy/README.md`, `.claude/automation/status/fortschritt.json` und diese
Aufgabenbeschreibung.

Du arbeitest als alleiniger ausführender **Claude-Orchestrator** und steuerst
deine spezialisierten Claude-Agents nach `AGENTS.md`. Codex setzt den
Architekturrahmen und prüft nach der Abschlussübergabe unabhängig.

## Bestätigter Startstand

- Technischer Fachstand: `79d88449f9e481b1148f902e175f46f9d07ef35d`.
- Dokumentationsstand: `7989ac4414b474c61ce4caa9468159cd0aad27bc`.
- Die GitHub-Läufe des Dokumentationsstands sind durch Codex bestätigt:
  `30679523155` (CI) und `30679523126` (Container-Image), beide
  `completed/success`.
- Vorgänge, Aufgaben, Offline-Sync, Stammdaten und Inventar sind bereits auf
  PostgreSQL 18 migriert. Supabase ist nur noch im Bild-/Uploadpfad sowie in den
  dafür vorgehaltenen Clientdateien, Paketen und CSP-Einträgen zulässig.
- `@aws-sdk/client-s3` und `@aws-sdk/s3-request-presigner` sind bereits direkte
  Abhängigkeiten. Keine zweite S3-/MinIO-Bibliothek einführen.
- Echte IT-Endpunkte, Zugangsdaten, DNS- und Proxydaten liegen noch nicht vor.
  Bis dahin ausschließlich lokale synthetische Konfiguration verwenden.

## Startvorbedingungen

Starte nur, wenn alle Punkte erfüllt sind:

- `HEAD`, lokales `main` und `origin/main` sind deckungsgleich; ihre Historie
  enthält den bestätigten Dokumentationsstand
  `7989ac4414b474c61ce4caa9468159cd0aad27bc` unmittelbar vor diesem
  Architekturauftrag;
- Arbeitsbaum und Index sind sauber;
- `.claude/automation/runtime/state.json` weist keinen Lauf mit
  `status = "running"` aus;
- `run-orchestrator.ps1 -CheckOnly` liefert Exit-Code 0;
- keine `index.lock` oder `HEAD.lock` liegt im Repository.

Bei Abweichung sofort anhalten und den Rohbefund an Codex melden. Keine
Bereinigung, kein Restore, Reset, Stash, Clone oder Ersatzpfad. Lege erst nach
erfüllter Vorbedingung den Branch `feat/ap14b-images-minio` aus dem aktuellen
`main` an. Existiert er bereits lokal oder remote, halte an und überschreibe ihn
nicht.

## Positivliste des Gesamtauftrags

Fachlich zu migrieren sind ausschließlich:

- `app/src/lib/image-upload-core.ts`
- `app/src/lib/image-actions.ts`
- `app/src/lib/images-server.ts`
- `app/src/app/api/images/upload/route.ts`

Zusätzlich zulässig, soweit unmittelbar erforderlich:

- `app/src/lib/images.ts` ohne sichtbare Semantikänderung;
- neue server-only MinIO-/S3-Hilfsmodule unter `app/src/lib/`;
- bestehende PostgreSQL-, Auth.js- und Fehler-Hilfsmodule wiederverwenden;
- genau eine additive/idempotente Migration `0016_*` für die minimale
  `app_user`-Rechtematrix beziehungsweise zwingend erforderliche
  Bildmetadaten-Anpassungen;
- neue oder angepasste SQL-Smokes, Node-Integrationstests und lokale
  synthetische MinIO-Testskripte;
- bestehende DB-Test-Runner nur, soweit Migration `0016`, der neue Smoke oder
  die neue Integration sonst nicht ausgeführt werden;
- `deploy/compose.yml`, die Stage-/Produktions-Overlays,
  `deploy/env/app.env.example`, eine erforderliche MinIO-Env-Vorlage,
  `deploy/env/.gitignore`, `deploy/README.md`, Runtime-Konfigurationsprüfung,
  Healthcheck und CI nur soweit für den privaten MinIO-Dienst zwingend nötig;
- `app/next.config.ts` zur Entfernung der Supabase-CSP-Freigaben und zur exakt
  notwendigen MinIO-/Same-Origin-Regel;
- `app/package.json` und `app/package-lock.json` zum Entfernen der beiden
  Supabase-Pakete, aber erst nach nachgewiesenem Nullverbrauch;
- `app/src/lib/supabase/client.ts`, `server.ts` und `config.ts` löschen, aber
  nur wenn die vollständige Suche keinen produktiven Import mehr zeigt;
- `app/src/lib/database.types.ts` nur löschen oder entkoppeln, wenn eine
  vollständige Importsuche belegt, dass die Datei nicht mehr gebraucht wird;
- `PROJEKT_WISSEN.md` erst am Ende und nur mit bestätigten Ergebnissen;
- `.claude/automation/status/fortschritt.json` nach Staffelstab-Regel.

## Negativliste

- Keine sichtbare GUI-, Layout-, Styling-, Text-, Navigations- oder
  Interaktionsänderung. Insbesondere keine Galeriegestaltung und keine Änderung
  der Uploadmaske ohne Dennis.
- Keine Änderung anderer bereits migrierter Fachdatenmodule.
- Kein Supabase-Zwischenweg, kein Supabase-Container, kein fremder Cloud-Dienst.
- Kein direkter Browserzugriff mit MinIO-Zugangsdaten, keine Secrets oder
  privilegierten Daten im Clientbundle, in URLs, Logs, Testausgaben oder Git.
- Kein öffentlicher Bucket, keine anonyme Lese- oder Schreibfreigabe, keine
  öffentliche ACL.
- Kein Service-Role-, Superuser- oder `BYPASSRLS`-Pfad.
- Keine echten Personen-, Bild-, EXIF-/GPS- oder IT-Zugangsdaten. Tests nutzen
  ausschließlich synthetische JPG-/PNG-Artefakte ohne echte Metadaten.
- Keine Löschung physischer Bildobjekte beim fachlichen Soft-Delete. V1 und die
  Aufbewahrungsentscheidung bleiben Produktionssperre.
- Kein dauerhaft laufender Testcontainer, Port, Volume, Bucket, Objekt,
  temporäres Verzeichnis oder Protokoll nach Testende.
- Keine ManagementOS-Datei, kein Branding, kein V1-, RC1-, Tag- oder
  Release-Schritt.
- Kein Commit, Push, Merge, Rebase, Tag oder Release durch Claude oder Agents.

## Verbindliche Architektur

### 1. Identität, PostgreSQL und RLS

1. Jede Bildmetadaten- und Idempotenzoperation läuft über
   `withUserTransaction`; kein rohes `pg`, kein neuer Pool und kein
   `withAuthTransaction` für Fachdaten.
2. Die Benutzer-ID stammt ausschließlich aus der serverseitig validierten
   Auth.js-Sitzung. Fehlende Sitzung und `must_change_password` bleiben
   fail-closed. `uploaded_by` wird nie aus Form-/Requestdaten übernommen.
3. RLS bleibt führend. Bestehende Sichtbarkeit bleibt erhalten: Staff sieht
   zulässige Vorgänge, Monteure ausschließlich zugewiesene Vorgänge; Änderungen
   und Soft-Delete dürfen die bestehende Policysemantik nicht erweitern.
4. Migration `0016` vergibt an `app_user` nur die für Bilder und Offline-Dedup
   notwendigen Rechte. Keine Grants an `public`, `anon` oder `authenticated`.
5. SQL ist parametrisiert; keine Interpolation von Request-, Pfad-, Datei- oder
   Benutzerwerten.

### 2. Privater MinIO-Speicher

1. MinIO wird serverseitig ausschließlich über AWS SDK v3 mit Path-Style und
   server-only Konfiguration angesprochen. Der Bucket bleibt privat.
2. Pflichtvariablen müssen mindestens Endpoint, Bucket, Access-Key und
   Secret-Key abdecken; Region und TLS/Path-Style nur soweit nötig. Fehlende,
   leere oder Platzhalterwerte brechen fail-closed ab und nennen ausschließlich
   Variablennamen, nie Werte.
3. Produktive Secrets stehen nur in gitignorierten Runtime-Env-Dateien. Die
   versionierten Vorlagen enthalten ausschließlich erkennbare Platzhalter.
4. Browser erhalten weder MinIO-Zugangsdaten noch Schreib-URLs. Uploads laufen
   weiter über Server Action beziehungsweise `/api/images/upload`.
5. Private Bildauslieferung erfolgt über kurzlebige, serverseitig erzeugte
   signierte GET-URLs. Die Produktionsroute liegt hinter demselben internen
   Reverse-Proxy-Ursprung oder einer exakt konfigurierten erlaubten Origin;
   keine Wildcard-CSP. Der interne MinIO-Endpunkt darf nicht in den Browser
   gelangen. Falls interne und browserseitig erreichbare Signier-Origin
   getrennt werden müssen, sind beide ausdrücklich zu konfigurieren und die
   Proxyanforderung zu dokumentieren; keine erfundene IT-Adresse.
6. Objektpfade bleiben servergeneriert nach dem vorhandenen Schema
   `incidents/{incidentId}/{imageId}/{sanitizedFilename}`. Keine vom Client frei
   gewählten Keys, kein Traversal, kein Überschreiben.

### 3. Upload, Kompensation und Idempotenz

1. Bestehende Fachsemantik bleibt erhalten: maximal konfigurierte Dateigröße,
   ausschließlich JPEG/PNG, Magic-Byte-Prüfung maßgeblich, HEIC abgelehnt,
   Kategorievalidierung, EXIF-Auswertung und Rückgabewerte kompatibel.
2. Objektanlage und PostgreSQL-Metadatensatz sind dienstübergreifend nicht
   atomar. Deshalb gilt zwingend: Objekt zuerst mit kollisionsfreiem Key;
   Metadaten danach in RLS-geschützter Transaktion; bei Metadatenfehler wird das
   gerade angelegte Objekt best-effort entfernt und ein etwaiger
   Kompensationsfehler strukturiert ohne Secret/Personendaten gemeldet. Kein
   falscher Erfolgsstatus.
3. Kein Metadatensatz darf auf ein nachweislich fehlgeschlagenes Objekt zeigen.
   Ein erfolgreicher Datensatz behält sein Objekt auch beim Soft-Delete.
4. Offline-Deduplizierung über `sync_actions` bleibt erhalten. Gleichzeitige
   Wiederholungen derselben stabilen `client_action_id` dürfen höchstens einen
   erfolgreichen logischen Upload erzeugen. Bei vollständigem Fehlschlag wird
   der Marker so zurückgesetzt, dass ein Retry möglich bleibt; bei Teilerfolg
   darf ein Retry keine bereits erfolgreichen Dateien duplizieren.
5. Fehlerantworten geben keine Bucket-, Endpoint-, Schlüssel-, SQL- oder
   internen Objektinformationen preis.

### 4. Lesen und Änderungen

1. `listIncidentImages` liest Metadaten und Uploadernamen über PostgreSQL/RLS,
   sortiert unverändert und erzeugt nur für RLS-sichtbare, nicht gelöschte
   Datensätze signierte URLs.
2. `getTodaysImageCount` bleibt RLS-geführt und zählt nur nicht gelöschte
   Bildmetadaten des aktuellen Tages mit unveränderter fachlicher Zeitzone.
3. Kategorie, Beschreibung und Soft-Delete laufen transaktional über
   PostgreSQL. Vermeide stille Erfolge bei null betroffenen Zeilen; fremde oder
   nicht sichtbare Bilder müssen neutral abgewiesen werden.
4. Audit- und Chroniktrigger bleiben wirksam. Es wird keine
   `SECURITY DEFINER`-Abkürzung eingeführt.

### 5. Vollständige Supabase-Ablösung und Betrieb

1. Nach der Migration muss eine vollständige Suche unter `app/src`,
   `app/package*.json`, `app/next.config.ts`, `app/docker`, `deploy` und CI
   unterscheiden zwischen historischen Kommentaren/Migrationspfaden und
   produktiven Abhängigkeiten.
2. Erst wenn null produktive Importe und null produktive Laufzeitvariablen
   verbleiben, werden `@supabase/ssr`, `@supabase/supabase-js` sowie die drei
   Supabase-Clientdateien entfernt. Keine tote Ersatzdatei stehen lassen.
3. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, Supabase-CSP und
   die veraltete Runtimeprüfung entfallen. `SUPABASE_SERVICE_ROLE_KEY` darf als
   explizit verbotene Altvariable weiterhin fail-closed geprüft werden, wenn
   dies als Schutz begründet und getestet ist.
4. Compose erhält einen privaten MinIO-Dienst ohne Host-Port, mit persistentem
   Volume, Healthcheck, ohne Secrets im YAML und mit kontrollierter fester
   Image-Referenz. App-Abhängigkeit und Netzwerk bleiben intern. Stage und
   Produktion dürfen keine echten Werte enthalten.
5. `deploy/README.md` wird nur sachlich aktualisiert: Zielarchitektur,
   Konfiguration, Proxyanforderung, getrennte Bild-/DB-Sicherung, Restore-Grenze
   und weiterhin bestehende V1-/Deployment-Sperre. Keine behaupteten
   Betriebsnachweise ohne echten Lauf.

## Verbindliche Agentenverträge

Claude zerlegt mindestens in folgende Teilpakete und versieht jedes mit eigener
Positivliste, Negativliste, Definition of Done und Stopppunkt:

1. **Read-only Bestands-/Bedrohungsanalyse** – `kb-sicherheit-rls` prüft
   Tabellen, RLS, Rechte, Offline-Idempotenz, Objektpfade, Env/CSP und
   Containergrenzen. Keine Änderung.
2. **MinIO- und Bildkern** – `kb-implementierung`, Positivliste nur neue
   server-only Objekt-Hilfsmodule, `images.ts`, `image-upload-core.ts` und
   unmittelbar nötige Tests. Einziger Schreiber.
3. **Bildaktionen und Route** – `kb-implementierung`, Positivliste nur
   `image-actions.ts`, `images-server.ts`, `app/api/images/upload/route.ts` und
   unmittelbar nötige Tests. Erst nach Teilpaket 2, schreibend allein.
4. **Migration/Rechte und Integrationstests** – `kb-implementierung`, genau
   eine Migration `0016_*`, Smokes, Runner und synthetische MinIO-/PostgreSQL-
   Integration. Schreibend allein.
5. **Supabase-Entfernung und Runtime/Deploy** – `kb-implementierung`, erst nach
   grünem Kernnachweis; Pakete, Clientdateien, CSP, Env, Compose, Runtimeprüfung
   und Dokumentation im ausdrücklich genannten Scope. Schreibend allein.
6. **Tests/Evidence** – `kb-tests-evidence` strikt read-only gegenüber
   versionierten Dateien; meldet Kommando, Exit-Code und Originalergebnis.
7. **Abschließendes Sicherheitsreview** – `kb-sicherheit-rls` read-only auf
   Gesamtdiff: Auth.js, RLS, Rechte, Objektzugriff, Signaturen, CSP, Pfade,
   Kompensation, Idempotenz, Geheimnisse und Datenleckage.
8. **Dokumentation** – `kb-dokumentation` darf erst nach grünen Nachweisen
   ausschließlich `PROJEKT_WISSEN.md` knapp aktualisieren.

Schreibende Teilpakete laufen strikt sequenziell. Kein Agent startet Agents
oder kommuniziert direkt mit anderen Agents. Befunde laufen immer über Claude.
Nach dreimal demselben Fehler gilt der Circuit Breaker.

## Definition of Done und echte Nachweise

Claude prüft selbst den Gesamtdiff und liefert mindestens:

- Suchnachweis: null produktive Supabase-Importe, null `supabase.`-Zugriffe,
  null benötigte Supabase-Pakete und null `NEXT_PUBLIC_SUPABASE_*`-Nutzung;
- TypeScript, ESLint, vollständige Einheitentests und Produktions-Build jeweils
  Exit-Code 0;
- vollständiger lokaler PostgreSQL-18-Lauf mit Migrationen `0001`–`0016`, allen
  bisherigen Smokes und dem neuen Bild-/Rechte-Smoke;
- echte Integration gegen temporäres PostgreSQL 18 **und temporäres MinIO**:
  privater Bucket, Upload, Metadateninsert, Liste, signierter GET und gelesener
  Objektinhalt, Kategorie/Beschreibung, Soft-Delete, Tageszählung;
- Rollenfälle unter nicht privilegiertem `app_user` mit RLS: Admin,
  Disposition, zugewiesener Monteur, fremder Monteur und fehlende Sitzung;
- Negativfälle: falsche Magic Bytes, HEIC/anderer MIME, zu groß, leer, Traversal-
  Dateiname, fehlender/fremder Vorgang, manipuliertes `uploaded_by`, fehlendes
  Objekt, abgelaufene/ungültige Signatur, MinIO-Fehler und DB-Fehler nach
  erfolgreichem Objekt-Upload einschließlich nachgewiesener Kompensation;
- echte Parallelprobe für dieselbe `client_action_id`: höchstens ein logischer
  Upload; Retry nach Komplettfehler sowie definierter Teilerfolg ohne Duplikat;
- Audit-/Chroniknachweis und Nachweis, dass fremde Benutzer weder Metadaten noch
  signierte URLs erhalten;
- Runtime-Konfigurationsprüfungen für fehlende, Platzhalter-, gültige und
  verbotene Variablen ohne Secret-Ausgabe;
- `docker compose ... config` für Stage und Produktion sowie einen lokalen
  synthetischen MinIO-Health-/Privatheitslauf, falls Docker verfügbar. Ist
  Docker nicht verfügbar, ist das ein offener Nachweis und kein Erfolg;
- `npm audit --omit=dev --audit-level=high`, `git diff --check` und vollständiger
  `git status`;
- temporäre Datenbanken, MinIO-Container, Volumes, Buckets, Objekte, Ports,
  Verzeichnisse und Logs vollständig entfernt; vorhandener PostgreSQL-Dienst
  unverändert.

Browser-E2E sind erforderlich, weil Bild-URLs, CSP und Offline-Upload eine
Browser-/Laufzeitgrenze ändern. Mindestens die öffentliche Suite sowie gezielte
synthetische Bild-/Offlinefälle ausführen. Falls die `@app`-Suite zwingend an
noch fehlenden IT-Daten statt an lokaler Konfiguration scheitert, exakt
belegen, nicht umgehen und nicht als Erfolg melden.

## Stopppunkt und Übergabe

Sofort anhalten bei sichtbarer GUI-/Designentscheidung, zwingend fehlendem
IT-Zugang für einen nicht lokal synthetisierbaren Nachweis, Architekturkonflikt,
Scope-Erweiterung, V1-Frage, echtem Sicherheitsblocker, aktivem zweiten
Schreiber oder Circuit Breaker. Keinen Ersatzpfad, Clone, Supabase-Zwischenweg
oder fremden Dienst anlegen.

Abschlussübergabe an Codex enthält:

1. alle geänderten und gelöschten Dateien,
2. umgesetztes Verhalten und MinIO-/Proxygrenze,
3. eingesetzte Agentenprofile und Teil-Scopes,
4. exakte Prüfungen mit Kommandos, Exit-Codes und Ergebnissen,
5. objektbezogene Kompensations- und Idempotenznachweise,
6. vollständige Supabase-Restsuche,
7. offene Risiken oder Blocker,
8. vollständigen Git-Status,
9. ausdrücklich: kein Commit und kein Push.
