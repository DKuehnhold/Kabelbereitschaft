# MELDUNG 1 vom Worker-Chat zu AUFTRAG_1

> Stand: 2026-08-16. Verfasst von Claude (Rolle Worker, Cowork-Chat 2), Antwort auf
> `00-Projektsteuerung/AUFTRAG_1.md`. Schriftliche Notiz, kein Chat-Kanal.

## Geänderte Datei

Ausschließlich `app/test/ap15b-incident-list-url.test.mjs` (die einzige Datei der
Positivliste). Keine andere Datei wurde angefasst.

## Diff-Kurzbeschreibung

Nach dem Vorbild `app/test/ap15-incident-metrics.test.mjs` (Zeilen ~96–117) ergänzt:

- `registerHooks()` aus `node:module` mit einem generischen `resolve`-Hook, der jeden
  `@/…`-Spezifizierer über `resolveFile()` auf die passende Datei unter `../src/`
  abbildet (TS/TSX/`index.ts`-Auflösung wie im Vorbild).
- **Keine Ersatzmodule/Stubs** ergänzt — geprüft und bestätigt: `src/lib/status.ts` und
  `src/lib/priority.ts` haben keine eigenen Importe; `src/lib/incident-list.ts`
  importiert `@/lib/status`, `@/lib/priority` und `@/lib/database.types`
  ausschließlich als `import type` (zur Laufzeit von Node entfernt). Damit genügt der
  generische `@/`-Zweig; `server-only` und `@/lib/db` werden hier nicht transitiv
  geladen und brauchten daher keinen Ersatz.
- Kopfkommentar um Lauf-Hinweis und Begründung „eigene Datei wegen prozessweiter
  `registerHooks()`-Wirkung" ergänzt (gleiche Begründung wie im Vorbild und in
  `ap14b-session-guard.test.mjs:11-12`).
- Die drei bestehenden Testfälle (`test(...)`-Blöcke) sind inhaltlich unverändert
  geblieben, nur der Import von `buildIncidentListQueryString`/`parseIncidentListQuery`
  wurde von einem statischen Top-Level-Import auf einen `await import(...)` **nach**
  der Hook-Registrierung umgestellt (zwingend, damit der Hook beim Laden bereits aktiv
  ist — wie im Vorbild).

## Prüfergebnisse (tatsächlich erhoben, in dieser Sandbox, kein Netz, kein Postgres)

**Einzeltest** `node --test test/ap15b-incident-list-url.test.mjs` (aus `app/` heraus):
Exit **0**. `# tests 3`, `# pass 3`, `# fail 0`. Alle drei bestehenden Fälle bestehen
unverändert.

**Gesamtlauf** `node --test test/*.test.mjs` (aus `app/` heraus): Exit **1** (wegen des
bekannten, unabhängigen `ap14b-auth.test.mjs`). Ergebnis: `# tests 64`, `# pass 63`,
`# fail 1`. Der einzige rote Eintrag ist `not ok 1 - test/ap14b-auth.test.mjs`, Ursache
`Failed to load native binding` / `Cannot find module './argon2.linux-x64-gnu.node'`
(`@node-rs/argon2`) — genau die bekannte, umgebungsbedingte Altlast aus dem Auftrag,
nicht AP15-b-bezogen.

**Abweichung von der Zahlenerwartung im Auftrag, offen gelegt statt stillschweigend
gerundet:** Der Auftrag nennt als Zielgröße „62 Top-Level-Einträge, 61 pass" bzw. als
Baseline „62 Einträge, 60 pass, 2 fail". Tatsächlich erhoben sind es **64 Einträge**
(vorher wären es vermutlich 62 gewesen). Grund: `node --test` zählt eine Testdatei, die
beim Laden bereits scheitert (wie `ap15b-incident-list-url.test.mjs` vor dieser
Korrektur, ERR_MODULE_NOT_FOUND beim Import), als **einen** Top-Level-Eintrag
(„not ok 1 - <Dateiname>"). Nach der Korrektur lädt die Datei fehlerfrei, und ihre
**drei** einzelnen `test(...)`-Fälle erscheinen jeweils als eigener Top-Level-Eintrag
statt als ein einziger Datei-Eintrag. Netto: ein roter Datei-Eintrag verschwindet, drei
grüne Fall-Einträge kommen hinzu → 62 − 1 + 3 = 64, davon 63 grün. Ich habe das nicht
nachträglich auf „62" zurechtgerechnet, weil das eine erfundene Zahl gewesen wäre.

Qualitativ ist das DoD damit erfüllt: der Zieltest läuft vollständig grün
(3 von 3 Fällen), und der **einzige verbleibende rote Eintrag im Gesamtlauf ist
weiterhin ausschließlich die bekannte `ap14b-auth`-Altlast** — kein neuer, kein
anderer Fehlschlag ist aufgetreten.

- TypeScript/ESLint/Build wurden in diesem Auftrag nicht angefasst und nicht erneut
  geprüft (Positivliste beschränkt den Auftrag auf die eine Testdatei; keine
  Produktivcodeänderung, die eine erneute Statik-Prüfung nötig gemacht hätte).

## Git-Status zum eigenen Änderungsumfang

```
?? app/test/ap15b-incident-list-url.test.mjs
```

Alle übrigen in `git status --porcelain` sichtbaren Änderungen (zahlreiche `M`-Einträge
sowie weitere `??`-Einträge unter `.claude/`, `00-Projektsteuerung/`, `07-Betrieb/` und
`app/`) waren bereits **vor** Beginn dieses Auftrags im Arbeitsbaum vorhanden (Stand des
uncommitteten AP15-b-Arbeitsbaums) und stammen nicht aus dieser Meldung.

## Commit/Push

**Kein Commit, kein Push, kein Merge, kein Tag, keine Orchestrierung.** Der Arbeitsbaum
bleibt uncommitted zur Prüfung durch den Orchestrator/Review-Chat.
