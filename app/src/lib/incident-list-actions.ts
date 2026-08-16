"use server";

import { revalidatePath } from "next/cache";
import { withUserTransaction } from "@/lib/db";
import { getSessionProfile } from "@/lib/auth";
import type { UserRole } from "@/lib/roles";
import { listIncidentsForExport, listIncidentsForFullExport } from "@/lib/incidents";
import {
  INCIDENT_BULK_LIMIT,
  mergeCableArts,
  type IncidentBulkAssignItem,
  type IncidentBulkItem,
  type IncidentBulkResult,
  type IncidentListQuery,
  type IncidentListRow,
} from "@/lib/incident-list";
import { INCIDENT_STATUS, STATUS_LABELS, type IncidentStatus } from "@/lib/status";
import { PRIORITY_LABELS } from "@/lib/priority";
import { buildCsv, CSV_BOM } from "@/lib/csv";
import type { IncidentBulkActionResult } from "@/lib/database.types";

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

const STAFF_ONLY_BULK = "Massenaktionen sind der Disposition/Administration vorbehalten.";
const EXPORT_STAFF_ONLY_ERROR = "Export ist der Disposition/Administration vorbehalten.";

// AP15-b/F10: positive Allow-Liste statt der bisherigen Negativliste
// (`!session || session.role === "monteur"`). Erlaubt bleiben genau die heute
// erlaubten Rollen (`admin`, `disponent`); das Verhalten fuer alle heute
// existierenden Rollen (siehe UserRole in roles.ts, aktuell genau drei:
// admin/disponent/monteur) bleibt damit identisch, kuenftige neue Rollen sind
// aber nicht mehr automatisch berechtigt. Gleiches Vorbild wie requireStaff()
// in inventory-actions.ts (F1-Korrektur). Von beiden Exportfunktionen UND den
// beiden Massenaktionen (bulkUpdateIncidentStatus, bulkAssignIncidentMonteur)
// gemeinsam genutzt.
const STAFF_ALLOWED_ROLES: readonly UserRole[] = ["admin", "disponent"];

/** Serverseitige Protokollierung ohne Weitergabe der Datenbankmeldung. */
function logExportFailure(error: unknown): void {
  console.error("Export fehlgeschlagen", error instanceof Error ? error.message : "unbekannter Fehler");
}

// Gemeinsame CSV-Spalten für den interaktiven und den Vollmengen-Export
// (AP15-b: "Fehlalarm" ergänzt die bisherigen Spalten additiv am Ende).
const EXPORT_HEADERS = [
  "Vorgangsnummer", "Status", "Priorität", "Kunde", "Bauabschnitt", "VzG", "Betriebsstelle",
  "Kilometer", "Bereitschaftsnummer", "Kabelarten", "Erstellt am", "Zuletzt geändert",
  "Monteure", "Bildanzahl", "Offene Aufgabe", "Fehlalarm",
];

function exportRow(r: IncidentListRow): unknown[] {
  return [
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
    r.has_open_task ? "Ja" : "Nein",
    r.is_false_alarm ? "Ja" : "Nein",
  ];
}

// Vollständige gefilterte Treffermenge (aktuelle Filter + Sortierung, ohne Pagination).
// RLS greift über die security_invoker-View; keine Service-Role, kein Audit.
// Obergrenze INCIDENT_EXPORT_CAP (5000, siehe listIncidentsForExport) - für
// größere Treffermengen siehe exportIncidentListFull.
export async function exportIncidentList(
  query: IncidentListQuery,
): Promise<{ csv: string; count: number; capped: boolean; error: string | null }> {
  const session = await getSessionProfile();
  if (!session || !STAFF_ALLOWED_ROLES.includes(session.role)) {
    return { csv: "", count: 0, capped: false, error: EXPORT_STAFF_ONLY_ERROR };
  }

  try {
    const { rows, capped } = await listIncidentsForExport(query);
    const data = rows.map(exportRow);
    return { csv: CSV_BOM + buildCsv(EXPORT_HEADERS, data), count: rows.length, capped, error: null };
  } catch (error) {
    logExportFailure(error);
    return { csv: "", count: 0, capped: false, error: "Der Export ist fehlgeschlagen. Bitte erneut versuchen." };
  }
}

// AP15-b: Vollmengen-Export-Pfad. Dieselben Spalten und dieselbe
// Rollenprüfung wie exportIncidentList, aber mit der höheren Obergrenze
// INCIDENT_FULL_EXPORT_CAP (20000, siehe listIncidentsForFullExport). Die
// interaktive UI (exportIncidentList) bleibt bei 5000 unverändert - dieser
// Pfad ist additiv für Fälle, in denen die volle Treffermenge (z. B.
// Monats-/Quartalsauszug) benötigt wird.
export async function exportIncidentListFull(
  query: IncidentListQuery,
): Promise<{ csv: string; count: number; capped: boolean; error: string | null }> {
  const session = await getSessionProfile();
  if (!session || !STAFF_ALLOWED_ROLES.includes(session.role)) {
    return { csv: "", count: 0, capped: false, error: EXPORT_STAFF_ONLY_ERROR };
  }

  try {
    const { rows, capped } = await listIncidentsForFullExport(query);
    const data = rows.map(exportRow);
    return { csv: CSV_BOM + buildCsv(EXPORT_HEADERS, data), count: rows.length, capped, error: null };
  } catch (error) {
    logExportFailure(error);
    return { csv: "", count: 0, capped: false, error: "Der Export ist fehlgeschlagen. Bitte erneut versuchen." };
  }
}

// =====================================================================
// AP13: Massenaktionen über die Bulk-RPCs (SECURITY INVOKER, ein äußerer
// Aufruf mit abgefangener Subtransaktion je Eintrag). Guards, Audit und
// Statuschronik greifen unverändert über die bestehenden Trigger.
//
// AP14/B: Aufruf über withUserTransaction() mit der Identität aus der
// serverseitig geprüften Sitzung. Die Datenbankmeldung wird ausschließlich
// serverseitig zur Klassifizierung ausgewertet (mapBulkError) und gelangt nie
// in ein Aktionsergebnis.
// =====================================================================
function mapBulkError(message?: string): string {
  if (!message) return "Die Massenaktion ist fehlgeschlagen.";
  if (/maximal 200|begrenzt/i.test(message))
    return `Massenaktionen sind auf ${INCIDENT_BULK_LIMIT} Vorgänge begrenzt.`;
  if (/Nur Staff|row-level security|permission denied|42501/i.test(message))
    return "Keine Berechtigung für Massenaktionen.";
  if (/JSON-Array|22023/i.test(message)) return "Die Auswahl konnte nicht verarbeitet werden.";
  return "Die Massenaktion ist fehlgeschlagen. Bitte Auswahl prüfen und erneut versuchen.";
}

function summarize(rows: IncidentBulkActionResult[]): IncidentBulkResult {
  return {
    ok: rows.filter((r) => r.ok).length,
    failed: rows.filter((r) => !r.ok).map((r) => ({ id: r.incident_id, code: r.code })),
    error: null,
  };
}

function revalidateLists() {
  revalidatePath("/vorgaenge");
  revalidatePath("/dashboard");
  revalidatePath("/meine-einsaetze");
}

// Vorabprüfung von Auswahl und Obergrenze (die Datenbank prüft erneut).
function guardItems(items: { id: string }[] | null | undefined): string | null {
  if (!Array.isArray(items) || items.length === 0) return "Keine Vorgänge ausgewählt.";
  if (items.length > INCIDENT_BULK_LIMIT)
    return `Massenaktionen sind auf ${INCIDENT_BULK_LIMIT} Vorgänge begrenzt (ausgewählt: ${items.length}).`;
  if (items.some((i) => !i.id)) return "Die Auswahl enthält einen ungültigen Vorgang.";
  return null;
}

export async function bulkUpdateIncidentStatus(
  items: IncidentBulkItem[],
  newStatus: IncidentStatus,
): Promise<IncidentBulkResult> {
  const session = await getSessionProfile();
  if (!session || !STAFF_ALLOWED_ROLES.includes(session.role))
    return { ok: 0, failed: [], error: STAFF_ONLY_BULK };

  const guard = guardItems(items);
  if (guard) return { ok: 0, failed: [], error: guard };
  if (!(INCIDENT_STATUS as readonly string[]).includes(newStatus))
    return { ok: 0, failed: [], error: "Ungültiger Status." };

  const payload: IncidentBulkItem[] = items.map((i) => ({
    id: i.id,
    expected_updated_at: i.expected_updated_at,
  }));

  let rows: IncidentBulkActionResult[];
  try {
    rows = await withUserTransaction(session.userId, async (client) => {
      const res = await client.query<IncidentBulkActionResult>(
        `select incident_id, ok, code
           from public.bulk_update_incident_status_ap13($1::jsonb, $2::public.incident_status)`,
        [JSON.stringify(payload), newStatus],
      );
      return res.rows;
    });
  } catch (error) {
    return {
      ok: 0,
      failed: [],
      error: mapBulkError(error instanceof Error ? error.message : undefined),
    };
  }

  const result = summarize(rows);
  if (result.ok > 0) revalidateLists();
  return result;
}

export async function bulkAssignIncidentMonteur(
  items: IncidentBulkAssignItem[],
  monteurId: string,
): Promise<IncidentBulkResult> {
  const session = await getSessionProfile();
  if (!session || !STAFF_ALLOWED_ROLES.includes(session.role))
    return { ok: 0, failed: [], error: STAFF_ONLY_BULK };

  const guard = guardItems(items);
  if (guard) return { ok: 0, failed: [], error: guard };
  if (!monteurId) return { ok: 0, failed: [], error: "Kein Monteur gewählt." };

  // Jeder Eintrag führt die erwartete sortierte Menge aktiver monteur_ids;
  // Abweichung ergibt datenbankseitig 'conflict'.
  const payload: IncidentBulkAssignItem[] = items.map((i) => ({
    id: i.id,
    expected_updated_at: i.expected_updated_at,
    expected_monteur_ids: (i.expected_monteur_ids ?? []).slice().sort(),
  }));

  let rows: IncidentBulkActionResult[];
  try {
    rows = await withUserTransaction(session.userId, async (client) => {
      const res = await client.query<IncidentBulkActionResult>(
        `select incident_id, ok, code
           from public.bulk_assign_incident_monteur_ap13($1::jsonb, $2::uuid)`,
        [JSON.stringify(payload), monteurId],
      );
      return res.rows;
    });
  } catch (error) {
    return {
      ok: 0,
      failed: [],
      error: mapBulkError(error instanceof Error ? error.message : undefined),
    };
  }

  const result = summarize(rows);
  if (result.ok > 0) revalidateLists();
  return result;
}
