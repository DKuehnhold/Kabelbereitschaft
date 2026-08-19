import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bereitschaftsapp HLK",
  description: "Bereitschaftsapp HLK – Erfassung und Dokumentation von Bereitschaftsvorgängen",
  manifest: "/manifest.webmanifest",
  applicationName: "Bereitschaftsapp HLK",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Bereitschaftsapp HLK" },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  // AUFTRAG_13: alte Blau-Werte (#1e3a8a/#0b1220, vor AUFTRAG_11) auf das
  // aktuelle Marken-Rot umgestellt - identisch zu `theme_color` in
  // manifest.ts (#7f1d1d), damit Browser-Chrome/Task-Switcher nicht mehr
  // blau einfärben.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#7f1d1d" },
    { media: "(prefers-color-scheme: dark)", color: "#dc2626" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Setzt das gespeicherte Theme vor dem ersten Paint (verhindert Flackern/FOUC).
const themeInit = `try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="de"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full bg-background text-foreground">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
