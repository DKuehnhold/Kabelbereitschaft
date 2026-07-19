# Releaseprozess (AP7)
> Stand: 2026-07-19 · Reproduzierbarer Ablauf. Offene Zuständigkeiten sind als offen markiert.

## Ablauf
1. Release Candidate erstellen (Branch/Commit fixieren).
2. CI vollständig grün (Lint, TypeScript, Build, Audit-Gate, DB-Tests, @public-E2E; @app-E2E mit Test-Supabase).
3. Migrationen prüfen (Reihenfolge, Idempotenz, Rollback-Fähigkeit – siehe DEPLOYMENT.md).
4. Testumgebung aktualisieren (Migrationen + Deploy).
5. Fachliche Abnahme (Auftraggeber – Zuständigkeit offen).
6. Technische Abnahme (Team – Zuständigkeit offen).
7. Security-Abnahme (Gate 3 – siehe RELEASE_CHECKLISTE.md).
8. Backup prüfen (aktuelles DB-/Storage-Backup vorhanden).
9. Release-Notizen erstellen (RELEASE_NOTES_*.md).
10. Version taggen — **nur nach ausdrücklicher Nutzerfreigabe** (Semantic Versioning; erster RC: `v1.0.0-rc.1`).
11. Produktion aktualisieren (Deploy + Migrationen).
12. Smoke-Test Produktion (Login, Vorgang, Bild, Offline, `/api/health`).
13. Monitoring prüfen (Fehlerraten, Verfügbarkeit).
14. Rollback-Bereitschaft bestätigen (siehe DEPLOYMENT.md).

## Versionierung
Semantic Versioning. Tags nur, wenn alle verbindlichen Gates bestanden sind, der Commit gepusht ist
und der Nutzer die Freigabe erteilt hat. **Kein Tag/Release ohne Nutzerfreigabe.**
