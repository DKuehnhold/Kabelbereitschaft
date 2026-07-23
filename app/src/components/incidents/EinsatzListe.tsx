import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import { PriorityBadge } from "./PriorityBadge";
import { CONDITION_LABELS } from "@/lib/status";
import type { IncidentRow } from "@/lib/incidents";

function fmt(dt: string): string {
  return new Date(dt).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function EinsatzListe({ rows }: { rows: IncidentRow[] }) {
  if (!rows.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-slate-400">
        Aktuell keine Einsätze.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <Link
          key={r.id}
          href={`/vorgaenge/${r.id}`}
          className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-900">#{r.incident_no}</span>
            <div className="flex items-center gap-2">
              <PriorityBadge priority={r.priority} />
              <StatusBadge status={r.status} />
            </div>
          </div>
          <div className="mt-2 text-sm text-slate-700">
            {r.customer?.name ? `${r.customer.name} · ` : ""}
            {r.stage?.name ?? "—"} · VzG {r.vzgline?.line_number ?? r.vzg_line_number ?? "—"}
            {r.km_from != null ? ` · km ${r.km_from}${r.km_to != null ? `–${r.km_to}` : ""}` : ""}
          </div>
          {r.operating_point || r.object_designation ? (
            <div className="text-sm text-slate-500">
              {[r.operating_point, r.object_designation].filter(Boolean).join(" · ")}
            </div>
          ) : null}
          <div className="mt-1 text-xs text-slate-400">
            {r.condition_rating ? `Zustand: ${CONDITION_LABELS[r.condition_rating]} · ` : ""}
            Aktualisiert {fmt(r.updated_at)}
          </div>
        </Link>
      ))}
    </div>
  );
}
