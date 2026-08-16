# AP15-b Korrekturauftrag: F1/F2/F5 und fehlende Aufrufer

## Ausgangslage
Die unabhängige PostgreSQL-18-Verifikation `kb-ap15b-postgres-docker-verification-detached-v3` ist technisch grün, das Architektur-Gate aber wegen F1, F2, F5 und F7 nicht bestanden.

## Positivliste
- Lies AGENTS.md, CLAUDE.md, PROJEKT_WISSEN.md und den vollständigen Verifikationsnachweis vor Änderungen.
- Behebe ausschließlich diese AP15-b-Befunde:
  1. Migration 0018 muss auch bei bereits vorhandener nullable/default-loser Spalte idempotent `NOT NULL DEFAULT false` herstellen und bestehende NULL-Werte sicher behandeln.
  2. Der Fehlalarm-Wächter muss INSERT und UPDATE abdecken; die bestehende Fachregel „nur Disponent" bleibt unverändert, sofern keine dokumentierte widersprüchliche Entscheidung vorliegt.
  3. Migration 0018 muss in die bestehende reguläre Migrations-/Smoke-Kette aufgenommen werden, mit reproduzierbarem Regressionstest.
  4. Prüfe die fehlenden Aufrufer von `setIncidentFalseAlarm` und `exportIncidentListFull`. Ergänze nur die kleinste fachlich eindeutige Verdrahtung im vorhandenen AP15-b-UI-/Exportpfad. Wenn eine sichtbare GUI- oder Rollenentscheidung nötig ist, sofort stoppen und als Blocker melden.
- Ergänze gezielte synthetische Tests für F1/F2/F5 und die verdrahteten Aufrufer.
- Verifiziere danach erneut mit PostgreSQL 18 in temporären Docker-Containern, inklusive unabhängiger read-only Validierung.

## Negativliste
- Keine Änderungen an Auth.js-, RLS-, Deployment- oder Storage-Grundarchitektur.
- Keine Änderung der Disponent-only-Fachentscheidung ohne explizite Dokumentationsgrundlage.
- Keine neuen Cloud-Dienste, keine produktiven Daten, keine Ersatzordner.
- Kein Commit, Push, Merge, Tag oder Release durch Agents.
- Keine Reparatur anderer Befunde (F4/F8–F13), außer sie wird für F1/F2/F5 zwingend benötigt; dann stoppen und melden.

## Definition of Done
- Migration ist bei frischem und vorverändertem Schema wiederholbar und stellt `NOT NULL DEFAULT false` korrekt her.
- INSERT mit Fehlalarm wird für unzulässige Rollen mit SQLSTATE 42501 blockiert; Disponent darf setzen; UPDATE bleibt korrekt geschützt.
- 0018 ist in der echten Runner-/Smoke-Kette enthalten und durch einen reproduzierbaren Test abgesichert.
- `setIncidentFalseAlarm` und `exportIncidentListFull` haben einen nachgewiesenen, minimalen Aufrufer oder der Lauf endet mit dokumentiertem fachlichem Blocker.
- Typecheck, Lint, Unit- und PostgreSQL-18-Tests grün; vollständiger Diff unabhängig geprüft.
- Temporäre Container, Volumes und synthetische Artefakte vollständig entfernt; Evidence in result.json/stderr.log.

## Stopppunkt
Bei unklarer Rollen-/UI-Semantik, Abweichung vom Scope, fehlender Docker-/Claude-Erreichbarkeit oder fehlender reproduzierbarer Migration sofort stoppen.

## Evidence je Agent
Jeder Agent nennt geänderte Dateien, Testbefehle, Exitcodes, konkrete SQL-/Rollen-/Exportresultate und Cleanup-Nachweis. Schreibende Teilaufgaben strikt sequenziell; read-only Validierungen unabhängig.
