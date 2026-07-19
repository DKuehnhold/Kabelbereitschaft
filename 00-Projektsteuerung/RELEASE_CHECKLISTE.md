# Release-Checkliste & Gates (AP7)
> Stand: 2026-07-19 · Ein nicht bestandenes Gate darf nicht als bestanden dargestellt werden.

## Release-Gates
- **Gate 1 – Codequalität:** Lint grün · TypeScript grün · Build grün · keine kritischen Codefehler. → aktuell **bestanden**.
- **Gate 2 – Datenbank:** Migrationen 0001–0006 · RLS · Smokes 10–13 · kein Datenverlust. → **bestanden**.
- **Gate 3 – Security:** keine kritischen Lücken · keine Secrets · Endpunkte geprüft · Storage geschützt · Header geprüft (CSP-Enforcing offen). → **weitgehend**.
- **Gate 4 – E2E:** Auth/Rollen/Vorgänge/Bilder/CSV/Offline/Sync/Konflikte. → **teilweise** (`@public` request-basiert grün; seitenbasiert/`@app` offen: Browser-Libs + Test-Supabase).
- **Gate 5 – Accessibility:** automatisiert (axe) · Tastatur · Fokus · Kontraste. → **teilweise** (Struktur vorhanden; Browser-/Manuellprüfung offen).
- **Gate 6 – Betrieb:** Deployment-Checkliste · Backup · Recovery · Monitoring · Rollback. → **Konzepte vorhanden** (Recovery-Test offen).
- **Gate 7 – Release:** Doku vollständig · Release Notes · Risiken bewertet · **Freigabe durch Nutzer**. → **offen**.

## Manuelle Abnahmecheckliste (durch Dritte reproduzierbar)
Pro Gerät (Desktop / Smartphone / Tablet) und im PWA-Standalone-Modus:
1. Login gültig/ungültig; Logout; geschützte Route ohne Login → /login.
2. Rollen-Navigation (admin/dispo/monteur) korrekt; direkter URL-Aufruf umgeht keine Rechte.
3. Vorgangsübersicht + Filter + Volltextsuche; Detail + Timeline.
4. Notiz hinzufügen; Statusänderung (rollenabhängig).
5. Bild-Upload JPG/PNG + Mehrfach; ungültiger Typ/zu groß blockiert; Galerie/Großansicht/vor-zurück.
6. Kategorie/Beschreibung ändern; GPS-Link nur bei gültigem GPS; Soft-Delete blendet aus.
7. CSV-Export gefiltert; Öffnen in dt. Excel (Umlaute, Semikolon, keine Formelausführung).
8. Offline schalten: Offline-Status sichtbar; Vorgang/Timeline aus Cache; Notiz/Status/Upload vormerken.
9. Reload/Browser-Neustart: Warteschlange bleibt; Reconnect → Synchronisation; keine Dubletten.
10. Konfliktfall: Serveränderung durch 2. Nutzer; Konflikt sichtbar; Auflösung (übernehmen/erneut/verwerfen).
11. Benutzerwechsel: Login A → Aktionen → Logout → Login B; keine Sichtbarkeit fremder Offline-Daten; A's unsynchronisierte Aktionen nicht gelöscht.
12. Service-Worker-Update: neue Version → „Jetzt aktualisieren" ohne Verlust offener Eingaben/Queue.
13. Tastaturbedienung (Fokusreihenfolge/-sichtbarkeit), Screenreader-Basisprüfung, Zoom 200 %, reduzierte Bewegung.
14. Fehlerfälle: Netzwerkfehler, Serverfehler, ungültige Datei, Speicherlimit, abgelaufene Sitzung → verständliche Meldung, kein Datenverlust, keine Endlosschleife.
