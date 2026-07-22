# Stammdaten & Einstellungen (AP9)

Interne Verwaltung der Stammdaten. Zugriff: Administration und Disposition (schreibend),
Monteur ausschließlich lesend, soweit erforderlich. Fachliches Löschen ausschließlich über
`aktiv/inaktiv` (kein physisches Löschen über die Oberfläche).

## Bereiche (Navigation → „Stammdaten")
- **Kunden** – Name, ERP-ID (optional, eindeutig), aktiv. Interner Stammsatz eines Vorgangs.
- **Bauabschnitte** – Code, Bezeichnung, Beschreibung, WUS-BST (ERP-Referenz, optional),
  Standard-Bereitschaftsnummer (Verweis auf bestehende Bereitschaftsnummern), aktiv.
- **VzG-Strecken** – vierstellige Streckennummer (`^[0-9]{4}$`), Bezeichnung, Bauabschnitt,
  aktiv. Eindeutig je Bauabschnitt; dieselbe Nummer darf mehreren Bauabschnitten zugeordnet sein.
- **Ansprechpartner** – Kunde, Name, Funktion, E-Mail, mehrere typisierte Telefonnummern
  (Mobil/Festnetz/Leitstelle/Sonstige, sortierbar), Zuordnung zu mehreren Bauabschnitten, aktiv.
- **Monteure** – Vorname, Nachname, aktiv, optionale spätere Benutzerkonto-Verknüpfung
  (`profile_id`, keine SSO in AP9). Inklusive CSV-Import.
- **Teams** – Name, aktiv, Mitglieder (Monteure); Mehrfachmitgliedschaft zulässig.
- **Kabelarten** – Referenzliste (50 Hz, OLA, LST, TK, LWL, Unbekannt), Code eindeutig, aktiv.
- **Einstellungen** – Standardkunde und Standard-Bereitschaftsnummer (zentrale Singleton-Tabelle).

## Monteur-CSV-Import
Erwartete Kopfzeile: `Vorname;Nachname;Aktiv` (optional `Profil-ID`). UTF-8 mit/ohne BOM,
Trennzeichen `;` oder `,`. Ablauf: Vorschau mit Validierung, Fehlerliste und
Dublettenerkennung (Datei und Datenbank; Name + optional Profil-ID) → Bestätigung → Anlage
ausschließlich neuer Datensätze. Keine stille Überschreibung bestehender Monteure.

## Nachvollziehbarkeit
Alle Änderungen werden feldgenau und unveränderbar über das bestehende Audit protokolliert
(`audit_events`/`tg_audit`; bei Änderungen alte und neue Feldwerte).
