# AP15B/RC1 – nicht-visueller Abschluss der Vorgangsfachpfade

## Ziel

Den bestehenden AP15B-Stand bis zum lokal vollständigen technischen RC1-Gate
prüfen und die verbliebenen nicht-visuellen Fachbefunde minimal abschließen.
Der bestehende Vault ist der einzige Arbeitsort. Verwende für die Ausführung
die kostensparenden Claude-Profile, soweit der Orchestrator dies unterstützt.

## Positivliste

- `app/src/lib/incidents.ts`
- `app/src/lib/incident-actions.ts`
- `app/src/lib/incident-list-actions.ts`
- `app/src/lib/incident-list.ts`
- `app/src/lib/incident-list-url.ts`
- `app/src/lib/date-local.ts`
- `app/src/components/incidents/IncidentControls.tsx`
- `app/src/app/(app)/vorgaenge/[id]/page.tsx`
- `app/src/components/incidents/list/OperationalList.tsx`
- `app/supabase/migrations/0018_ap15b_incident_metrics.sql`
- `app/supabase/test/25_ap15b_incident_metrics.sql`
- `app/test/**` nur für gezielte AP15B-Tests
- `PROJEKT_WISSEN.md` nur zur knappen Wahrheitsaktualisierung

## Arbeitsauftrag

1. Prüfe den vollständigen aktuellen Diff und die bestehende Evidenz.
2. Schließe `setIncidentFalseAlarm` mit der kleinsten vorhandenen
   Funktionsverdrahtung an den bestehenden Detail-Steuerungsbereich für
   Disposition/Administration an. Keine neue visuelle Gestaltung, kein
   Redesign und keine Änderung der Rollenregel: nur `disponent` darf setzen;
   der DB-Wächter bleibt maßgeblich. Der vorhandene Status-/Formularbereich
   darf um genau einen funktionalen, klar beschrifteten Aufruf ergänzt werden.
3. Schließe `exportIncidentListFull` an einen bestehenden staff-geschützten
   Exportpfad an. Die interaktive Grenze `INCIDENT_EXPORT_CAP = 5000` bleibt
   unverändert; der Vollmengenpfad darf nur über die explizite Vollmengenaktion
   erreichbar sein. Keine neue Exportoberfläche und keine Änderung der
   dokumentierten UI-Grenze.
4. Prüfe Datumsherkunft und Tagesgrenze fachlich: Europe/Berlin muss unabhängig
   von der Node-Zeitzone gelten, inklusive DST-Übergängen; date_from/date_to
   müssen lokal inklusiv und ohne Tagesverschiebung sein.
5. Prüfe alle drei betroffenen Transaktions-/Filterpfade auf vollständige,
   parametrisierte Filter: Liste, interaktiver Export und Vollmengen-Export.
   `falseAlarm` muss typgeprüft bzw. fail-closed werden; keine ungeprüfte
   Eingabe darf in SQL gelangen.
6. Prüfe Vollmengen-Reads auf harte Obergrenze, Staff-Berechtigung, Sortierung,
   RLS/security_invoker und explizite Fehlerbehandlung.
7. Ergänze nur gezielte synthetische Regressionstests für tatsächlich
   gefundene Lücken. Führe Typecheck, Lint, Unit und PostgreSQL-18-Kette mit
   allen sechs Integrationssuiten aus; Cleanup vollständig nachweisen.

## Negativliste

- Keine neuen GUI-/Designentscheidungen, kein Redesign, keine Änderungen an
  `04-UI-UX/LISTENKONZEPT.md`.
- Keine Änderungen an Auth.js-, RLS-, Deployment-, Storage- oder
  Migrationsgrundarchitektur; Migration 0018 nur bei zwingender Regression.
- Keine Änderung der Disponent-only-Regel und keine Admin-Ausnahme im SQL.
- Keine Erweiterung der bestehenden interaktiven Exportgrenze.
- Keine Cloud-Dienste, Produktivdaten, Ersatzordner oder Clones.
- Kein Commit, Push, Merge, Tag oder Release.
- Keine Reparatur von F4/F8–F13, außer ein Befund ist unmittelbar für die oben
  genannten AP15B-Gates erforderlich; dann stoppen und melden.

## Definition of Done

- Beide Funktionen besitzen einen minimalen, nachgewiesenen Produktivaufrufer
  oder ein reproduzierbarer, begründeter Blocker wird dokumentiert.
- Datumslogik und Tagesgrenzen sind mit mindestens einem DST-/Zeitzonenfall
  belegt.
- Liste, Export und Vollmengen-Export verwenden dieselben geprüften Filter;
  `falseAlarm` ist fail-closed und vollständig parametrisiert.
- Vollmengen-Export bleibt hart begrenzt und staff-geschützt.
- Typecheck, Lint, Unit, PostgreSQL-18-Smokes und sechs Integrationssuiten
  sind grün; Exitcodes und Fallzahlen werden konkret berichtet.
- Vollständiger Diff, `state.json`, laufbezogenes `resultFile`/`errorFile` und
  Cleanup sind unabhängig nachvollziehbar.

## Stopppunkt

Bei einer neuen sichtbaren GUI-/Designentscheidung, Rollenwiderspruch,
Migrationserfordernis außerhalb 0018, fehlendem Docker/Claude-Zugriff,
wiederholtem identischem Fehler oder Scope-Erweiterung sofort stoppen und den
Rohbefund melden.

## Evidence je Agent

Geänderte Dateien, exakte Befehle, Exitcodes, Test-/SQL-Fallzahlen,
Rollenresultate, Cleanup und verbleibende Risiken müssen in der Übergabe
stehen. Kein Nachweis darf erfunden oder aus einem Alt-Lauf übernommen werden.
