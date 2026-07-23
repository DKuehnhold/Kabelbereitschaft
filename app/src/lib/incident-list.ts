// AP11: Reine Typen/Helfer der operativen Vorgangsliste (ohne Server-Importe,
// damit sie auch in Client-Komponenten nutzbar sind). Die DB-Reads liegen in
// incidents.ts, die URL-Abbildung in incident-list-url.ts.
import type { IncidentStatus } from "@/lib/status";
import type { Priority } from "@/lib/priority";

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

// Abgeleitete „offene Hinweise" (kein Aufgabenmodell, keine Mutation/Audit).
export function deriveOpenHints(row: {
  no_monteur: boolean; no_images: boolean; no_cable: boolean; historic_vzg: boolean;
}): string[] {
  const hints: string[] = [];
  if (row.no_monteur) hints.push("Kein Monteur zugewiesen");
  if (row.no_images) hints.push("Keine Bilder vorhanden");
  if (row.no_cable) hints.push("Keine Kabelposition vorhanden");
  if (row.historic_vzg) hints.push("Historische VzG-Zuordnung");
  return hints;
}

// Kabelarten für die Anzeige zusammenfassen (gleiche Art -> Zähler).
export function mergeCableArts(names: string[]): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const n of names) map.set(n, (map.get(n) ?? 0) + 1);
  return Array.from(map, ([name, count]) => ({ name, count }));
}
