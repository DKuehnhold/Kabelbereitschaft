# AP14B MinIO – Codex-Reviewkorrekturen und vollständiger Abschluss

## Zweck

Setze den vorhandenen uncommitteten Stand auf
`feat/ap14b-images-minio` fort. Behebe ausschließlich die unten belegten
Codex-Befunde, führe die im ursprünglichen Auftrag noch nicht ausgeführten
Teilpakete 5–8 vollständig aus und übergib erst nach synchron abgeschlossenem
Gesamtnachweis. Kein Neustart von vorn, keine Bereinigung des vorhandenen
Arbeitsbaums und kein zweiter Branch.

Vor Beginn vollständig lesen:

- `.claude/automation/tasks/ap14b-images-minio.md`
- `.claude/automation/runtime/kb-ap14b-images-minio.result.json`
- diese Fortsetzung
- den tatsächlichen Diff und Git-Status.

Codex hat den verwaisten synthetischen PostgreSQL-Testcluster
`kb_ap14b_*_20260801_053918` nach eindeutigem Pfad-/Portnachweis bereits sauber
mit `pg_ctl -m fast` beendet und beide Temp-Verzeichnisse entfernt. Der reguläre
Dienst `postgresql-x64-18` blieb `Running`. Diese Artefakte nicht erneut suchen,
wiederherstellen oder als Claude-Nachweis ausgeben.

## Startgrenze

- Starte nur auf `feat/ap14b-images-minio` mit dem bereits vorhandenen
  uncommitteten MinIO-/Bildstand und ohne aktiven Orchestratorlauf.
- Ein zweiter schreibender Lauf, ein anderer Branch oder unerwartete Änderungen
  außerhalb des bisherigen Bildscopes sind Stopppunkte.
- Keine Bereinigung, kein Restore, Reset, Stash, Clone oder Ersatzpfad.
- Die neue Aufgabenbeschreibung selbst ist eine zulässige zusätzliche Datei.

## Befund 1 – Übergabe und Testlauf waren vorzeitig

Der Orchestrator meldete `completed`, obwohl danach ein separater PowerShell-
Testprozess lief. Dieser Prozess endete vor `integration_images` und vor dem
Cleanup; Port 55432 und beide Temp-Verzeichnisse blieben zurück. Damit sind die
in der Übergabe genannten Gesamtlauf-/Bildintegrationsnachweise **nicht** als
Abschlussnachweis gültig.

Korrektur:

- Keine losgelösten oder nach der Orchestratorübergabe weiterlaufenden
  Prüfprozesse.
- Der vollständige Runner wird synchron abgewartet; Resultat, Exit-Code und
  Cleanup liegen vor, bevor `result.json` finalisiert wird.
- Prüfe und korrigiere den Runner-/Aufrufweg so, dass Erfolg, Fehler, Timeout und
  Abbruch stets im `finally` den temporären Cluster, Port, Arbeitsordner und
  Testendpunkt entfernen. Keine fremden Prozesse oder regulären Dienste
  beenden.
- Die neue Bildintegration muss tatsächlich gelaufen sein; fehlende
  `integration_images.out.log`/`.err.log` gelten als Fehlschlag.

## Befund 2 – interner Endpunkt kann in den Browser gelangen

`minio-config.ts` behandelt `S3_PUBLIC_BASE_URL` als optional und fällt auf
`S3_ENDPOINT` zurück. Die vorgesehene Runtimevorlage nennt intern
`http://minio:9000`; dieser Host darf weder als signierte Galerie-URL noch als
Infrastrukturhinweis an den Browser gelangen.

Korrektur:

- `S3_PUBLIC_BASE_URL` ist eine eigene Pflichtvariable ohne Fallback auf
  `S3_ENDPOINT`.
- Endpoint und Public-Base werden als absolute HTTP(S)-URLs ohne Benutzerinfo,
  Query oder Fragment validiert. Fehler nennen nur Variablennamen.
- Für Stage/Produktion gilt die festgelegte Same-Origin-Proxygrenze: die
  öffentliche Signierbasis liegt unter demselben Origin wie `AUTH_URL` und wird
  vom Unternehmens-Reverse-Proxy auf den privaten MinIO-Dienst geroutet. So
  bleibt CSP `img-src 'self'` und der unveränderte Image-Digest kann zwischen
  Umgebungen promoviert werden. Keine Wildcard und keine erfundene Domain.
- Der interne S3-Endpunkt bleibt server-only. In Stage/Produktion darf er nicht
  identisch mit der öffentlichen Signierbasis sein. Lokale synthetische Tests
  dürfen über klaren Testmodus denselben Loopback-Endpunkt verwenden.
- Konfigurations-, Runtime- und Negativtests müssen fehlende Public-Base,
  interne Fallbackadresse, falsches Schema, Benutzerinfo, Query/Fragment,
  Originabweichung und Secret-Leakage abdecken.

## Befund 3 – ungültige Offline-ID deaktiviert Deduplizierung

`image-upload-core.ts:229–239` protokolliert eine nicht kanonische
`client_action_id` und führt den Upload anschließend ohne Deduplizierung aus.
Das schwächt die garantierte Offline-Idempotenz und unterscheidet sich vom
früheren fail-closed Datenbankverhalten.

Korrektur:

- Fehlt die ID vollständig, bleibt der interaktive Upload ohne Marker zulässig.
- Ist sie nicht leer, aber keine kanonische UUID, wird vor jedem Objektzugriff
  neutral und deterministisch abgewiesen. Kein Upload, kein Marker, kein
  Metadatensatz.
- Die API antwortet dafür mit 400 und ohne interne Details. Direkter Core-Test
  belegt null PUTs und null Datenbankänderungen.
- Gleichzeitige gültige Wiederholungen derselben ID erzeugen höchstens einen
  logischen Upload. Prüfe den tatsächlichen Parallelfall, nicht nur zwei
  sequenzielle Inserts.

## Befund 4 – synthetischer S3-Endpunkt beweist private Reads, nicht Writes

`s3-test-endpoint.mjs` rechnet die SigV4-Presign-Signatur für GET nach, nimmt
PUT und DELETE aber ohne jede Authentisierungsprüfung an. Damit belegt der Test
weder signierte SDK-Schreibzugriffe noch die private Schreib-/Löschgrenze.

Korrektur:

- Der synthetische Endpunkt prüft auch die SigV4-Authorization der tatsächlichen
  SDK-Anfragen für PUT und DELETE kryptografisch oder die Integration läuft
  gegen einen echten temporären MinIO-Dienst.
- Unsignierter, falsch signierter und mit falschem Access-Key ausgeführter PUT
  und DELETE müssen 403 ergeben und den Objektbestand unverändert lassen.
- Die Produktionspfade verwenden weiterhin das echte AWS SDK v3; kein Stub des
  Produktionsmoduls.
- Docker ist lokal derzeit nicht verfügbar. Das ist kein lokaler MinIO-Erfolg.
  Ergänze, soweit im bestehenden CI-Modell sicher möglich, einen echten
  kurzlebigen MinIO-Service für den GitHub-Nachweis. Falls dies nicht innerhalb
  des Scopes belastbar gelingt, benenne der echte MinIO-Lauf ausdrücklich als
  offenen Nachweis; er darf nicht durch „S3-kompatibel“ umetikettiert werden.

## Noch nicht ausgeführter Pflichtumfang aus dem Originalauftrag

Der erste Lauf änderte weder Supabase-Pakete/-Clientdateien noch CSP, Runtime-
Konfiguration, Compose, Deploy-Dokumentation oder `PROJEKT_WISSEN.md`. Er ist
deshalb fachlich nur ein Zwischenstand.

Führe jetzt die ursprünglichen Teilpakete 5–8 vollständig und sequenziell aus:

1. **Supabase-Rest entfernen:** vollständige produktive Importsuche; danach
   `@supabase/ssr`, `@supabase/supabase-js`, die drei Clientdateien und
   `NEXT_PUBLIC_SUPABASE_*` entfernen. `database.types.ts` nur bei echtem
   Nullverbrauch entfernen. Historische Migrationstexte bleiben erhalten.
2. **CSP und Runtime:** Supabase-Wildcards entfernen; wegen Same-Origin-Pfad
   keine neue Wildcard. Runtimeprüfung und Env-Vorlagen für alle MinIO-Werte,
   verbotene Altvariablen und sichere Fehlermeldungen aktualisieren.
3. **Deploy:** privater MinIO-Dienst ohne Host-Port, Secrets nur über
   gitignorierte Env-Datei, persistentes Volume, Healthcheck, feste kontrollierte
   Image-Referenz, App-Abhängigkeit und interne Netzwerkgrenze. Die öffentliche
   Same-Origin-Proxyroute nur als IT-Anforderung dokumentieren; keine reale
   Adresse oder Freigabe erfinden.
4. **Betriebsdokumentation:** `deploy/README.md` sachlich auf PostgreSQL/Auth.js/
   MinIO aktualisieren; getrennte und zeitlich konsistente DB-/Objektsicherung,
   Restore-Grenze, weiterhin fehlende IT-Daten und V1-Sperre klar nennen. Keine
   erfundenen Container-/Recovery-Nachweise.
5. **Sicherheit/Tests:** `kb-tests-evidence` und `kb-sicherheit-rls` prüfen den
   vollständigen Gesamtdiff read-only. Erst danach darf `kb-dokumentation`
   ausschließlich bestätigte Ergebnisse knapp in `PROJEKT_WISSEN.md` ergänzen.

## Zusätzliche Architekturkontrollen

- Der private Bucket muss reproduzierbar existieren, ohne beim App-Request mit
  privilegierten Root-Zugangsdaten erzeugt zu werden. Bootstrap/Init ist
  idempotent, getrennt vom App-Lauf und verwendet nur dafür vorgesehene
  Runtime-Secrets.
- Keine MinIO-Root-Zugangsdaten in der Webanwendung. App-Zugangsdaten werden auf
  genau den privaten Bucket und benötigte Objektoperationen begrenzt.
- Presigned GET bleibt kurzlebig; kein presigned PUT im Browser.
- Fehlende oder nicht sichtbare Bild-/Vorgangszeilen liefern keine
  Existenzaussage. Objektkeys, Endpoint, Bucket, SQL- und SDK-Rohtexte gelangen
  nicht in Clientantworten.
- Soft-Delete entfernt kein Objekt. V1 bleibt Produktionssperre.
- Kein sichtbarer GUI-/Text-/Layout-Eingriff.

## Abschlussgate

Die Definition of Done des Originalauftrags gilt vollständig. Zusätzlich muss
die Übergabe ausdrücklich ausweisen:

- dass der abschließende Gesamtlauf **nach** allen Korrekturen synchron beendet
  wurde;
- Exit-Code und Einzelresultat der neuen Bildintegration;
- Nachweis für autorisierte und abgewiesene GET/PUT/DELETE-Signaturen;
- Parallel-Dedup und ungültige-ID-Fall;
- null Supabase-Laufzeitreste und aktualisierte Paket-/CSP-/Env-/Compose-Lage;
- MinIO echt gelaufen oder ausdrücklich offen – keine Gleichsetzung mit dem
  synthetischen S3-Endpunkt;
- Port-, Prozess-, Container-, Volume-, Temp- und Logbereinigung;
- vollständiger Git-Status;
- kein Commit und kein Push.

Bei erneutem vorzeitigem Orchestratorende oder erneut verwaistem Testcluster
greift der Circuit Breaker: sofort an Codex übergeben, keinen dritten gleichen
Versuch starten.
