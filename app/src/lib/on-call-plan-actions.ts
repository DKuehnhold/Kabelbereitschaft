"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { isUuid, withUserTransaction } from "@/lib/db";
import { isPgError, PG_UNIQUE_VIOLATION } from "@/lib/db/pg-errors";
import { isIsoCalendarDate } from "@/lib/date-local";
import type { UserRole } from "@/lib/roles";

// =====================================================================
// AUFTRAG_10 – Bereitschaftsplan (Einsatzplanung): Schreibpfad.
//
// Schreiben (anlegen UND entfernen) darf ausschliesslich Staff (admin,
// disponent) - der Monteur sieht den Plan read-only. Das wird hier
// serverseitig geprueft (STAFF_ALLOWED_ROLES, exaktes Muster von
// incident-list-actions.ts) und in der Datenbank zusaetzlich durch die
// RLS-Policies on_call_plan_insert/on_call_plan_delete erzwungen (0021).
//
// AP14/B-Muster: jede Aktion laeuft ueber withUserTransaction() mit der
// Identitaet aus der geprueften Auth.js-Sitzung. Kennungen aus dem Aufruf
// werden vor dem SQL mit isUuid()/isIsoCalendarDate() geprueft; ist eine
// Kennung unbrauchbar, wird kein SQL ausgefuehrt. In den SQL-Text gelangt
// kein Eingabewert - alle Werte sind Parameter ($1, $2, …).
//
// Eine Datenbankmeldung gelangt nie in ein Aktionsergebnis (verbindliche
// Regel aus @/lib/db/pg-errors): klassifiziert wird ausschliesslich ueber
// den SQLSTATE, die Originalmeldung geht allein ins Serverprotokoll.
// =====================================================================

// Exaktes Muster von STAFF_ALLOWED_ROLES in incident-list-actions.ts: eine
// benannte, schreibgeschuetzte Liste statt eines wiederholten
// `role === "admin" || role === "disponent"` an jeder Aufrufstelle - eine
// kuenftige neue Rolle ist damit nicht automatisch berechtigt.
const STAFF_ALLOWED_ROLES: readonly UserRole[] = ["admin", "disponent"];

const STAFF_ONLY = "Nur Administration und Disposition dürfen den Bereitschaftsplan bearbeiten.";
const SAVE_FAILED = "Speichern fehlgeschlagen: unerwarteter Datenbankfehler.";
const DUPLICATE_ERROR = "Dieser Techniker ist für diesen Bauabschnitt an diesem Tag bereits eingeteilt.";

export type OnCallPlanActionResult = { ok: boolean; error: string | null };

/** Serverseitige Protokollierung ohne Weitergabe der Datenbankmeldung. */
function logDbFailure(action: string, error: unknown): void {
  console.error(
    `${action} fehlgeschlagen`,
    error instanceof Error ? error.message : "unbekannter Fehler",
  );
}

function revalidatePlan(): void {
  revalidatePath("/bereitschaftsplan");
}

/**
 * Eine Bereitschafts-Zuweisung anlegen (Staff-only, RLS erzwingt es
 * zusaetzlich). Mehrere Personen je Bauabschnitt/Tag sind zulaessig (wie in
 * der Excel-Matrix); nur die exakt DOPPELTE Zuweisung derselben Person am
 * selben Tag/Bauabschnitt wird von der Unique-Bedingung
 * (0021_hlk_bereitschaftsplan.sql) mit 23505 abgewiesen und hier freundlich
 * gemeldet.
 */
export async function assignOnCall(
  stageId: string,
  dateIso: string,
  technicianId: string,
): Promise<OnCallPlanActionResult> {
  const session = await getSessionProfile();
  if (!session || !STAFF_ALLOWED_ROLES.includes(session.role)) {
    return { ok: false, error: STAFF_ONLY };
  }
  if (!isUuid(stageId) || !isUuid(technicianId) || !isIsoCalendarDate(dateIso)) {
    return { ok: false, error: SAVE_FAILED };
  }

  try {
    await withUserTransaction(session.userId, async (client) => {
      await client.query(
        `insert into public.on_call_plan (construction_stage_id, plan_date, technician_id)
         values ($1::uuid, $2::date, $3::uuid)`,
        [stageId, dateIso, technicianId],
      );
    });
  } catch (error) {
    logDbFailure("Bereitschaftszuweisung anlegen", error);
    if (isPgError(error, PG_UNIQUE_VIOLATION)) {
      return { ok: false, error: DUPLICATE_ERROR };
    }
    return { ok: false, error: SAVE_FAILED };
  }

  revalidatePlan();
  return { ok: true, error: null };
}

/**
 * Eine Bereitschafts-Zuweisung entfernen (Staff-only, RLS erzwingt es
 * zusaetzlich). Zuweisungen werden ENTFERNT statt deaktiviert (Entscheidung
 * laut AUFTRAG_10, begruendet in 0021_hlk_bereitschaftsplan.sql) - der
 * Audit-Trigger protokolliert das delete vollstaendig.
 */
export async function removeOnCall(entryId: string): Promise<OnCallPlanActionResult> {
  const session = await getSessionProfile();
  if (!session || !STAFF_ALLOWED_ROLES.includes(session.role)) {
    return { ok: false, error: STAFF_ONLY };
  }
  if (!isUuid(entryId)) {
    return { ok: false, error: SAVE_FAILED };
  }

  try {
    await withUserTransaction(session.userId, async (client) => {
      await client.query(`delete from public.on_call_plan where id = $1::uuid`, [entryId]);
    });
  } catch (error) {
    logDbFailure("Bereitschaftszuweisung entfernen", error);
    return { ok: false, error: SAVE_FAILED };
  }

  revalidatePlan();
  return { ok: true, error: null };
}
