# Konfliktbehandlung – AP6
> Stand: 2026-07-19

## Erkennung
Bei einer offline vorgemerkten **Statusänderung** merkt sich der Client den `updated_at`-Stand des
Vorgangs zum Zeitpunkt der Erfassung (`baseUpdatedAt`). Beim Synchronisieren prüft `/api/sync`
den aktuellen `incidents.updated_at`:
- unverändert → Änderung wird angewendet;
- abweichend → **Konflikt**: die Änderung wird **nicht** angewendet (keine stille Überschreibung),
  der Dedup-Marker wird kompensiert, und der Konflikt wird an den Client zurückgemeldet.

Notizen sind anhängend (kein Konflikt). Bild-Uploads erzeugen neue Datensätze (kein Überschreiben).

## Dokumentation des Konflikts
Der Client speichert den Konflikt in IndexedDB (`conflicts`, pro `ownerId`) mit: betroffenem Vorgang,
Konflikttyp, lokal geplantem Wert (Status), Zeitpunkt der lokalen Änderung und Serverstand
(`serverUpdatedAt`). Er erscheint in der Offline-Leiste. Audit/Timeline enthalten **keinen**
irreführenden Erfolgseintrag, da die Änderung serverseitig nicht angewendet wurde.

## Auflösung (kontrolliert, keine stille Auswahl)
In der Offline-Leiste je Konflikt:
- **Serverstand übernehmen** – lokale Änderung verwerfen, Serverstand bleibt gültig.
- **Lokale Änderung erneut anwenden (aktueller Stand)** – lädt den aktuellen Serverstand
  (`GET /api/incidents/[id]/meta`) und merkt die Statusänderung auf dieser Basis neu vor;
  beim nächsten Flush wird sie regulär (mit erneuter Server-/RLS-Validierung) angewendet.
- **Verwerfen** – Konflikt entfernen.

## Regeln
- Nur fachlich gültige Statusübergänge (Monteur nur erlaubte Status; DB-Trigger `tg_incident_guard`
  erzwingt dies zusätzlich).
- Berechtigungen und RLS gelten auch bei der erneuten Anwendung – keine reine Cliententscheidung.
- Die betroffene Aktion bleibt bis zur Entscheidung nachvollziehbar erhalten.
