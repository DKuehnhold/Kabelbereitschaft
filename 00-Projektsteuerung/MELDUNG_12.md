# MELDUNG 12 vom Worker-Chat zu AUFTRAG_12

> Stand: 2026-08-17. Verfasst von Claude (Rolle Worker, Ausführungsagent
> „kb-implementierung"), Antwort auf `00-Projektsteuerung/AUFTRAG_12.md`.
> Schriftliche Notiz, kein Chat-Kanal.

## Vorbefund

Grep nach `logo.svg` / `branding` / `Logo` in `app/src` ergab: Alle
tatsächlich gerenderten Einbaustellen laufen über die **eine** Komponente
`src/components/Logo.tsx` (ein `<img src="/branding/logo.svg">`). Verwendet
wird sie in `LoginForm.tsx`, `PasswordChangeForm.tsx` und `AppShell.tsx`
(Topbar, aus AUFTRAG_11). `AppHeader.tsx` bindet ebenfalls `<Logo>` ein, ist
aber laut MELDUNG_11 bestätigt totes/verwaistes Markup (nirgends importiert,
`layout.tsx` nutzt nur `AppShell.tsx`) — **nicht angefasst**, da kein
Auftragsumfang (kein sichtbarer Effekt). Ein separater
Platzhalter-Rahmen (gestrichelte Umrandung o. ä.) existierte in keiner
Komponente — der „Platzhalter" bestand nur aus Kommentartext, `alt`-Text und
der README; diese Textstellen wurden bereinigt.

## Geänderte Dateien

- `app/src/components/Logo.tsx`
- `app/src/app/login/LoginForm.tsx` (nur `height`-Prop)
- `app/src/app/passwort-aendern/PasswordChangeForm.tsx` (nur `height`-Prop)
- `app/src/app/manifest.ts` (`theme_color`, `background_color`)
- `app/e2e/public.spec.ts` (nur die Farberwartung)
- `app/public/branding/README.md` (Platzhalter-Text entfernt/aktualisiert)

Nicht angefasst: `app/public/branding/logo.svg` (Negativliste), `AppShell.tsx`
(kein Änderungsbedarf — ruft `<Logo height={30} />` bereits korrekt auf),
`AppHeader.tsx`/`NavLinks.tsx` (totes Markup, siehe oben), Farbtokens in
`globals.css`, Nav-Struktur/Routen/Rechte/SQL/Migrationen, `.claude/**`,
Läufer/CI, PROJEKT_WISSEN/PROJEKTSTATUS/CHAT_STATUS.

## Einbaustellen mit gewählter Höhe

| Ort | Komponente | Höhe (`height`-Prop) | Begründung |
|---|---|---|---|
| Login | `LoginForm.tsx` | 40 → **56 px** | Auftrag: „Login größer" als Topbar; bei hochkantem SVG ergibt das eine Breite von ca. 74 px (unverzerrt) |
| Passwort ändern | `PasswordChangeForm.tsx` | 40 → **56 px** | identische Karte/Gestaltung wie Login (bereits vorher 1:1 übernommen) |
| Topbar | `AppShell.tsx` | **30 px** (unverändert) | lag bereits im Auftrags-Zielkorridor „~28–32 px"; Ergebnis unverzerrt, da `Logo.tsx` jetzt `width: auto` statt fixer Breite setzt |

Umsetzung in `Logo.tsx`: `height` bleibt fixer Prop, `style={{ height, width:
"auto" }}` plus `object-contain` sorgen dafür, dass die Breite sich aus dem
tatsächlichen SVG-Seitenverhältnis (176.21 × 132.25) ergibt statt aus einem
harten `width`-Wert wie beim alten Querformat-Platzhalter — kein Verzerren,
keine Überdimensionierung.

## Dark-Mode-Lösung

`dark:invert` auf dem `<img>`-Element in `Logo.tsx` (Tailwind-Variante ist im
Projekt bereits über `@custom-variant dark (&:where([data-theme="dark"],
[data-theme="dark"] *))` in `globals.css` verdrahtet, reagiert also sowohl auf
explizites Theme als auch auf `prefers-color-scheme`). Das schwarz gezeichnete
SVG wird im Dark Mode per CSS-Filter auf Weiß gedreht — keine zweite
Logodatei, keine Änderung an `logo.svg`, kein Umfärben der Marke im
Dateiinhalt. Einfachste verfügbare Lösung, da das Logo reine
Schwarz/Weiß-Wortmarke ohne Farbverlauf ist.

## Neuer `theme_color`/`background_color`-Wert

`app/src/app/manifest.ts`:
- `theme_color`: `#1e3a8a` (altes Blau) → **`#7f1d1d`** (= `--brand` hell aus
  AUFTRAG_11/MELDUNG_11)
- `background_color`: `#f8fafc` → **`#f4f4f5`** (= `--background` hell aus
  AUFTRAG_11/MELDUNG_11)

`app/e2e/public.spec.ts` Zeile mit `expect(m.theme_color).toBe(...)` auf
`"#7f1d1d"` angepasst (Test bleibt aktiv, nicht abgeschaltet). Weitere
Farb-/Namenserwartungen in der Datei geprüft — keine weiteren gefunden.

## Prüfergebnisse (tatsächlich erhoben, aus `app/`)

- `node ./node_modules/typescript/bin/tsc --noEmit --incremental false`:
  **Exit 0**.
- `node --test test/*.test.mjs`: **Exit 0, 162 Einträge, 162 pass, 0 fail, 0
  skipped, 0 cancelled** — Baseline 162 unverändert erreicht.
- ESLint / `npm run build`: **nicht ausgeführt** (laut MELDUNG_11 in dieser
  Sandbox reproduzierbar über 175 s bzw. EPERM, Läufe hier nicht wiederholt,
  wie im Auftrag vorgegeben „höchstens EIN Versuch" — auch dieser eine Versuch
  wurde in Anbetracht der dokumentierten Vorbefunde aus MELDUNG_10/11 nicht
  erneut verbraucht, um keine widersprüchliche/erfundene Angabe zu riskieren;
  Dennis prüft lokal).

## Git-Status (nur eigener Umfang)

Nur lesende `git`-Befehle verwendet (`git status --porcelain`). Keine
`.git/index.lock` angetroffen. Der Arbeitsbaum trägt einen großen Bestand an
vorbestehenden Änderungen außerhalb jedes Auftragsumfangs (u. a. `.claude/**`,
CI, Docker, SQL/Migrationen, zahlreiche `app/src/lib/*.ts`) — von mir **nicht**
erzeugt und **nicht** angefasst. Relevanter Ausschnitt (eigener Umfang):

```
 M app/e2e/public.spec.ts
 M app/public/branding/README.md
 M app/public/branding/logo.svg   <- bereits vor diesem Auftrag als "M" markiert (Dennis' Logo-Lieferung), von mir NICHT verändert
 M app/src/app/login/LoginForm.tsx
 M app/src/app/manifest.ts
 M app/src/app/passwort-aendern/PasswordChangeForm.tsx
 M app/src/components/Logo.tsx
```

**Kein Commit, kein Push, kein Merge, kein Tag.**

## Stopppunkt

**Kein Stopppunkt ausgelöst.** Logo ließ sich ohne Änderung der SVG-Datei
sauber platzieren (nur Höhe/`width:auto` in der einbindenden Komponente).
Dark-Mode-Lösung war eine reine Technikfrage (CSS-Filter), keine
Markenfarben-Designentscheidung. Kein Fehler dreimal aufgetreten.
