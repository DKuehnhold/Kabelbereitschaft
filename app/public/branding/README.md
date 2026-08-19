# Branding / Firmenlogo

Die Anwendung lädt das Logo aus dieser Datei:

- `public/branding/logo.svg`

## Aktueller Stand (AUFTRAG_12)

Es ist das echte Firmenlogo hinterlegt (`WuS_DE_Logo_Gruppe_schw.svg`, schwarze
Wortmarke der W&S-Gruppe), **kein Platzhalter mehr**. Seitenverhältnis
hochkant/quadratisch (`viewBox="0 0 176.21 132.25"`). Die einbindende
Komponente `src/components/Logo.tsx` gibt je Aufrufer eine feste Höhe vor,
die Breite ergibt sich automatisch (`width: auto`) — keine Verzerrung. Im
Dark Mode wird das schwarze Logo über `dark:invert` sichtbar gehalten (siehe
Kommentar in `Logo.tsx`).

Sichtbar auf: Loginseite, Seite „Passwort ändern", Topbar (`AppShell.tsx`).

## Logo austauschen

1. Firmenlogo als **SVG** (bevorzugt) oder **transparentes PNG** bereitstellen.
2. Datei hier ablegen und exakt `logo.svg` benennen (bei PNG: zusätzlich Komponente `src/components/Logo.tsx` auf `logo.png` umstellen).
3. Bei stark abweichendem Seitenverhältnis: Höhenwerte je Aufrufer in `LoginForm.tsx`,
   `PasswordChangeForm.tsx` und `AppShell.tsx` prüfen/anpassen.
4. Kein Fantasie-/Ersatzlogo verwenden – nur das offizielle Firmenlogo.
