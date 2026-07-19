# Abnahme Arbeitspaket 1

> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1

Abhakbare Abnahmecheckliste für den Lieferstand AP1.

## Checkliste

- [ ] **Lokal installierbar** – `cd app && npm install` läuft ohne Fehler (Node 22, npm).
- [ ] **App startet lokal** – `npm run dev` startet die Anwendung, Startseite erreichbar.
- [ ] **Loginseite vorhanden** – `/login` mit Firmenlogo und Anmeldeformular.
- [ ] **Rollenstruktur technisch vorbereitet** – Rollen `administrator`, `disponent`, `monteur` als Enum `user_role` auf `profiles`.
- [ ] **DB-Schema als Migration** – vollständige Migration für alle Tabellen, Enums und Views vorhanden.
- [ ] **RLS dokumentiert und umgesetzt** – Row-Level-Security-Policies in der Migration; Verhalten dokumentiert.
- [ ] **Vault-Doku vorhanden** – Dokumente in den Ordnern 00–99 angelegt.
- [ ] **`npm run lint` ok** – keine Lint-Fehler.
- [ ] **TypeScript-Prüfung ok** – Typecheck ohne Fehler.
- [ ] **Produktions-Build ok** – `npm run build` erfolgreich.
- [ ] **Keine Secrets im Repo** – nur `.env.example`, keine echten Schlüssel/Passwörter versioniert.
- [ ] **Offene Punkte dokumentiert** – bekannte Einschränkungen und geplante Funktionen späterer APs festgehalten.

## Offene Punkte / geplant für spätere APs

- Vorgangserfassung, Zuweisung, Statuslauf und Chronik (funktional).
- Bild-Upload inkl. serverseitiger EXIF-Auswertung.
- Materialbewegungen und Bestandsableitung.
- CSV-Export der Vorgangsübersicht.
- Filter (Status, Baustufe, Monteur, Zeitraum).

Die zugehörigen Akzeptanzkriterien stehen in `01-Anforderungen/AKZEPTANZKRITERIEN.md`.
