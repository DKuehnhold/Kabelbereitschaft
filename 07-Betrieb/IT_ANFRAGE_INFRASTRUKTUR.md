# IT-Anfrage: Zielinfrastruktur für die Kabelbereitschaft-App

> Stand: 2026-08-01. Dieses Dokument ist ein Bestellzettel für die interne IT, zusammengestellt
> aus den bereits bestehenden Anforderungen in `deploy/README.md` (Abschnitte 2, 4, 5, 10, 13) und
> den Vorlagen unter `deploy/env/*.example`. Es erfindet nichts Neues und ersetzt kein
> Steuerungsdokument — `deploy/README.md` bleibt die technische Quelle. Zweck ist ausschließlich,
> alles an einer Stelle zu bündeln, was du an die IT weiterreichen kannst.
>
> Ohne diese Angaben ist die Browser-/Offline-/Sicherheits-/Betriebsabnahme (AP14) nicht
> startfähig — das ist aktuell der einzige Punkt, der zwischen dem jetzigen Stand und
> „nur noch GUI abnehmen" liegt.

Zwei getrennte Umgebungen werden gebraucht: **Stage** und **Produktion**, jeweils mit eigenen
Zugangsdaten, eigener Datenbank und eigenem Objektspeicher-Volume. Für Stage genügt es, zuerst zu
liefern — Produktion kann folgen, sobald Stage läuft.

---

## 1. Zielserver

| Angabe | Wird gebraucht für |
| --- | --- |
| Betriebssystem/Distribution und Version | Grundlage für Docker-Installation |
| Prozessorarchitektur (wir nehmen `amd64` an — bitte bestätigen) | Falls abweichend: Multi-Arch-Build nötig, eigener Vorlauf |
| CPU, RAM | Dimensionierung |
| Speicherplatz für **zwei getrennte** Volumes: Datenbank und Bilder (Objektspeicher) | Beide wachsen unabhängig; Bemessung liegt bei der IT |
| Installationspfad auf dem Server | Ablage von `deploy/` |
| Ausführender Benutzer kann Docker **ohne `sudo`** nutzen | Deploy-Skripte |
| Docker Engine ≥ 24 (empfohlen ≥ 25) | `--wait`-Unterstützung in Compose |
| Docker Compose v2 (Plugin `docker compose`, **nicht** `docker-compose`) | Startskripte |
| Ausgehender Zugriff auf `ghcr.io` | `docker pull` unseres Images |

## 2. Domain, DNS, Reverse Proxy

Der Reverse Proxy ist laut Zielentscheidung **HAProxy**, außerhalb unseres Containerstacks. Wir
veröffentlichen keinen Port — weder für die Anwendung noch für die Datenbank noch für den
Objektspeicher.

| Angabe | Zweck |
| --- | --- |
| Domain bzw. Subdomain für Stage | wird zu `AUTH_URL` |
| Domain bzw. Subdomain für Produktion | wird zu `AUTH_URL` (getrennt von Stage) |
| DNS-Stand/Zeitplan | Voraussetzung für TLS und ersten Aufruf |

**Anforderungen an HAProxy** (bereits in `deploy/README.md` Abschnitt 1 beschrieben, hier als
Checkliste für die IT):

- TLS-Terminierung, mindestens TLS 1.2; HTTP wird auf HTTPS erzwungen.
- Setzt `X-Forwarded-For`, `X-Forwarded-Proto`, `X-Forwarded-Host` und verwirft von außen
  eingehende Fälschungen dieser Header.
- Uploadgröße mindestens `NEXT_PUBLIC_MAX_IMAGE_MB` (Standard 15 MB) plus Reserve; passende
  Zeitlimits für Uploads und Server Actions.
- Rate Limiting liegt auf Proxy-Ebene (Entscheidung V4), nicht in der Anwendung — konkrete Regeln
  legt die IT fest.
- **Bucket-Route (wichtig, sonst bleiben Bilder unerreichbar):** Unter **demselben Origin** wie
  `AUTH_URL` muss ein zweiter Pfad an den privaten `minio`-Dienst weitergeleitet werden. Da wir
  Path-Style-Adressierung verwenden, beginnt dieser Pfad mit dem Bucketnamen (`incident-images`).
  Der Proxy darf Pfad, Query-Parameter und Host beim Weiterleiten **nicht verändern** — die
  Signatur der Bild-URL deckt das ab. Wie der Proxy den Host dabei genau behandelt, ist beim
  ersten echten Aufbau gemeinsam mit der IT zu klären.

## 3. Datenbank (PostgreSQL 18)

Stage und Produktion brauchen **getrennte** Instanzen bzw. Datenbanken mit eigenen Zugangsdaten,
kein gemeinsames Passwort.

| Wert | Herkunft |
| --- | --- |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | von der IT vergeben (Eigentümerkonto der Instanz) |
| Netzwerk-/Erreichbarkeitsweg zwischen App-Container und Datenbank | IT legt fest, wie beide sich im internen Netz erreichen |
| Volumegröße | siehe Abschnitt 1 |

Die Anwendung selbst verbindet sich **nicht** mit dem Eigentümerkonto, sondern mit einer
eingeschränkten Rolle (`app_user`, kein `SUPERUSER`, kein `BYPASSRLS`) — die legt unser
Bootstrap-Verfahren an, dafür wird von der IT nichts zusätzlich gebraucht.

`AUTH_SECRET` (Schlüsselmaterial für Sitzungstokens) kann technisch mit `openssl rand -base64 32`
erzeugt werden — die IT muss es nur sicher als Runtime-Secret ablegen (nicht im Image, nicht im
Repository), getrennt für Stage und Produktion.

## 4. Objektspeicher (MinIO) — Bildspeicher

| Wert | Herkunft |
| --- | --- |
| **MinIO-Server-Image-Referenz** (Tag **und** Digest) | **muss die IT liefern.** Wir setzen hier bewusst keinen Standardwert — welche MinIO-Version eingesetzt und freigegeben wird, ist eine IT-Entscheidung |
| `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` | von der IT erzeugt, lang und zufällig (z. B. `openssl rand -base64 32`) |
| Volumegröße für Bilddaten | siehe Abschnitt 1, getrennt von der Datenbank |

**Manuelle Einrichtung durch die IT, einmal je Umgebung, vor dem ersten Start** (unser Stack legt
das bewusst nicht mehr automatisch an, siehe `deploy/README.md` Abschnitt 4 für die Begründung):

1. Privaten Bucket **`incident-images`** anlegen.
2. Anonyme Freigabe **ausdrücklich entfernen** (auch wenn nie eine gesetzt war) — keine öffentliche
   Policy, keine öffentliche ACL.
3. Policy **`incident-images-app`** anlegen, Inhalt wortwörtlich aus
   `deploy/minio/incident-images-app.policy.json` (erlaubt genau `s3:GetObject`, `s3:PutObject`,
   `s3:DeleteObject` auf diesen einen Bucket — kein Listing, keine Bucketverwaltung).
4. Eigene **Anwendungsidentität** anlegen (eigene Kennung, langes zufälliges Geheimnis) und ihr
   **ausschließlich** diese eine Policy zuordnen.
5. **Verifizieren, nicht überspringen:** bestätigen, dass die Policy tatsächlich zugeordnet ist,
   und prüfen, dass die Identität **keine** weitergehenden Rechte hat (kein `s3:ListBucket`, kein
   `s3:*`, keine Bucketverwaltung, kein Zugriff auf andere Buckets).

**Wichtige Auflage:** Zugangsdaten dürfen bei diesem Schritt **nicht als Kommandozeilenargument**
übergeben werden (sichtbar in der Prozessliste) — zulässig sind Umgebungsvariable, `stdin` oder
eine Konfigurationsdatei mit restriktiven Rechten. Das gilt unabhängig davon, ob die IT
Kommandozeilenwerkzeug, Weboberfläche oder eigene Automatisierung einsetzt.

**Ergebnis dieser fünf Schritte** sind die Werte, die wir anschließend in unsere Konfiguration
eintragen: Bucketname → `S3_BUCKET`, Kennung → `S3_ACCESS_KEY_ID`, Geheimnis →
`S3_SECRET_ACCESS_KEY`. Die Root-Zugangsdaten aus `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` sieht die
Anwendung selbst nie.

## 5. Container-Registry

| Angabe | Zweck |
| --- | --- |
| Zugriff des Zielservers auf `ghcr.io` (ausgehend) | `docker pull` |
| Personal Access Token mit Scope `read:packages` für `docker login ghcr.io` auf dem Server | Zugriff auf unser privates Image |

Die konkrete Image-Referenz (`APP_IMAGE_REF`, Tag **und** Digest) liefern wir je Release; das ist
keine IT-Angabe.

## 6. Zusammenfassung: was die IT konkret erzeugen/liefern muss

| Geheimnis/Wert | Umgebung | Wer erzeugt es |
| --- | --- | --- |
| `POSTGRES_PASSWORD` (+ `POSTGRES_DB`, `POSTGRES_USER`) | Stage, Produktion je eigenes | IT |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | Stage, Produktion je eigenes | IT |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` (Anwendungsidentität) | Stage, Produktion je eigenes | IT, im Zuge der MinIO-Provisionierung (Abschnitt 4) |
| `AUTH_SECRET` | Stage, Produktion je eigenes | kann technisch von uns generiert werden, IT legt sicher ab |
| Domain/DNS für `AUTH_URL` | Stage, Produktion je eigenes | IT |
| MinIO-Image-Referenz (Tag + Digest) | einmalig, für beide Umgebungen | IT |
| ghcr.io Personal Access Token | Zielserver | IT/wir gemeinsam |

Alle Werte: nie im Repository, restriktive Dateirechte (`chmod 600`) auf dem Server, kein
gemeinsames Passwort zwischen Stage und Produktion.

## 7. Backup und Recovery

Aktuell existiert nur ein Sicherungsskript für die **Datenbank** (`scripts/db-backup.sh`,
`pg_dump` + Prüfsumme). Für die **Bilddaten im Objektspeicher gibt es noch kein Sicherungsverfahren** —
das muss die IT festlegen. Offene Punkte:

- Backupziel für beide Bestände (Datenbank-Dumps **und** Objektdaten), Aufbewahrungsdauer,
  Verschlüsselung, Auslagerung.
- Verantwortlichkeit: wer führt Sicherung und Wiederherstellung operativ durch.
- Recovery-Ziel (RPO/RTO) für Datenbank **und** Objektspeicher.
- Datenbank und Objektspeicher werden unabhängig voneinander gesichert; ein Wiederherstellungspunkt
  ist deshalb **nicht garantiert deckungsgleich** (ein wiederhergestellter Datensatz kann auf ein
  noch fehlendes Bild zeigen, oder umgekehrt ein Bild ohne zugehörigen Datensatz zurückkommen). Wie
  damit umgegangen wird, ist eine offene Betriebsentscheidung.
- Ein Recovery-Test hat bisher nicht stattgefunden — das ist Teil der AP14-Abnahme, sobald die
  Umgebung steht.

## 8. Monitoring und Logs

- Logrotation ist im Container gesetzt (lokal, 10 MB × 5 Dateien je Dienst). Eine **zentrale
  Logaufbewahrung** ist offen — falls gewünscht, bitte Ziel/Weg nennen.
- Benachrichtigungsweg bei Fehlern bzw. ausgefallenem Health-Check (`/api/health`) ist offen.

## 9. Wichtige Randbedingungen, die die IT kennen sollte

- **V1 (Aufbewahrungsfristen) ist noch offen und wirkt als Produktionssperre.** Bis zur
  Entscheidung dürfen Stage und Tests ausschließlich mit **synthetischen** Personen-, EXIF- und
  GPS-Daten laufen — kein produktiver Datenanfall. Das betrifft die IT nicht technisch, ist aber
  wichtig für den Umgang mit den bereitgestellten Umgebungen.
- Migrationen laufen **nicht automatisch** beim Containerstart — sie werden ausschließlich nach
  ausdrücklicher Freigabe durch Dennis eingespielt.
- In Produktion ist ausschließlich ein **Digest** als Image-Referenz zulässig, kein beweglicher Tag.

---

**Sobald diese Angaben vorliegen**, können wir MinIO real gegen einen echten Container abnehmen,
die Umgebung erstmals starten und in die vollständige Browser-/Offline-/Sicherheits-/
Betriebsabnahme (AP14) gehen. Danach bleibt nur noch die GUI-/Designabnahme mit dir übrig.
