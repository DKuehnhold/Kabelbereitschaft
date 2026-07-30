Du bist der Programmierer der Kabelbereitschaft-App. Arbeite ausschliesslich im
bestehenden Vault. Lies `AGENTS.md`, `CLAUDE.md` und den aktuellen Diff.

## Auftrag: eine letzte begrenzte Reviewkorrektur

In `app/src/lib/auth-session-response.ts` ist die Browser-Sitzungsfilterung noch
nicht vollständig fail-closed: Ein lesbares JSON-Objekt ohne eigenes `user`-Feld
wird derzeit unverändert durchgereicht. Der Architekturauftrag verlangt, dass
eine Sitzungsantwort ohne geprüftes `user`-Objekt nicht vorsorglich passieren
darf.

Korrigiere ausschliesslich Folgendes:

- `null` bleibt die ausdrückliche reguläre Antwort „keine Sitzung“.
- Ein JSON-Objekt mit einem echten `user`-Objekt darf passieren; vorhandenes
  `user.sid` wird entfernt.
- Jedes andere nichtleere Format, insbesondere Objekt ohne `user`, `user: null`,
  Array, Text oder unlesbares JSON, wird mit erhaltenem Status und erhaltenen
  Cookies auf den neutralen JSON-Rumpf `null` versiegelt.
- Passe Kommentare und gezielte Einheitentests an. Ergänze einen Test mit
  einem Objekt ohne `user`, das absichtlich ein top-level `sid` enthält; der
  Wert darf den Browser nicht erreichen.

Führe TypeScript, ESLint und die Einheitentests aus. Keine anderen fachlichen
oder sichtbaren Änderungen. Nicht committen, nicht pushen, nicht mergen, keinen
Tag setzen. Berichte exakte Ergebnisse nach `CLAUDE.md`.
