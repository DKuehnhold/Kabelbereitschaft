# Bilddokumentation (AP4)
> Stand: 2026-07-19 · Ergänzt BILD_UND_EXIF_LOGIK.md

## Zweck
Fotodokumentation je Vorgang: Upload, Kategorisierung, EXIF/GPS-Auswertung, Galerie mit
Großansicht, nachträgliche Bearbeitung, Soft-Delete und lückenlose Chronik/Audit.

## Bildkategorien (kombiniert, 15)
Bestehend aus AP1 (unverändert): Übersicht, Zugang, Schadstelle, Zustand vor Arbeit,
Zustand nach Arbeit, Arbeitsausführung, Materialeinsatz, Restmangel, Sonstige Dokumentation.
Ergänzt in AP4 (additiv): Schaden, Detail, Reparatur, Abschluss, Material, Sonstiges.
Fachlich getrennt: Schadstelle/Schaden, Arbeitsausführung/Reparatur, Materialeinsatz/Material,
Sonstige/Sonstiges. Das Enum wird ausschließlich additiv erweitert.

## Upload
- Ein- oder Mehrfachupload per Drag-and-drop oder Dateiauswahl im Bereich „Bilder" des Vorgangs.
- Erlaubte Formate: **JPG/JPEG/PNG**. HEIC wird nicht akzeptiert (keine zuverlässige
  Browser-Vorschau/Verarbeitung).
- Maximale Dateigröße zentral über `NEXT_PUBLIC_MAX_IMAGE_MB` (Standard 15 MB).
- Prüfebenen: Client (nur Benutzerführung) → Server (Magic-Bytes-Prüfung, EXIF) →
  Storage-Bucket (Größen-/MIME-Limit, maßgeblich).
- Kategorie ist Pflicht, Beschreibung optional. Erfolgreiche Uploads erscheinen sofort.

## Metadaten (Tabelle `incident_images`)
Bild-ID, Vorgangs-ID, Storage-Pfad, ursprünglicher Dateiname, MIME-Type, Dateigröße, Breite,
Höhe, Kategorie, Beschreibung, Aufnahmedatum, Uploaddatum, Uploader, Kameramodell,
GPS-Breite/-Länge, EXIF-Ausrichtung, Soft-Delete (`deleted_at`, `deleted_by`).

## EXIF/GPS
Serverseitig via `src/lib/exif.ts` (exifr): Aufnahmedatum, Kamera, GPS, Ausrichtung (1–8),
Breite/Höhe. Regeln: fehlende EXIF sind kein Fehler; ungültige EXIF brechen den Upload nicht ab;
GPS nur bei gültigem Wertebereich (Lat −90..90, Lon −180..180) und nur wenn beide Werte gültig;
DB-Constraints sichern die Bereiche zusätzlich ab. Ausrichtung wird in Vorschau/Großansicht über
`image-orientation: from-image` berücksichtigt. Bei gültigem GPS: Anzeige + Google-Maps-Link
(keine Kartenbibliothek in AP4; Struktur für spätere Karte geeignet).

## Bearbeiten / Soft-Delete
Berechtigte ändern Kategorie und Beschreibung nachträglich (validiert). Löschen erfolgt als
Soft-Delete: `deleted_at`/`deleted_by` werden gesetzt, das Bild verschwindet aus der
Standardgalerie; Storage-Objekt bleibt vorerst erhalten (spätere administrative Bereinigung).

## Chronik & Audit
Trigger `trg_incident_image_event` schreibt Bild-Ereignisse (Upload, Kategorie-/Beschreibungs-
änderung, Soft-Delete) in die bestehende Chronik `incident_notes` (Feld `image_id`), sichtbar in
der Timeline. Der bestehende Trigger `trg_audit_images` protokolliert unabhängig in `audit_events`.

## Rollen (durch RLS erzwungen)
- Administrator: alle Bilder sehen, hochladen, ändern, Soft-Delete.
- Disposition: Bilder berechtigter Vorgänge sehen/hochladen/ändern/Soft-Delete (Staff).
- Monteur: Bilder zugewiesener Vorgänge sehen/hochladen; eigene (hochgeladene) Bilder ändern/löschen.
Client-Sichtbarkeit ist nur Komfort; RLS und Server sind maßgeblich.

## Dashboard
Kennzahl „Heute hochgeladene Bilder" (nur nicht gelöschte) für Disposition/Administration,
basierend auf dem bestehenden Zeit-/Zeitzonenkonzept (lokaler Tagesbeginn).
