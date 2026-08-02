# Architekturauftrag: AP14B administrative Benutzerverwaltung - Backend

## Ziel

Implementiere ausschliesslich die nicht-visuelle, serverseitige Grundlage der administrativen
Benutzerverwaltung nach ADR-011: administrativer Passwort-Reset mit temporaerem Passwort und
`must_change_password = true`, Deaktivierung/Reaktivierung und Rollenwechsel. Jede Operation ist
admin-only, transaktional, widerruft alle offenen Sitzungen des Zielkontos und erzeugt
aussagekraeftige Auditnachweise ohne Passwort, Hash, Token oder sonstige Geheimnisse.

Ausgangsbranch ist `feat/ap14b-admin-user-management` auf dem Dokumentationsstand `880975a`.
Die ungetrackte Datei `07-Betrieb/IT_ANFRAGE_INFRASTRUKTUR.md` stammt nicht aus diesem Auftrag und
muss vollstaendig unangetastet und ausserhalb jedes Diffs bleiben.

## Verbindliche Architekturgrenzen

- Zielplattform: PostgreSQL 18, Auth.js v5, Argon2id, serverseitiger Sitzungswiderruf.
- Rollen ausschliesslich `admin`, `disponent`, `monteur`; keine Rolle `kunde`.
- Autorisierung fail-closed aus der Datenbank, niemals aus Clientparametern oder JWT-Rollenclaims.
- Admin-Operation und Sitzungswiderruf muessen in derselben Datenbanktransaktion liegen. Bei jedem
  Fehler vollstaendiger Rollback, einschliesslich Audit und Widerruf.
- Passwort-Reset: Hash mit der zentralen bestehenden Passwortfunktion; Klartext nur als
  Eingabeparameter im Speicher, niemals Rueckgabe, Log, Audit, SQL-Notice, Fehlermeldung,
  Dokumentation oder Test-Snapshot. Danach `must_change_password = true`.
- Deaktivierung muss Anmeldung und bestehende Sitzungen wirksam sperren. Reaktivierung darf keine
  alte Sitzung wieder gueltig machen.
- Rollenwechsel und Deaktivierung/Reaktivierung muessen den Zielzustand eindeutig auditieren;
  administrativer Reset muss als Reset durch Administrator von einer normalen Passwortaenderung
  unterscheidbar sein. Bestehende generische Audits duerfen nicht zu widerspruechlichen oder
  geheimnishaltigen Doppelereignissen fuehren.
- Selbstsperre des letzten aktiven Administrators und Herabstufung des letzten aktiven
  Administrators sind fail-closed zu verhindern. Gleichzeitige Admin-Aenderungen muessen gegen
  Race Conditions abgesichert sein.
- Wiederholte identische Status-/Rollenoperationen sollen idempotent sein und keine falschen
  neuen Audit- oder Widerrufsereignisse erzeugen. Ein Passwort-Reset ist immer eine echte
  Aenderung.
- Kein oeffentliches Passwort-vergessen-Verfahren, kein SMTP, kein externer IdP, keine
  Kontoanlage und keine produktiven Zugangsdaten.

## Positivliste

Claude legt fuer seine Agents engere Positivlisten fest. Im Gesamtauftrag duerfen nur folgende
Bereiche geaendert oder neu angelegt werden, soweit technisch erforderlich:

- genau eine additive Migration `app/supabase/migrations/0017_ap14b_admin_user_management.sql`;
- passende PostgreSQL-Smokes unter `app/supabase/test/` und die bestehenden lokalen/CI-Runner nur
  fuer die Aufnahme dieser neuen Migration und Smokes;
- server-only Module unter `app/src/lib/` fuer die administrative Kontoverwaltung; bestehende
  Auth-/DB-Helfer nur bei nachgewiesener Notwendigkeit;
- Unit- und Integrationstests unter `app/test/` samt eng notwendigen Test-Hooks/Stubs;
- `.claude/automation/status/fortschritt.json` nach bestehendem Schema (gitignoriert).

## Negativliste

- Keine Aenderung an `app/src/app/(app)/benutzer/page.tsx`, Komponenten, CSS, Layout, Navigation,
  Texten oder anderer sichtbarer GUI. Die GUI folgt mit Dennis.
- Keine API-Route und keine allgemein erreichbare HTTP-Schnittstelle, sofern nicht zwingend durch
  die bestehende Architektur vorgegeben; in diesem Fall stoppen und begruenden.
- Keine Dokumentationsfortschreibung in `PROJEKT_WISSEN.md`, `PROJEKTSTATUS.md` oder Roadmap in
  diesem Implementierungslauf; sie folgt erst nach unabhaengiger Freigabe.
- Keine Aenderung historischer Migrationen `0001` bis `0016`.
- Keine Supabase-Abhaengigkeit, kein fremder Cloud-Dienst, kein Infrastruktur- oder Deployment-
  Umbau.
- Keine Kontoanlage, kein Mailversand, kein Passwortgenerator, kein Anzeigen oder Zurueckgeben
  temporaerer Passwoerter.
- Keine Bearbeitung, Aufnahme oder Loeschung von `07-Betrieb/IT_ANFRAGE_INFRASTRUKTUR.md`.
- Kein Commit, Push, Merge, Tag, Release oder Branchwechsel durch Claude oder Agents.

## Erforderliche Nachweise

Claude muss reale Exit-Codes und Rohmengen liefern:

1. Vollstaendiger PostgreSQL-18-Lauf mit Migrationen `0001` bis `0017`, allen bestehenden Smokes
   und neuen Positiv-/Negativfaellen.
2. Integrationstests fuer Admin/Disponent/Monteur, unbekannte und deaktivierte Zielkonten,
   Rollenvalidierung, Reset, Reaktivierung, Sitzungswiderruf, Auditinhalt, Idempotenz, Rollback und
   Schutz des letzten aktiven Administrators.
3. TypeScript, projektlokales ESLint, alle Unit-Tests und Produktions-Build.
4. Geheimnissuche im Gesamt-Diff und pruefbarer Nachweis, dass Testpasswoerter nicht in Audit,
   Logs oder Rueckgaben erscheinen.
5. `git diff --check`, vollstaendiger Gesamt-Diff und Scope-Abgleich gegen diese Positivliste.
6. Nach Testende: temporaere PostgreSQL-Cluster, Datenbanken, Prozesse, Ports und Protokolle
   vollstaendig entfernt.

## Definition of Done

- Die drei administrativen Operationen sind serverseitig implementiert und ohne GUI nutzbar.
- Ausschliesslich aktive Administratoren duerfen fremde Konten verwalten.
- Jede echte Aenderung widerruft alle offenen Zielsitzungen in derselben Transaktion und erzeugt
  eindeutige, geheimnisfreie Audits mit handelndem und betroffenem Konto.
- Letzter aktiver Administrator, Rollenmenge, Inaktivitaet und technische Fehler sind fail-closed.
- Alle geforderten Nachweise sind gruen und reproduzierbar; keine temporaeren Artefakte bleiben.

## Stopppunkt

Nach Implementierung und eigener Orchestratorpruefung an Codex uebergeben: `state.json` mit
laufbezogenem `resultFile`/`errorFile`, geaenderte Dateien, vollstaendiger Diff, exakte
Pruefergebnisse und Git-Status. Bei notwendiger GUI-/Designentscheidung, Scope-Erweiterung,
fehlendem IT-Zugang, Sicherheitskonflikt oder dreimal gleichem Fehler sofort stoppen. Nichts
committen oder pushen.
