"use client";

import { useOffline } from "@/lib/offline/useOffline";
import { StatCard } from "@/components/incidents/StatCard";

function fmt(ts: number | null): string {
  return ts ? new Date(ts).toLocaleString("de-DE", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "—";
}

// Dashboard-Kennzahlen/Diagnose für den Offline-Betrieb (rein clientseitig aus IndexedDB).
// Zeigt keine sicherheitskritischen Details (keine Tokens/IDs).
export function OfflineDashboardCards() {
  const s = useOffline();
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Offline vorgemerkt" value={s.pending} accent={s.pending ? "amber" : "slate"} />
      <StatCard label="Wartende Uploads" value={s.uploads} accent={s.uploads ? "orange" : "slate"} />
      <StatCard label="Fehlgeschlagen" value={s.failed} accent={s.failed ? "red" : "slate"} />
      <StatCard label="Offene Konflikte" value={s.conflicts} accent={s.conflicts ? "amber" : "slate"} />
      <div className="col-span-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:col-span-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium text-slate-700">Letzte Synchronisation: <span className="font-semibold text-slate-900">{fmt(s.lastSync)}</span></span>
          <span className="text-slate-500">
            Verbindung: {s.online ? "Online" : "Offline"} · Service Worker: {s.swActive ? "aktiv" : "inaktiv"}
            {s.syncing ? " · synchronisiert…" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
