"use client";

import { useEffect, useState } from "react";
import { useOffline, offlineManager } from "@/lib/offline/useOffline";
import { STATUS_LABELS, type IncidentStatus } from "@/lib/status";
import type { UploadItem, Conflict } from "@/lib/offline/types";

function fmtTime(ts: number | null): string {
  return ts ? new Date(ts).toLocaleString("de-DE", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "—";
}
function statusLabel(s: string | null): string {
  return s && (s as IncidentStatus) in STATUS_LABELS ? STATUS_LABELS[s as IncidentStatus] : (s ?? "—");
}

// Schwebende Offline-Leiste: Status, Warteschlange (Fortschritt/Abbruch/Retry),
// Konflikte inkl. kontrollierter Auflösung. Tastatur-/Screenreader-freundlich.
export function OfflineBar({ userId }: { userId?: string }) {
  const state = useOffline();
  const [open, setOpen] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  useEffect(() => {
    if (userId) void offlineManager.init(userId);
    const sync = () => { setUploads([...offlineManager.getUploads()]); setConflicts([...offlineManager.getConflicts()]); };
    sync();
    return offlineManager.subscribe(sync);
  }, [userId]);

  const queued = state.pending + state.uploads;
  const attention = !state.online || queued > 0 || state.conflicts > 0 || state.failed > 0;

  return (
    <div className="fixed bottom-3 right-3 z-40 w-[min(92vw,23rem)]">
      {open ? (
        <div className="mb-2 max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-white p-3 shadow-lg" role="region" aria-label="Offline und Synchronisation">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Offline &amp; Synchronisation</h3>
            <button type="button" onClick={() => setOpen(false)} className="rounded text-xs text-slate-500 hover:underline focus:outline-none focus:ring-2 focus:ring-ring">schließen</button>
          </div>
          <dl className="mb-3 grid grid-cols-2 gap-1 text-xs text-slate-600">
            <dt>Status</dt><dd className="text-right">{state.online ? "Online" : "Offline"}{state.syncing ? " · sync…" : ""}</dd>
            <dt>Vorgemerkt</dt><dd className="text-right">{state.pending}</dd>
            <dt>Wartende Uploads</dt><dd className="text-right">{state.uploads}</dd>
            <dt>Fehlgeschlagen</dt><dd className="text-right">{state.failed}</dd>
            <dt>Konflikte</dt><dd className="text-right">{state.conflicts}</dd>
            <dt>Service Worker</dt><dd className="text-right">{state.swActive ? "aktiv" : "inaktiv"}</dd>
            <dt>Letzte Sync</dt><dd className="text-right">{fmtTime(state.lastSync)}</dd>
          </dl>

          <button
            type="button"
            onClick={() => offlineManager.retry()}
            disabled={!state.online || state.syncing}
            className="mb-3 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-fg hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            Jetzt synchronisieren
          </button>

          {uploads.length > 0 ? (
            <div className="mb-3">
              <div className="mb-1 text-xs font-semibold uppercase text-slate-500">Upload-Warteschlange</div>
              <ul className="space-y-1">
                {uploads.map((u) => (
                  <li key={u.id} className="rounded border border-slate-100 p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="truncate">{u.fileName}{u.incidentNo ? ` · #${u.incidentNo}` : ""}</span>
                      <button type="button" onClick={() => void offlineManager.cancelUpload(u.id)} className="ml-2 rounded text-red-700 hover:underline focus:outline-none focus:ring-2 focus:ring-red-400" aria-label={`Upload ${u.fileName} abbrechen`}>abbrechen</button>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-slate-100" role="progressbar" aria-valuenow={u.progress} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full bg-brand" style={{ width: `${u.progress}%` }} />
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {u.status === "uploading" ? `${u.progress}%` : u.status === "error" ? `Fehler: ${u.error ?? ""} (Versuch ${u.attempts})` : "wartet"}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {conflicts.length > 0 ? (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase text-amber-700">Konflikte</div>
              <ul className="space-y-2">
                {conflicts.map((c) => (
                  <li key={c.id} className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                    <div className="font-medium">#{c.incidentNo ?? "?"} · {c.kind === "status" ? "Statuskonflikt" : "Konflikt"}</div>
                    <div>{c.message}</div>
                    {c.kind === "status" ? <div>Lokal geplant: <strong>{statusLabel(c.attemptedStatus)}</strong></div> : null}
                    <div className="text-[11px]">Serverstand geändert: {c.serverUpdatedAt ? new Date(c.serverUpdatedAt).toLocaleString("de-DE") : "unbekannt"}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {c.kind === "status" ? (
                        <button type="button" onClick={() => void offlineManager.reapplyStatusConflict(c)} className="rounded-md bg-amber-700 px-2 py-1 text-white hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500">
                          Erneut anwenden (aktueller Stand)
                        </button>
                      ) : null}
                      <button type="button" onClick={() => void offlineManager.clearConflict(c.id)} className="rounded-md border border-amber-400 px-2 py-1 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500">
                        Serverstand übernehmen
                      </button>
                      <button type="button" onClick={() => void offlineManager.clearConflict(c.id)} className="rounded-md border border-amber-400 px-2 py-1 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500">
                        Verwerfen
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {queued === 0 && conflicts.length === 0 && state.failed === 0 ? (
            <p className="text-xs text-slate-400">Keine ausstehenden Aktionen.</p>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Offline-Status: ${state.online ? "online" : "offline"}, ${queued} ausstehende Aktionen, ${state.conflicts} Konflikte`}
        className={`flex w-full items-center justify-between rounded-full px-4 py-2 text-sm font-medium shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring ${
          attention ? "bg-amber-500 text-white" : "bg-slate-800 text-white"
        }`}
      >
        <span>{state.online ? (state.syncing ? "Synchronisiert…" : "Online") : "Offline"}</span>
        <span className="ml-2 rounded-full bg-white/25 px-2 py-0.5 text-xs">
          {queued > 0 ? `${queued} offen` : state.conflicts > 0 ? `${state.conflicts} Konflikt` : state.failed > 0 ? `${state.failed} Fehler` : "✓"}
        </span>
      </button>
    </div>
  );
}
