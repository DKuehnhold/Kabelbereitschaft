# Datenschutz

> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1

## Grundsatz Datenminimierung

Die App verarbeitet nur die für die Bereitschaftsabwicklung notwendigen Daten. Es gibt **kein permanentes Standort- oder Personentracking**.

## Personenbezogene Daten

| Datum | Zweck |
| --- | --- |
| Benutzer (E-Mail, Name, Rolle) | Anmeldung, Zuweisung, Nachvollziehbarkeit |
| „Hochgeladen durch" / „geändert durch" | Zuordnung von Doku und Chronik zu Bearbeitern |

Es werden keine über den Einsatzzweck hinausgehenden Personendaten erhoben.

## Standort und GPS

- Kein Live-GPS, keine Navigation, kein Bewegungsprofil.
- GPS-Koordinaten stammen **ausschließlich aus dem Bild-EXIF**, sofern im jeweiligen Bild vorhanden.
- Bilder ohne GPS/EXIF werden regulär gespeichert (kein Zwang zur Ortung).

## Zugriff und Speicherung

- **Private Storage-Buckets**, kein öffentlicher Bildzugriff; nur signierte/geschützte Zugriffe.
- Zugriff auf Daten **nach Rolle** (Row Level Security): Monteure sehen nur zugewiesene Vorgänge.
- Datenbank und Storage bei Supabase (verschlüsselte Verbindung).

## Aufbewahrung und Löschung

- Vorgangs- und Dokumentationsdaten werden für die Dauer der betrieblichen/rechtlichen Aufbewahrungspflicht gehalten (konkrete Fristen sind organisatorisch festzulegen).
- Benutzer werden deaktiviert (`is_active`), nicht sofort gelöscht, um Chronik-Nachvollziehbarkeit zu wahren.
- Löschkonzept für abgelaufene Daten in späterem AP zu definieren.

## Auftragsverarbeitung

- Supabase ist Auftragsverarbeiter (DB, Auth, Storage). Ein Auftragsverarbeitungsvertrag (AVV) ist abzuschließen.
- **Region beachten:** Supabase-Projektregion so wählen, dass Daten innerhalb der EU verarbeitet werden.
- Auch Vercel als Hosting-Anbieter ist entsprechend zu bewerten (Region/AVV).

## AP7 – Technische Datenschutzbewertung (keine juristische Freigabe)
- **Datenminimierung/Zweckbindung:** Erfasst werden nur für die Vorgangsdokumentation nötige Daten;
  Bilder/GPS dienen der Nachweisführung am Einsatzort. Zugriffskreis über RLS begrenzt (Staff/zugewiesener Monteur).
- **GPS/Bild:** fachlich notwendig; Aufbewahrung an Vorgang gekoppelt; Export über CSV/Bilder nur für Berechtigte;
  Missbrauchsrisiko durch private Speicherung + signierte URLs (Ablauf) reduziert.
- **Speicherdauer/Löschung:** Soft-Delete (AP4) + geplante physische Bereinigung (Konzept); **Fristen offen**
  (nicht erfunden) – vom Auftraggeber festzulegen. Audit-Aufbewahrung ≥ gesetzliche Frist (offen).
- **Lokale Offline-Daten (IndexedDB):** nur fachliche Daten + eigene Warteschlangen, benutzergetrennt (`ownerId`);
  keine Tokens/Secrets. Service-Worker-Cache: nur Same-Origin-GET, keine `/api`/`/auth`/Supabase-Antworten.
- **Benutzerwechsel/Logout:** fremde Offline-Daten nicht sichtbar; nicht synchronisierte Änderungen werden
  nicht still gelöscht. Browserprüfung des Benutzerwechsels offen (kein Browser in dieser Umgebung).
- **Server-Logs/CI/Testdaten:** keine personenbezogenen/produktiven Daten in CI; Testbilder neutral generiert.
- Einstufung: **technische** Bewertung; eine juristische Prüfung/Freigabe hat nicht stattgefunden.
