"use client";

import { useOffline } from "@/lib/offline/useOffline";
import { StatCard } from "@/components/incidents/StatCard";

function fmt(ts: number | null): string {
  return ts ? new Date(ts).toLocaleString("de-DE", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "—";
}

// Dashboard-Kennzahlen für den Offline-Betrieb (rein clientseitig aus IndexedDB).
export function OfflineDashboardCards() {
  const s = useOffline();
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      <StatCard label="Offline vorgemerkt" value={s.pending} accent={s.pending ? "amber" : "slate"} />
      <StatCard label="Wartende Uploads" value={s.uploads} accent={s.uploads ? "orange" : "slate"} />
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-medium text-slate-700">Letzte Synchronisation</div>
        <div className="mt-1 text-lg font-semibold text-slate-900">{fmt(s.lastSync)}</div>
        <div className="mt-1 text-xs text-slate-500">{s.online ? "Online" : "Offline"}{s.conflicts ? ` · ${s.conflicts} Konflikt(e)` : ""}</div>
      </div>
    </div>
  );
}
