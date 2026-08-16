// AP11: URL <-> IncidentListQuery (rein, ohne React/Next – server- und clientseitig nutzbar).
// Die URL ist die verbindliche Zustandsquelle für Suche/Filter/Sortierung/Pagination.
import { INCIDENT_STATUS, type IncidentStatus } from "@/lib/status";
import { PRIORITIES, type Priority } from "@/lib/priority";
import {
  INCIDENT_PAGE_SIZES,
  type IncidentActivity,
  type IncidentImagesFilter,
  type IncidentListFilters,
  type IncidentListQuery,
  type IncidentListSort,
  type IncidentListSortField,
} from "@/lib/incident-list";

export type ParamGetter = (key: string) => string | null | undefined;

const SORT_FIELDS: IncidentListSortField[] = [
  "incident_no", "priority", "status", "customer", "construction_stage", "created_at", "updated_at",
];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function clean(v: string | null | undefined): string | undefined {
  const s = (v ?? "").trim();
  return s === "" ? undefined : s;
}

export function parseIncidentListQuery(get: ParamGetter): IncidentListQuery {
  const status = clean(get("status"));
  const priority = clean(get("priority"));
  const images = clean(get("images"));
  const activity = clean(get("activity"));
  const dateFrom = clean(get("from"));
  const dateTo = clean(get("to"));
  // AP13: „hat offene Aufgabe" (offen = 'open' oder 'in_progress').
  const openTask = clean(get("offen"));
  // AP15-b: Fehlalarm-Statusfilter. "1" = nur Fehlalarme, "0" = nur echte
  // Vorgaenge, fehlend/anderer Wert = kein Filter (beide Werte, wie bisher).
  const falseAlarm = clean(get("fehlalarm"));

  const filters: IncidentListFilters = {
    q: clean(get("q")),
    status: status && (INCIDENT_STATUS as readonly string[]).includes(status) ? (status as IncidentStatus) : undefined,
    priority: priority && (PRIORITIES as readonly string[]).includes(priority) ? (priority as Priority) : undefined,
    customer_id: clean(get("customer")),
    stage_id: clean(get("stage")),
    vzg_line_id: clean(get("vzg")),
    on_call_number_id: clean(get("oncall")),
    monteur_id: clean(get("monteur")),
    created_by: clean(get("creator")),
    date_from: dateFrom && ISO_DATE.test(dateFrom) ? dateFrom : undefined,
    date_to: dateTo && ISO_DATE.test(dateTo) ? dateTo : undefined,
    images: images === "with" || images === "without" ? (images as IncidentImagesFilter) : undefined,
    activity: activity === "active" || activity === "closed" ? (activity as IncidentActivity) : undefined,
    hasOpenTask: openTask === "1" ? true : undefined,
    falseAlarm: falseAlarm === "1" ? true : falseAlarm === "0" ? false : undefined,
  };

  const sort: IncidentListSort = [];
  const rawSort = clean(get("sort"));
  if (rawSort) {
    for (const part of rawSort.split(",")) {
      const [field, dir] = part.split(":");
      if ((SORT_FIELDS as string[]).includes(field) && (dir === "asc" || dir === "desc")) {
        if (!sort.some((s) => s.field === field)) sort.push({ field: field as IncidentListSortField, dir });
      }
    }
  }

  const page = Math.max(1, parseInt(clean(get("page")) ?? "1", 10) || 1);
  const rawSize = parseInt(clean(get("size")) ?? "50", 10);
  const pageSize = (INCIDENT_PAGE_SIZES as readonly number[]).includes(rawSize) ? rawSize : 50;

  return { filters, sort, page, pageSize };
}

export function buildIncidentListParams(query: IncidentListQuery): URLSearchParams {
  const p = new URLSearchParams();
  const f = query.filters;
  const set = (k: string, v: string | undefined) => {
    if (v) p.set(k, v);
  };
  set("q", f.q);
  set("status", f.status);
  set("priority", f.priority);
  set("customer", f.customer_id);
  set("stage", f.stage_id);
  set("vzg", f.vzg_line_id);
  set("oncall", f.on_call_number_id);
  set("monteur", f.monteur_id);
  set("creator", f.created_by);
  set("from", f.date_from);
  set("to", f.date_to);
  set("images", f.images && f.images !== "all" ? f.images : undefined);
  set("activity", f.activity && f.activity !== "all" ? f.activity : undefined);
  set("offen", f.hasOpenTask ? "1" : undefined);
  set("fehlalarm", f.falseAlarm === true ? "1" : f.falseAlarm === false ? "0" : undefined);
  if (query.sort.length) p.set("sort", query.sort.map((s) => `${s.field}:${s.dir}`).join(","));
  if (query.page > 1) p.set("page", String(query.page));
  if (query.pageSize !== 50) p.set("size", String(query.pageSize));
  return p;
}

export function buildIncidentListQueryString(query: IncidentListQuery): string {
  return buildIncidentListParams(query).toString();
}
