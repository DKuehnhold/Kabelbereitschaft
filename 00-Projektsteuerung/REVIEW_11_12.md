# REVIEW 11+12 (Farbkonzept Rot/Schwarz, Topbar/Burger, Logo, PWA-Farbe): **grün, mit Vorbehalt lokaler Nachweise**

> Stand: 2026-08-17. Verfasst von Claude (Orchestrator/Review, Chat 1). Zusammengefasstes
> Review zweier aufeinanderfolgender Scheiben (AUFTRAG_11 und der kleinen Folgescheibe
> AUFTRAG_12), weil sie fachlich zusammengehören.

## Selbst geprüft

- Tokens in `globals.css`: `--brand: #7f1d1d` (Rot-900), `--brand-hover: #991b1b`,
  Fehler-Rot bewusst getrennt gehalten (`--danger: #dc2626`) mit Begründung im Quelltext —
  die geforderte Unterscheidbarkeit Marken-Rot vs. Fehler-Rot ist gegeben; Token-Namen
  unverändert, shadcn-Mapping (`--primary: var(--brand)`) intakt.
- `manifest.ts`: `theme_color: #7f1d1d`, `background_color: #f4f4f5` — konsistent zu den
  Tokens; die E2E-Erwartung wurde mitgezogen statt abgeschaltet.
- `Logo.tsx`: eine zentrale Komponente, feste Höhe je Kontext mit `width: auto`
  (kein Verzerren des hochkanten 176×132-SVG), Dark Mode über `dark:invert`; Dennis'
  Originaldatei `logo.svg` unverändert (nur eingebunden).
- `node --test test/*.test.mjs`: **162/162, 0 fail** (selbst gemessen, Baseline gehalten).
- Rollenlogik (`roles.ts`) nicht angefasst — Sichtbarkeit unverändert, nur Darstellung neu.

## Offene Nachweise (Umgebung, nicht Code)

**ESLint und `npm run build` sind in beiden Sandboxes nicht durchführbar:** ESLint läuft über
den OneDrive-/FUSE-Mount reproduzierbar über 175 s (auch auf unveränderten Kontrolldateien,
vom Review-Chat selbst reproduziert), der Build scheitert am bekannten EPERM/.fuse_hidden.
**Beides muss Dennis lokal prüfen** (`npm run lint`, `npm run build` — funktionieren dort seit
AUFTRAG_9 wieder direkt). Erst danach gilt diese Scheibe als vollständig nachgewiesen.

## Merkposten

- `AppHeader.tsx`/`NavLinks.tsx` sind laut MELDUNG_11 nach dem Umbau totes Markup und wurden
  bewusst nicht angefasst. Aufräumen als eigene kleine Scheibe vormerken (kein Blocker).
- Wörtliche Wächtertests auf CI-Schrittnamen erzeugen bei jeder Migration Folgearbeit
  (Befund aus REVIEW_10) — bei Gelegenheit tolerant machen.

## Ergebnis

**Grün** unter dem Vorbehalt der zwei lokalen Prüfläufe. Kein Commit, kein Push.
Nächste Scheibe: AUFTRAG_13 (Stammdaten: Akkordeon, neue Reihenfolge, CSV-Import samt
Vorlagen), danach AUFTRAG_14 (Dispo-Board mit Wochen-/Monatsumschaltung, Qualifikationen,
Drag & Drop, Dispo-Zeile).
