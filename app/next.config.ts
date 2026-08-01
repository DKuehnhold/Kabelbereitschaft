import type { NextConfig } from "next";

// HTTP-Sicherheitsheader (AP7). Bewusst konservativ:
// - Die "harten" Header sind sicher und blockieren keine Funktionen.
// - Content-Security-Policy wird zunächst als Report-Only ausgeliefert, damit sie
//   nichts unbemerkt bricht; sie ist im Browser zu verifizieren und danach auf die
//   durchsetzende Variante (Content-Security-Policy) umzustellen. Siehe SICHERHEIT.md.
//
// Es ist bewusst KEINE zusätzliche Herkunft und keine Wildcard eingetragen, auch
// nicht für den Objektspeicher: die signierten Bild-URLs liegen nach der
// festgelegten Same-Origin-Proxygrenze unter demselben Origin wie die Anwendung
// (AUTH_URL). Der interne Reverse-Proxy routet den Bucket-Pfad auf den privaten
// MinIO-Dienst; bei Path-Style beginnt der Pfad einer signierten URL mit dem
// Bucketnamen. Diese Grenze wird zur Laufzeit fail-closed erzwungen - der
// Origin-Vergleich von S3_PUBLIC_BASE_URL gegen AUTH_URL steht in
// src/lib/minio-config.ts (readMinioConfig). Damit genügt img-src 'self'.
const cspReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
];

const nextConfig: NextConfig = {
  // Containerbetrieb (AP14): "standalone" erzeugt unter .next/standalone einen
  // eigenstaendigen Server samt minimaler node_modules. Das Laufzeitimage
  // braucht damit keine Build-Werkzeuge und keine vollen Abhaengigkeiten.
  // Zu beachten: .next/static und public/ sind NICHT Teil der
  // Standalone-Ausgabe und werden im Dockerfile separat kopiert.
  // Der Modus ist absichtlich nur beim Containerbau aktiv. Ein globales
  // "standalone" macht `next start` unbrauchbar und wuerde damit den
  // bestehenden Playwright-Webserver in der Verify-CI brechen.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
