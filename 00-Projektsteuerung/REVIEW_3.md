# REVIEW 3 zu AUFTRAG_3 / MELDUNG_3: **grün — mit einem offenen lokalen Nachweis (Build)**

> Stand: 2026-08-16. Verfasst von Claude (Rolle Orchestrator/Review, Cowork-Chat 1).
> Grundlage: eigener Diff-Abgleich und eigene Messläufe.

## Eigene Messläufe (Review-Sandbox)

- `node --test test/*.test.mjs`: **115 Einträge, 115 pass, 0 fail, kein roter Eintrag** —
  bestätigt inkl. des vom Worker erklärten Effekts, dass die `ap14b-auth`-Altlast durch das
  nachgezogene native argon2-Binding verschwunden ist. Die frühere „bekannte Altlast" ist damit
  KEINE mehr; künftige Baselines: 115/115.
- `npm audit --audit-level=high --omit=dev`: **0 Schwachstellen, Exit 0.**
- `npm run build`: in der Review-Sandbox mit **exakt demselben `EPERM`/`.fuse_hidden`-Fehler**
  gescheitert wie beim Worker — das bestätigt die Diagnose Mount-Eigenheit (OneDrive/FUSE),
  kein Code-Defekt. **Offener Nachweis:** Dennis führt lokal einmal `npm run build` in `app/`
  aus; Erwartung Exit 0. Bis dahin gilt diese Scheibe als freigegeben unter diesem einen
  Vorbehalt.
- Stichprobe Token-Anbindung: bestehende AP8-Tokens (`--brand`, `--surface*`, `--danger`,
  `--muted`) unverändert vorhanden; shadcn-Mapping additiv, `--muted`-Sonderfall als Kommentar
  direkt im CSS dokumentiert (Zeilen 43 ff.).

## Bewertung

- Scope eingehalten; `toggle.tsx` als zwingende shadcn-Abhängigkeit von `toggle-group`
  nachvollziehbar begründet — akzeptiert.
- `radix-ui` als gebündeltes Meta-Paket (CLI-Standard) akzeptiert; Lockfile-Wachstum
  (+1634 Zeilen) zur Kenntnis genommen, `npm audit` sauber.
- Der dokumentierte `bg-muted`-Kompromiss in `toggle.tsx` ist unkritisch (Code unbenutzt) und
  wird spätestens mit der ersten sichtbaren GUI-Scheibe aufgelöst — dann als bewusste
  Gestaltungsentscheidung.
- Vorbildliche Offenlegung nicht verifizierbarer DoD-Punkte statt stiller Behauptung.

## Ergebnis

**Grün** (Vorbehalt: ein lokaler `npm run build`-Nachweis durch Dennis). Kein Commit, kein
Push. Nächste Arbeitsscheibe: AUFTRAG_4 folgt nach der Anforderungsaufnahme aus der
Bereitschafts-Excel (siehe `01-Anforderungen/ANFORDERUNG_DISPO_METADATEN.md`) — voraussichtlich
die Erfassungsmaske nach Variante A.

## Nachtrag 2026-08-16 (Vorbehalt aufgelöst): Build lokal grün

Dennis hat den Produktions-Build lokal ausgeführt (`node .\node_modules\next\dist\bin\next
build`, da `npm run build` am `&` im OneDrive-Pfad scheitert — bekanntes Windows-Problem,
gleiche Ursache wie die frühere Typecheck-/Lint-Umstellung): **Next.js 16.2.12, „Compiled
successfully in 36.8s", TypeScript 21.2s, 8/8 statische Seiten, vollständige Routentabelle
inkl. `ƒ /vorgaenge/neu`, aller `stammdaten/*`-Seiten und `ƒ Proxy (Middleware)`.** Das
Branding aus AUFTRAG_4 war dabei bereits im Baum. REVIEW_3 und REVIEW_4 sind damit ohne
Vorbehalt grün. Beobachtung, nicht blockierend: zwei Warnzeilen „Couldn't load fs / zlib"
während „Collecting page data"/„Generating static pages" — Build dennoch erfolgreich;
bei Gelegenheit einordnen. Folgeempfehlung (kleine Scheibe): `build`-Skript in
`app/package.json` wie Typecheck/Lint auf den direkten node-Aufruf umstellen, damit
`npm run build` bei Dennis wieder funktioniert.
