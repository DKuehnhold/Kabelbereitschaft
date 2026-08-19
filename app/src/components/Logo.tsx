// Firmenlogo (W&S-Gruppe, AUFTRAG_12). Laedt public/branding/logo.svg -
// hochkantes/quadratisches Seitenverhaeltnis (viewBox 176.21 x 132.25).
// Feste Hoehe je Aufrufkontext, Breite bewusst "auto" (kein fester width-Wert,
// kein object-fit-Zwang auf ein anderes Seitenverhaeltnis) - so bleibt das SVG
// unverzerrt, unabhaengig davon, wie hoch der jeweilige Aufrufer es braucht.
// Dark Mode: Die Wortmarke ist rein schwarz gezeichnet (kein Farbverlauf, keine
// Buntfarbe). Einfachste Loesung ohne zweite Logodatei und ohne Farb-Hack an der
// SVG-Datei selbst: `dark:invert` dreht auf dunklem Grund die Helligkeit um
// (schwarz -> weiss), sodass die Marke sichtbar bleibt, ohne ihre Form/Kontur zu
// veraendern. AUFTRAG_21: `dark:invert` selbst ist unveraendert - repariert wurde
// die zugrundeliegende `dark:`-Variante in globals.css (Zeile 9), die bislang nur
// das explizite Theme abdeckte und bei "System" + dunklem Betriebssystem nicht
// griff; seitdem wirkt dieselbe Klasse auch in diesem zweiten Dunkelfall.
export function Logo({
  className = "",
  height = 36,
}: {
  className?: string;
  height?: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/branding/logo.svg"
      alt="Logo W&S Technik"
      height={height}
      style={{ height, width: "auto" }}
      className={`object-contain dark:invert ${className}`.trim()}
    />
  );
}
