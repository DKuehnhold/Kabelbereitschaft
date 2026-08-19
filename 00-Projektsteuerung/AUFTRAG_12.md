# AUFTRAG 12: Logo einbauen + Marken-Farbe in PWA-Metadaten nachziehen

> Stand: 2026-08-17. Grundlage: `01-Anforderungen/ANFORDERUNG_GUI_RUNDE_2.md` A3 sowie der
> in MELDUNG_11 gemeldete Restbefund (`theme_color` noch blau). Kleine Scheibe.

## Ausgangslage

Dennis hat sein Logo geliefert; es liegt bereits als `app/public/branding/logo.svg` im Vault
(vom Review-Chat kopiert, Original `WuS_DE_Logo_Gruppe_schw.svg`, schwarze Wortmarke der
W&S-Gruppe). **Wichtig:** Das neue SVG hat ein **hochkantes/quadratisches Seitenverhältnis**
(`viewBox="0 0 176.21 132.25"`), der alte Platzhalter war ein Querformat-Banner
(`240 × 48`). Alle Einbaustellen müssen deshalb auf das neue Verhältnis angepasst werden,
sonst wird das Logo verzerrt oder überdimensioniert dargestellt.

## Umfang

1. **Einbaustellen prüfen und anpassen** (per Grep nach `logo.svg` / `branding`): Login-Seite,
   AppShell/Topbar (nach AUFTRAG_11 neu), ggf. weitere. Feste, sinnvolle Höhe je Kontext
   (Topbar z. B. ~28–32 px hoch, Login größer), Breite automatisch (`width: auto`,
   `object-fit: contain`), kein Verzerren. Der Platzhalter-Rahmen (gestrichelte Umrandung)
   und der Text „Logo-Platzhalter · bitte ersetzen" müssen **verschwinden** — falls diese
   Elemente in der einbindenden Komponente liegen (nicht im SVG), dort entfernen.
2. **Dark Mode:** Das Logo ist schwarz. Im Dark Mode muss es sichtbar bleiben — schlichteste
   Lösung wählen und offenlegen (z. B. `dark:invert` bzw. eine token-basierte
   Filter-/Helligkeitsregel; **keine** zweite Logodatei erfinden, kein Umfärben der Marke
   über Recolor-Hacks, die die Wortmarke verfälschen).
3. **PWA-Metadaten:** in `app/src/app/manifest.ts` `theme_color` (und falls vorhanden
   `background_color`) auf das neue Marken-Rot bzw. Schwarz aus dem Token-Satz von
   AUFTRAG_11 setzen — konsistent zu `globals.css`. Wert im Klartext in der Meldung nennen.
4. **E2E nachziehen:** `app/e2e/public.spec.ts` prüft `theme_color === "#1e3a8a"` — Erwartung
   auf den neuen Wert anpassen (Test NICHT abschalten). Auch prüfen, ob dort weitere
   Farb-/Namenserwartungen stehen.

## Positivliste

- `app/src/app/manifest.ts`
- `app/e2e/public.spec.ts` (nur die Farberwartung)
- die Komponenten, die das Logo einbinden (z. B. `app/src/app/login/LoginForm.tsx`,
  `app/src/components/AppShell.tsx`/`AppNav.tsx` — per Grep ermitteln)
- `app/public/branding/README.md` (nur, falls er noch „Platzhalter" behauptet)

## Negativliste

- **`app/public/branding/logo.svg` selbst nicht verändern** (Dennis' Originaldatei bleibt
  unangetastet; keine Farbmanipulation im Dateiinhalt).
- Keine Änderung an Farbtokens (AUFTRAG_11 ist abgeschlossen), keine Nav-Struktur-Änderung,
  keine Routen/Rechte/SQL/Migrationen, kein `.claude/**`, keine Läufer/CI,
  kein PROJEKT_WISSEN/PROJEKTSTATUS/CHAT_STATUS. Kein Commit/Push.

## DoD

- tsc Exit 0. `node --test test/*.test.mjs`: kein roter Eintrag (Baseline 162).
- ESLint und `npm run build` **dürfen** in der Sandbox am Zeitlimit/EPERM scheitern (belegt:
  ESLint läuft über den OneDrive-Mount >175 s, auch ohne Änderungen) — genau so
  dokumentieren, nicht wiederholen; die Prüfung macht Dennis lokal.
- In der Meldung: Liste der Einbaustellen mit gewählter Höhe, Dark-Mode-Lösung, neuer
  `theme_color`-Wert.

## Stopppunkt

Anhalten und BLOCKER melden, wenn: das Logo ohne Änderung der SVG-Datei nicht sauber
platzierbar ist; die Dark-Mode-Darstellung eine echte Designentscheidung erfordert
(z. B. Markenfarbe ändern); oder derselbe Fehler dreimal auftritt.
