// Firmenlogo W&S Technik (echtes SVG). Monochrom; im Dark Mode über CSS (.logo-img) aufgehellt.
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
      src="/branding/wus-technik.svg"
      alt="W&S Technik – Kabelbereitschaft"
      height={height}
      style={{ height }}
      className={`logo-img ${className}`}
    />
  );
}
