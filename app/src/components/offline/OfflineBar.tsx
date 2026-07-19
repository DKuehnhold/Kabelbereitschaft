"use client";

import { useEffect, useState } from "react";
import { useOffline, offlineManager } from "@/lib/offline/useOffline";
import type { UploadItem, Conflict } from "@/lib/offline/types";

function fmtTime(ts: number | null): string {
  return ts ? new Date(ts).toLocaleString("de-DE", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "—";
}

// Schwebende Offline-Leiste: Status, Warteschlange (Fortschritt/Abbruch/Retry), Konflikte.
export function OfflineBar() {
  const state = useOffline();
  const [open, setOpen] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  useEffect(() => {
    const sync = () => {
      setUploads([...offlineManager.getUploads()]);
      setConflicts([...offlineManager.getConflicts()]);
    };
    sync();
    return offlineManager.subscribe(sync);
  }, []);

  const queued = state.pending + state.uploads;
  const attention = !state.online || queued > 0 || state.conflicts > 0;

  return (
    <div className="fixed bottom-3 right-3 z-40 w-[min(92vw,22rem)]">
      {open ? (
        <div className="mb-2 max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Offline &amp; Synchronisation</h3>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:underline">schließen</button>
          </div>
          <div className="mb-3 space-y-1 text-xs text-slate-600">
            <div>Status: {state.online ? "Online" : "Offline"}{state.syncing ? " · synchronisiert…" : ""}</div>
            <div>Vorgemerkt (Notizen/Status): {state.pending}</div>
            <div>Wartende Uploads: {state.uploads}</div>
            <div>Letzte Synchronisation: {fmtTime(state.lastSync)}</div>
          </div>

          <div className="mb-2 flex gap-2">
            <button
              type="button"
              onClick={() => offlineManager.retry()}
              disabled={!state.online || state.syncing}
              className="rounded-md bg-blue-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              Jetzt synchronisieren
            </button>
          </div>

          {uploads.length > 0 ? (
            <div className="mb-3">
              <div className="mb-1 text-xs font-semibold uppercase text-slate-500">Upload-Warteschlange</div>
              <ul className="space-y-1">
                {uploads.map((u) => (
                  <li key={u.id} className="rounded border border-slate-100 p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="truncate">{u.fileName}{u.incidentNo ? ` · #${u.incidentNo}` : ""}</span>
                      <button type="button" onClick={() => void offlineManager.cancelUpload(u.id)} className="ml-2 text-red-700 hover:underline">abbrechen</button>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-slate-100">
                      <div className="h-full bg-blue-600" style={{ width: `${u.progress}%` }} />
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {u.status === "uploading" ? `${u.progress}%` : u.status === "error" ? `Fehler: ${u.error ?? ""} (${u.attempts})` : "wartet"}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {conflicts.length > 0 ? (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase text-amber-700">Konflikte</div>
              <ul className="space-y-1">
                {conflicts.map((c) => (
                  <li key={c.id} className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                    <div>#{c.incidentNo ?? "?"}: {c.message}</div>
                    <div className="text-[11px]">Serverstand: {c.serverUpdatedAt ? new Date(c.serverUpdatedAt).toLocaleString("de-DE") : "unbekannt"}</div>
                    <button type="button" onClick={() => void offlineManager.clearConflict(c.id)} className="mt-1 text-amber-800 hover:underline">verstanden</button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {queued === 0 && conflicts.length === 0 ? (
            <p className="text-xs text-slate-400">Keine ausstehenden Aktionen.</p>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between rounded-full px-4 py-2 text-sm font-medium shadow-lg ${
          attention ? "bg-amber-500 text-white" : "bg-slate-800 text-white"
        }`}
      >
        <span>{state.online ? (state.syncing ? "Synchronisiert…" : "Online") : "Offline"}</span>
        <span className="ml-2 rounded-full bg-white/25 px-2 py-0.5 text-xs">
          {queued > 0 ? `${queued} offen` : state.conflicts > 0 ? `${state.conflicts} Konflikt` : "✓"}
        </span>
      </button>
    </div>
  );
}
