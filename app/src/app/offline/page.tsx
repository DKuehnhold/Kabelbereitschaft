import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline – Bereitschaftsapp HLK" };
export const dynamic = "force-static";

// Öffentliche Offline-Fallback-Seite (vom Service Worker bei fehlender Verbindung
// für nicht gecachte Navigationen ausgeliefert).
export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-4xl">📴</div>
      <h1 className="text-xl font-semibold text-slate-900">Keine Verbindung</h1>
      <p className="text-sm text-slate-600">
        Diese Seite ist offline nicht verfügbar. Bereits geöffnete Vorgänge, das Dashboard und
        die Chronik bleiben aus dem Cache nutzbar. Notizen, Statusänderungen und Bild-Uploads
        werden vorgemerkt und automatisch synchronisiert, sobald wieder eine Verbindung besteht.
      </p>
      <div className="flex gap-2">
        <Link href="/dashboard" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover">
          Zum Dashboard
        </Link>
      </div>
    </div>
  );
}
