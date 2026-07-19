// Firmenlogo. Laedt public/branding/logo.svg (aktuell Platzhalter).
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
      alt="Firmenlogo (Platzhalter)"
      height={height}
      style={{ height }}
      className={className}
    />
  );
}
