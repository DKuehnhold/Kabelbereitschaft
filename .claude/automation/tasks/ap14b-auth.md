Du bist der Programmierer der Kabelbereitschaft-App.

Lies zuerst vollständig `AGENTS.md`, `CLAUDE.md`, `PROJEKT_WISSEN.md`,
`PROJEKTSTATUS.md`, `00-Projektsteuerung/ROADMAP_AP12_AP15_ENTWURF.md` und
`00-Projektsteuerung/ADR-011-postgres-eigenplattform.md`. Arbeite ausschließlich
im bestehenden Vault.

## Auftrag: AP14/B Auth-Basis

Prüfe den aktuellen Git-Diff einschließlich der bereits uncommittierten Entwürfe:

- `app/src/lib/db/index.ts`
- `app/src/lib/auth-service.ts`
- `app/src/auth.ts`
- `app/src/types/next-auth.d.ts`
- `app/src/app/api/auth/[...nextauth]/route.ts`

Übernimm diese Entwürfe nicht blind. Korrigiere Architektur-, Typ-, Sicherheits-
und Laufzeitfehler. Implementiere anschließend vollständig die nicht-visuelle
Auth.js-v5-Credentials-Basis gegen PostgreSQL:

- parametrisierte Datenbanktransaktionen mit transaktionslokaler Benutzer-ID;
- Argon2id-Passwortprüfung;
- serverseitig widerrufbare `auth_sessions`;
- kurze verschlüsselte JWTs ausschließlich mit `sub` und `sid`;
- aktive Profil-, Konto- und Sitzungskontrolle bei jedem geschützten Request;
- Login-Action und Logout mit serverseitigem Sitzungswiderruf;
- Auth.js-Route;
- Next-16-`proxy.ts` statt der Supabase-Middleware.

Entferne in diesem Arbeitspaket nur die dadurch ersetzten Supabase-Auth-Zugriffe.
Andere Datenmodule werden in späteren Aufträgen migriert. Keine
GUI-Neugestaltung und keine sichtbare Designentscheidung.

Keine echten IT-Daten und keine Secrets. Ergänze gezielte Tests, soweit lokal
möglich. Führe TypeScript, ESLint und den Produktions-Build aus und behebe alle
gefundenen Fehler. Nutze ausschließlich lokale synthetische Testwerte. Keine
Projektkopie oder Ersatzablage.

Nicht committen, nicht pushen, nicht mergen und keinen Tag setzen. Beende den
Lauf mit dem in `CLAUDE.md` festgelegten Bericht einschließlich exakter
Prüfergebnisse und Git-Status.
