# REVIEW 10 zu AUFTRAG_10 / MELDUNG_10 (Bereitschaftsplan, Migration 0021): **grün**

> Stand: 2026-08-17. Verfasst von Claude (Orchestrator/Review, Chat 1). Ausführung durch
> Sonnet-Agenten unter Chat-1-Orchestrierung.

## Vorbemerkung zum Ablauf (transparent)

Der erste Ausführungslauf brach mit einem API-Verbindungsfehler ab, **nachdem** er die
Dateien geschrieben hatte; die OneDrive-Synchronisation zeigte sie der Review-Sandbox
verzögert (Prüfung unmittelbar nach dem Abbruch sah nur 0018–0020, Datei 0021 trägt
Zeitstempel 14:29). Der zweite Lauf hat den vorgefundenen Stand vollständig gegen den
Auftrag geprüft und eine Regression behoben (siehe unten). Lehre für künftige Läufe: nach
einem Agentenabbruch nicht nur einmal, sondern nach kurzer Wartezeit erneut auf
Teilergebnisse prüfen, bevor neu gestartet wird.

## Eigene Prüfung

- **Migration 0021 gegengelesen:** Identitätsquelle korrekt `app.current_user_id()`;
  `unique (construction_stage_id, plan_date, technician_id)` vorhanden (mehrere Personen je
  BA/Tag zulässig, wie in der Excel); FKs auf `construction_stages`/`technicians` ohne
  `on delete cascade`; RLS mit drei Policies — select für Angemeldete, insert/delete für
  `public.is_staff()`, **kein** update-Pfad (fachlich korrekt: Zuweisung wird entfernt,
  nicht geändert); Grants ausschließlich `app_user` mit `select, insert, delete` — die
  delete-Ausnahme ist im Auftrag begründet und hier konsistent umgesetzt; 12 fail-closed
  Prüfblöcke.
- **Actions:** Staff-Allowlist exakt nach `STAFF_ALLOWED_ROLES`-Muster (admin/disponent),
  23505-Duplikat → freundliche Fachmeldung, keine Datenbankmeldung nach außen.
- **Selbst gemessen:** `node --test test/*.test.mjs` **162/162, 0 fail** (Baseline 143 + 19).
- **Regression korrekt behoben:** der AUFTRAG_7-Wächtertest prüfte den CI-Schrittnamen
  wörtlich („0001-0020, Smokes 15-27") und wurde auf den neuen Wortlaut („0001-0021,
  Smokes 15-28") nachgezogen — sauber gemeldet statt stillschweigend. Merkposten: solche
  wörtlichen Wächter auf CI-Texte erzeugen bei jeder Migration Folgearbeit; bei der nächsten
  Gelegenheit auf eine tolerantere Prüfung umstellen (eigene kleine Scheibe, kein Blocker).

## Auflage

**DB-Nachweis 0021 + Smoke 28 steht aus** → CI-Job `database` nach Dennis' nächstem Commit
(Sandbox ohne PostgreSQL). Gleiche offene Auflage wie für 0019/0020 (Commit `c54293b` läuft
bzw. lief bereits — Ergebnis von Dennis noch nicht bestätigt).

## Ergebnis

**Grün** (mit CI-Auflage). Kein Commit, kein Push. Nächste Scheibe: AUFTRAG_11
(Disponentenansicht) — danach Doku-Nachzüge und die beschlossenen Fehlalarm-Umbauten.
