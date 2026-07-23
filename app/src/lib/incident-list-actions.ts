"use server";

import { getSessionProfile } from "@/lib/auth";
import { listIncidentsForExport } from "@/lib/incidents";
import { deriveOpenHints, mergeCableArts, type IncidentListQuery } from "@/lib/incident-list";
import { STATUS_LABELS } from "@/lib/status";
import { PRIORITY_LABELS } from "@/lib/priority";
import { buildCsv, CSV_BOM } from "@/lib/csv";

function deNum(n: number | null): string {
  return n === null || n === undefined ? "" : String(n).replace(".", ",");
}
function fmtDate(dt: string | null): string {
  return dt
    ? new Date(dt).toLocaleString("de-DE", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "";
}

// Vollständige gefilterte Treffermenge (aktuelle Filter + Sortierung, ohne Pagination).
// RLS greift über die security_invoker-View; keine Service-Role, kein Audit.
export async function exportIncidentList(
  query: IncidentListQuery,
): Promise<{ csv: string; count: number; capped: boolean; error: string | null }> {
  const session = await getSessionProfile();
  if (!session || session.role === "monteur") {
    return { csv: "", count: 0, capped: false, error: "Export ist der Disposition/Administration vorbehalten." };
  }

  const { rows, capped } = await listIncidentsForExport(query);

  const headers = [
    "Vorgangsnummer", "Status", "Priorität", "Kunde", "Bauabschnitt", "VzG", "Betriebsstelle",
    "Kilometer", "Bereitschaftsnummer", "Kabelarten", "Erstellt am", "Zuletzt geändert",
    "Monteure", "Bildanzahl", "Offene Hinweise",
  ];
  const data = rows.map((r) => [
    r.incident_no,
    STATUS_LABELS[r.status],
    PRIORITY_LABELS[r.priority],
    r.customer_name ?? "",
    r.stage_code ? `${r.stage_code} – ${r.stage_name ?? ""}` : (r.stage_name ?? ""),
    r.vzg_line_ref ?? r.vzg_line_number ?? "",
    r.operating_point ?? "",
    r.km_from != null ? `${deNum(r.km_from)}${r.km_to != null ? " - " + deNum(r.km_to) : ""}` : "",
    r.on_call_number ? (r.on_call_label ? `${r.on_call_number} – ${r.on_call_label}` : r.on_call_number) : "",
    mergeCableArts(r.cable_arts).map((g) => (g.count > 1 ? `${g.name} ×${g.count}` : g.name)).join(", "),
    fmtDate(r.created_at),
    fmtDate(r.updated_at),
    r.monteur_names.length ? r.monteur_names.join(", ") : "Nicht zugewiesen",
    r.image_count,
    deriveOpenHints(r).join("; ") || "—",
  ]);

  return { csv: CSV_BOM + buildCsv(headers, data), count: rows.length, capped, error: null };
}
