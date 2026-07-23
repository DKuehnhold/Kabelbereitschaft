import { createClient } from "@/lib/supabase/server";
import type { IncidentStatus, ConditionRating } from "@/lib/status";
import type { Priority } from "@/lib/priority";
import {
  getActiveCustomers,
  listStages,
  listVzgLines,
  getActiveOnCallOptions,
  listCableTypes,
  getAppSettings,
  listProfileOptions,
} from "@/lib/masterdata";
import {
  INCIDENT_PAGE_SIZES,
  INCIDENT_EXPORT_CAP,
  type IncidentListFilters,
  type IncidentListSort,
  type IncidentListSortField,
  type IncidentListQuery,
  type IncidentListResult,
  type IncidentListRow,
  type IncidentListFilterOptions,
} from "@/lib/incident-list";

// Sichtmodelle (View-Types) – bewusst entkoppelt von den generischen
// Supabase-Embed-Typen; Ergebnisse werden gecastet.
export type StageRef = { id: string; name: string; code: string | null } | null;
export type OnCallRef = { id: string; number: string; label: string | null } | null;
export type MonteurRef = { id: string; full_name: string | null } | null;

export type AssignmentRef = {
  id: string;
  monteur_id: string;
  is_active: boolean;
  assigned_at: string;
  monteur: MonteurRef;
};

// AP10-Referenzen
export type CustomerRef = { id: string; name: string } | null;
export type VzgRef = { id: string; line_number: string } | null;
export type CableTypeRefMini = { id: string; code: string; name: string } | null;
export type CablePositionRef = {
  id: string;
  cable_type_id: string;
  sort_order: number;
  cable_type: CableTypeRefMini;
};

export type IncidentRow = {
  id: string;
  incident_no: number;
  status: IncidentStatus;
  priority: Priority;
  condition_rating: ConditionRating | null;
  customer_id: string | null;
  vzg_line_id: string | null;
  vzg_line_number: string | null;
  km_from: number | null;
  km_to: number | null;
  operating_point: string | null;
  track: string | null;
  direction: string | null;
  object_type: string | null;
  object_designation: string | null;
  location_description: string | null;
  external_reference: string | null;
  caller_name: string | null;
  caller_contact: string | null;
  title: string | null;
  description: string | null;
  internal_note: string | null;
  closing_note: string | null;
  on_call_number_id: string | null;
  call_received_at: string | null;
  construction_stage_id: string;
  closed_at: string | null;
  closed_by: string | null;
  created_at: string;
  updated_at: string;
  // Frühester Wechsel nach „technisch_abgeschlossen" (für CSV-Export); aus Chronik.
  technisch_abgeschlossen_at: string | null;
  stage: StageRef;
  oncall: OnCallRef;
  customer: CustomerRef;
  vzgline: VzgRef;
  cable_positions: CablePositionRef[];
  assignments: AssignmentRef[];
};

export type StatusEvent = {
  id: string;
  old_status: IncidentStatus | null;
  new_status: IncidentStatus;
  note: string | null;
  changed_by: string | null;
  changed_at: string;
};

export type NoteEvent = {
  id: string;
  note_type: string;
  body: string;
  created_by: string | null;
  created_at: string;
};

export type IncidentDetail = {
  incident: IncidentRow;
  history: StatusEvent[];
  notes: NoteEvent[];
};

const INCIDENT_SELECT = `
  id, incident_no, status, priority, condition_rating,
  customer_id, vzg_line_id, vzg_line_number, km_from, km_to, operating_point, track, direction,
  object_type, object_designation, location_description, external_reference,
  caller_name, caller_contact, title, description, internal_note, closing_note,
  on_call_number_id, call_received_at, construction_stage_id,
  closed_at, closed_by, created_at, updated_at,
  stage:construction_stages(id, name, code),
  oncall:on_call_numbers(id, number, label),
  customer:customers(id, name),
  vzgline:vzg_lines(id, line_number),
  cable_positions:incident_cable_positions(id, cable_type_id, sort_order, cable_type:cable_types(id, code, name)),
  assignments:incident_assignments(id, monteur_id, is_active, assigned_at, monteur:profiles(id, full_name))
`;

// Sichtbarkeit wird durch RLS erzwungen: Disposition/Admin sehen alle,
// Monteur nur zugewiesene Vorgänge.
export async function listIncidents(): Promise<IncidentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("incidents")
    .select(INCIDENT_SELECT)
    .order("updated_at", { ascending: false });
  const rows = (data ?? []) as unknown as IncidentRow[];
  if (rows.length === 0) return rows;

  // Technischer Abschlusszeitpunkt (frühester Wechsel nach technisch_abgeschlossen).
  const ids = rows.map((r) => r.id);
  const { data: hist } = await supabase
    .from("incident_status_history")
    .select("incident_id, changed_at")
    .eq("new_status", "technisch_abgeschlossen")
    .in("incident_id", ids)
    .order("changed_at", { ascending: true });
  const techMap = new Map<string, string>();
  for (const h of (hist ?? []) as { incident_id: string; changed_at: string }[]) {
    if (!techMap.has(h.incident_id)) techMap.set(h.incident_id, h.changed_at);
  }
  for (const r of rows) r.technisch_abgeschlossen_at = techMap.get(r.id) ?? null;
  return rows;
}

export async function getIncidentDetail(id: string): Promise<IncidentDetail | null> {
  const supabase = await createClient();
  const { data: incident } = await supabase
    .from("incidents")
    .select(INCIDENT_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (!incident) return null;

  const { data: history } = await supabase
    .from("incident_status_history")
    .select("id, old_status, new_status, note, changed_by, changed_at")
    .eq("incident_id", id)
    .order("changed_at", { ascending: true });

  const { data: notes } = await supabase
    .from("incident_notes")
    .select("id, note_type, body, created_by, created_at")
    .eq("incident_id", id)
    .order("created_at", { ascending: true });

  const inc = incident as unknown as IncidentRow;
  inc.technisch_abgeschlossen_at =
    (history ?? []).find((h) => h.new_status === "technisch_abgeschlossen")?.changed_at ?? null;

  return {
    incident: inc,
    history: (history ?? []) as StatusEvent[],
    notes: (notes ?? []) as NoteEvent[],
  };
}

export async function getMonteure(): Promise<{ id: string; full_name: string | null }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "monteur")
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  return (data ?? []) as { id: string; full_name: string | null }[];
}

export async function getStages(): Promise<{ id: string; name: string; code: string | null }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("construction_stages")
    .select("id, name, code")
    .eq("is_active", true)
    .order("name", { ascending: true });
  return (data ?? []) as { id: string; name: string; code: string | null }[];
}

export async function getOnCallNumbers(): Promise<{ id: string; number: string; label: string | null }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("on_call_numbers")
    .select("id, number, label")
    .eq("is_active", true)
    .order("number", { ascending: true });
  return (data ?? []) as { id: string; number: string; label: string | null }[];
}

// Aktive Monteurnamen eines Vorgangs.
export function activeMonteurNames(row: IncidentRow): string[] {
  return row.assignments
    .filter((a) => a.is_active)
    .map((a) => a.monteur?.full_name ?? "—");
}

export type FormState = { ok: boolean; error: string | null };

// ---------------------------------------------------------------------
// AP10: Optionen für Erfassungs-/Bearbeitungsmaske (nur aktive Stammdaten).
// Nutzt die AP9-Reads – keine parallele Incident-Datenzugriffsschicht.
// ---------------------------------------------------------------------
export type IncidentFormStage = { id: string; label: string; default_on_call_number_id: string | null };
export type IncidentFormVzg = { id: string; line_number: string; construction_stage_id: string };
export type IncidentFormOption = { id: string; label: string };
export type IncidentFormOptions = {
  customers: { id: string; name: string }[];
  stages: IncidentFormStage[];
  vzgLines: IncidentFormVzg[];
  onCall: IncidentFormOption[];
  cableTypes: { id: string; code: string; name: string }[];
  defaults: { customer_id: string | null; on_call_number_id: string | null };
};

export async function getIncidentFormOptions(): Promise<IncidentFormOptions> {
  const [customers, stages, vzg, onCall, cableTypes, settings] = await Promise.all([
    getActiveCustomers(),
    listStages(),
    listVzgLines(),
    getActiveOnCallOptions(),
    listCableTypes(),
    getAppSettings(),
  ]);
  return {
    customers: customers.map((c) => ({ id: c.id, name: c.name })),
    stages: stages
      .filter((s) => s.is_active)
      .map((s) => ({
        id: s.id,
        label: s.code ? `${s.code} – ${s.name}` : s.name,
        default_on_call_number_id: s.default_on_call_number_id,
      })),
    vzgLines: vzg
      .filter((v) => v.is_active)
      .map((v) => ({ id: v.id, line_number: v.line_number, construction_stage_id: v.construction_stage_id })),
    onCall,
    cableTypes: cableTypes.filter((t) => t.is_active).map((t) => ({ id: t.id, code: t.code, name: t.name })),
    defaults: { customer_id: settings.default_customer_id, on_call_number_id: settings.default_on_call_number_id },
  };
}

// =====================================================================
// AP11: Operative Vorgangsliste (serverseitig, RLS über View security_invoker).
// Typen/Helfer in @/lib/incident-list; hier nur die DB-Reads.
// =====================================================================
const LIST_SELECT =
  "id, incident_no, status, priority, customer_id, customer_name, construction_stage_id, stage_code, stage_name, " +
  "vzg_line_id, vzg_line_number, vzg_line_ref, on_call_number_id, on_call_number, on_call_label, operating_point, " +
  "km_from, km_to, created_at, created_by, updated_at, image_count, cable_arts, monteur_names, monteur_ids, " +
  "no_monteur, no_images, no_cable, historic_vzg";

const SORT_COLUMN: Record<IncidentListSortField, string> = {
  incident_no: "incident_no",
  priority: "priority",
  status: "status",
  customer: "customer_name",
  construction_stage: "stage_name",
  created_at: "created_at",
  updated_at: "updated_at",
};

function escapeLike(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function sortOrders(sort: IncidentListSort): [string, boolean][] {
  return [
    ...sort.map((s) => [SORT_COLUMN[s.field], s.dir === "asc"] as [string, boolean]),
    // Stabile Standard-/Tiebreaker-Sortierung
    ["updated_at", false],
    ["incident_no", false],
  ];
}

async function fetchList(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: IncidentListFilters,
  sort: IncidentListSort,
  from: number,
  to: number,
) {
  const f = filters;
  let q = supabase.from("incident_list_view").select(LIST_SELECT, { count: "exact" });
  if (f.status) q = q.eq("status", f.status);
  else if (f.activity === "active") q = q.not("status", "in", "(abgeschlossen,storniert)");
  else if (f.activity === "closed") q = q.eq("status", "abgeschlossen");
  if (f.priority) q = q.eq("priority", f.priority);
  if (f.customer_id) q = q.eq("customer_id", f.customer_id);
  if (f.stage_id) q = q.eq("construction_stage_id", f.stage_id);
  if (f.vzg_line_id) q = q.eq("vzg_line_id", f.vzg_line_id);
  if (f.on_call_number_id) q = q.eq("on_call_number_id", f.on_call_number_id);
  if (f.created_by) q = q.eq("created_by", f.created_by);
  if (f.monteur_id) q = q.contains("monteur_ids", [f.monteur_id]);
  if (f.images === "with") q = q.gt("image_count", 0);
  else if (f.images === "without") q = q.eq("image_count", 0);
  if (f.date_from) q = q.gte("created_date_local", f.date_from);
  if (f.date_to) q = q.lte("created_date_local", f.date_to);
  const term = (f.q ?? "").trim();
  if (term) q = q.ilike("search_text", `%${escapeLike(term.toLowerCase())}%`);

  const orders = sortOrders(sort);
  let t = q.order(orders[0][0], { ascending: orders[0][1] });
  for (let k = 1; k < orders.length; k++) t = t.order(orders[k][0], { ascending: orders[k][1] });
  return t.range(from, to);
}

export async function listIncidentsPaged(query: IncidentListQuery): Promise<IncidentListResult> {
  const supabase = await createClient();
  const pageSize = (INCIDENT_PAGE_SIZES as readonly number[]).includes(query.pageSize) ? query.pageSize : 50;
  let page = Math.max(1, Math.trunc(query.page) || 1);

  let from = (page - 1) * pageSize;
  let res = await fetchList(supabase, query.filters, query.sort, from, from + pageSize - 1);
  let total = res.count ?? 0;

  // Ungültige Seite auf gültigen Bereich normalisieren.
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (total > 0 && page > lastPage) {
    page = lastPage;
    from = (page - 1) * pageSize;
    res = await fetchList(supabase, query.filters, query.sort, from, from + pageSize - 1);
    total = res.count ?? total;
  }

  return { rows: (res.data ?? []) as unknown as IncidentListRow[], total, page, pageSize };
}

export async function listIncidentsForExport(
  query: IncidentListQuery,
): Promise<{ rows: IncidentListRow[]; total: number; capped: boolean }> {
  const supabase = await createClient();
  const res = await fetchList(supabase, query.filters, query.sort, 0, INCIDENT_EXPORT_CAP - 1);
  const total = res.count ?? 0;
  return { rows: (res.data ?? []) as unknown as IncidentListRow[], total, capped: total > INCIDENT_EXPORT_CAP };
}

export async function getIncidentListFilterOptions(): Promise<IncidentListFilterOptions> {
  const [opts, monteure, creators] = await Promise.all([
    getIncidentFormOptions(),
    getMonteure(),
    listProfileOptions(),
  ]);
  return {
    customers: opts.customers.map((c) => ({ id: c.id, label: c.name })),
    stages: opts.stages.map((s) => ({ id: s.id, label: s.label })),
    vzgLines: opts.vzgLines.map((v) => ({ id: v.id, label: v.line_number, construction_stage_id: v.construction_stage_id })),
    onCall: opts.onCall,
    monteure: monteure.map((m) => ({ id: m.id, label: m.full_name ?? "—" })),
    creators,
  };
}
