# Branding

> Stand: 2026-07-19 · MVP V0.1 · Teil von Arbeitspaket 1

Das Firmenlogo wird an allen zentralen Sichtpunkten der App eingebunden. Es wird keine eigene Produktmarke erfunden.

## Platzierung

| Ort | Verwendung |
| --- | --- |
| Loginseite | Logo prominent über dem Anmeldeformular |
| Desktop-Header | Logo links in der Navigationsleiste |
| Mobiler Header | Logo im kompakten Header |
| CSV-Export (optional) | Logo-Verweis/Dateiname im Metadatenkopf |

## Ablage

Platzhalter und finale Dateien liegen unter:

```
app/public/branding/
```

## Formate

- **Bevorzugt: SVG** (skalierbar, scharf auf allen Displays).
- **Alternativ: transparentes PNG** (hohe Auflösung, transparenter Hintergrund).
- Empfohlen: eine Standardvariante sowie optional eine kompakte/quadratische Variante für den mobilen Header.

## Platzhalter-Hinweis

Im MVP liegt zunächst ein neutraler Platzhalter unter `app/public/branding/`. Er ist vor dem Produktivbetrieb durch das offizielle Firmenlogo (W & S Technik GmbH) zu ersetzen. Die Einbindung im Code referenziert einen festen Dateinamen, sodass der Austausch ohne Codeänderung möglich ist.
