import type { MetadataRoute } from "next";

// Web App Manifest (Next.js Metadata Route → /manifest.webmanifest).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bereitschaftsapp HLK",
    short_name: "HLK",
    description:
      "Erfassung und Dokumentation von Bereitschaftsvorgängen – offlinefähig (PWA).",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f8fafc",
    theme_color: "#1e3a8a",
    lang: "de",
    dir: "ltr",
    categories: ["business", "productivity", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
