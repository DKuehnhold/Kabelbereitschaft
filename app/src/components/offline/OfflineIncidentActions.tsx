"use client";

import { useState } from "react";
import { useOffline, offlineManager } from "@/lib/offline/useOffline";
import { INCIDENT_STATUS, MONTEUR_STATUS, STATUS_LABELS, IMAGE_CATEGORIES, IMAGE_CATEGORY_LABELS, type ImageCategory } from "@/lib/status";
import type { UserRole } from "@/lib/roles";

const field = "rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 w-full";
const btn = "rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50";

// Offline-fähige Erfassung: Notiz, Statusvormerkung, Bilder zur Upload-Warteschlange.
// Online werden die Aktionen sofort synchronisiert, offline vorgemerkt (kein Verlust).
export function OfflineIncidentActions({
  incidentId,
  incidentNo,
  currentStatus,
  updatedAt,
  role,
}: {
  incidentId: string;
  incidentNo: number;
  currentStatus: string;
  updatedAt: string;
  role: UserRole;
}) {
  const state = useOffline();
  const isStaff = role !== "monteur";
  const statusOptions = isStaff ? INCIDENT_STATUS : MONTEUR_STATUS;

  const [note, setNote] = useState("");
  const [status, setStatus] = useState(currentStatus);
  const [category, setCategory] = useState<ImageCategory>("uebersicht");
  const [msg, setMsg] = useState<string | null>(null);

  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(null), 4000); };
  const suffix = state.online ? "wird synchronisiert" : "offline vorgemerkt";

  async function submitNote() {
    const body = note.trim();
    if (!body) return;
    await offlineManager.enqueueNote(incidentId, incidentNo, body);
    setNote("");
    flash(`Notiz ${suffix}.`);
  }
  async function submitStatus() {
    await offlineManager.enqueueStatus(incidentId, incidentNo, status, updatedAt);
    flash(`Statusänderung ${suffix}.`);
  }
  async function queueImages(files: FileList | null) {
    if (!files || files.length === 0) return;
    let n = 0;
    for (const f of Array.from(files)) {
      await offlineManager.enqueueUpload({ incidentId, incidentNo, category, description: null, file: f });
      n += 1;
    }
    flash(`${n} Bild(er) zur Upload-Warteschlange hinzugefügt (${suffix}).`);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase text-slate-500">Offline-fähige Erfassung</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs ${state.online ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
          {state.online ? "Online" : "Offline"}
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-slate-500">Notiz</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={field} placeholder="Feststellung, Maßnahme, Hinweis…" />
          <button type="button" onClick={submitNote} disabled={!note.trim()} className={`${btn} mt-2`}>Notiz erfassen</button>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-500">
            Status vormerken
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${field} max-w-xs`}>
              {statusOptions.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={submitStatus} className={btn}>Status übernehmen</button>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-500">
            Bildkategorie
            <select value={category} onChange={(e) => setCategory(e.target.value as ImageCategory)} className={`${field} max-w-xs`}>
              {IMAGE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{IMAGE_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-500">
            Bilder zur Warteschlange
            <input type="file" accept="image/jpeg,image/png" multiple onChange={(e) => queueImages(e.target.files)} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2" />
          </label>
        </div>

        {msg ? <p className="text-xs text-green-700">{msg}</p> : null}
        <p className="text-[11px] text-slate-400">
          Erfasste Aktionen erscheinen in der Offline-Leiste unten rechts und werden bei Verbindung
          automatisch synchronisiert. Konflikte werden dort gemeldet.
        </p>
      </div>
    </section>
  );
}
