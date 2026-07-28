// AP11: Reine Typen/Helfer der operativen Vorgangsliste (ohne Server-Importe,
// damit sie auch in Client-Komponenten nutzbar sind). Die DB-Reads liegen in
// incidents.ts, die URL-Abbildung in incident-list-url.ts.
import type { IncidentStatus } from "@/lib/status";
import type { Priority } from "@/lib/priority";
import type { IncidentBulkActionCode } from "@/lib/database.types";

export type IncidentListRow = {
  id: string;
  incident_no: number;
  status: IncidentStatus;
  priority: Priority;
  customer_id: string | null;
  customer_name: string | null;
  construction_stage_id: string | null;
  stage_code: string | null;
  stage_name: string | null;
  vzg_line_id: string | null;
  vzg_line_number: string | null;
  vzg_line_ref: string | null;
  on_call_number_id: string | null;
  on_call_number: string | null;
  on_call_label: string | null;
  operating_point: string | null;
  km_from: number | null;
  km_to: number | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  image_count: number;
  cable_arts: string[];
  monteur_names: string[];
  monteur_ids: string[];
  no_monteur: boolean;
  no_images: boolean;
  no_cable: boolean;
  historic_vzg: boolean;
  // AP13: offen = Aufgabe im Status 'open' oder 'in_progress'.
  has_open_task: boolean;
};

export type IncidentActivity = "all" | "active" | "closed";
export type IncidentImagesFilter = "all" | "with" | "without";

export type IncidentListFilters = {
  q?: string;
  status?: IncidentStatus;
  priority?: Priority;
  customer_id?: string;
  stage_id?: string;
  vzg_line_id?: string;
  on_call_number_id?: string;
  monteur_id?: string;
  created_by?: string;
  date_from?: string; // YYYY-MM-DD (lokal, inklusive)
  date_to?: string; // YYYY-MM-DD (lokal, inklusive)
  images?: IncidentImagesFilter;
  activity?: IncidentActivity;
  // AP13: nur Vorgänge mit mindestens einer offenen Aufgabe.
  hasOpenTask?: boolean;
};

export type IncidentListSortField =
  | "incident_no" | "priority" | "status" | "customer" | "construction_stage" | "created_at" | "updated_at";
export type IncidentListSort = { field: IncidentListSortField; dir: "asc" | "desc" }[];

export type IncidentListQuery = {
  filters: IncidentListFilters;
  sort: IncidentListSort;
  page: number;
  pageSize: number;
};

export type IncidentListResult = {
  rows: IncidentListRow[];
  total: number;
  page: number;
  pageSize: number;
};

export const INCIDENT_PAGE_SIZES = [50, 100, 250] as const;
export const INCIDENT_EXPORT_CAP = 5000;

export type IncidentFilterOption = { id: string; label: string };
export type IncidentListFilterOptions = {
  customers: IncidentFilterOption[];
  stages: IncidentFilterOption[];
  vzgLines: (IncidentFilterOption & { construction_stage_id: string })[];
  onCall: IncidentFilterOption[];
  monteure: IncidentFilterOption[];
  creators: IncidentFilterOption[];
};

// =====================================================================
// AP13: Massenaktionen (Status ändern, Monteur zuweisen).
// Obergrenze und Ergebnisform liegen hier, damit Server-Actions und
// Client-Komponente dieselbe Quelle nutzen. Die Datenbank erzwingt die
// Obergrenze zusätzlich als harten Fehler.
// =====================================================================
export const INCIDENT_BULK_LIMIT = 200;

export type IncidentBulkItem = { id: string; expected_updated_at: string };
export type IncidentBulkAssignItem = IncidentBulkItem & { expected_monteur_ids: string[] };
export type IncidentBulkCode = IncidentBulkActionCode;

export type IncidentBulkResult = {
  ok: number;
  failed: { id: string; code: IncidentBulkCode }[];
  error: string | null;
};

export const BULK_CODE_LABELS: Record<IncidentBulkCode, string> = {
  ok: "Übernommen",
  conflict: "Zwischenzeitlich geändert",
  not_found: "Nicht gefunden",
  guard_rejected: "Von der Regelprüfung abgelehnt",
  invalid_status: "Ungültiger Status",
  invalid_monteur: "Monteur ungültig oder inaktiv",
};

// Kabelarten für die Anzeige zusammenfassen (gleiche Art -> Zähler).
export function mergeCableArts(names: string[]): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const n of names) map.set(n, (map.get(n) ?? 0) + 1);
  return Array.from(map, ([name, count]) => ({ name, count }));
}
