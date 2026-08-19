"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { isUuid, withUserTransaction } from "@/lib/db";
import { isPgError, PG_UNIQUE_VIOLATION } from "@/lib/db/pg-errors";
import { addDaysToIsoDate, isIsoCalendarDate } from "@/lib/date-local";
import type { UserRole } from "@/lib/roles";
import { MAX_RANGE_DAYS } from "@/lib/on-call-plan-limits";

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
 * Audit-Trigger protokolliert das delete vollstaendig. Gilt unveraendert fuer
 * BEIDE Zuweisungsarten (AUFTRAG_14): eine Dispo-Zuweisung ist technisch
 * dieselbe Tabellenzeile wie eine Bereitschaftszuweisung.
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

// =====================================================================
// AUFTRAG_14 – Dispo-Board: die Zeile "Dispo/Bereitschaftstelefon"
// (assignment_kind = 'dispo', construction_stage_id NULL, 0022_hlk_dispo_
// board.sql) sowie die Verschiebe-Operation zwischen zwei Zellen.
// =====================================================================

/**
 * Eine Dispo-Zuweisung anlegen ("Dispo/Bereitschaftstelefon"-Zeile,
 * Punkt 14 des Auftrags). Gegenstueck zu assignOnCall() oben, aber ohne
 * Bauabschnitt (construction_stage_id bleibt NULL) - erzwungen zusaetzlich
 * durch on_call_plan_stage_kind_chk in der Datenbank. Die Unique-Bedingung
 * fuer diese Art (on_call_plan_dispo_uq) verhindert die doppelte Besetzung
 * derselben Person am selben Tag.
 */
export async function assignDispo(
  dateIso: string,
  technicianId: string,
): Promise<OnCallPlanActionResult> {
  const session = await getSessionProfile();
  if (!session || !STAFF_ALLOWED_ROLES.includes(session.role)) {
    return { ok: false, error: STAFF_ONLY };
  }
  if (!isUuid(technicianId) || !isIsoCalendarDate(dateIso)) {
    return { ok: false, error: SAVE_FAILED };
  }

  try {
    await withUserTransaction(session.userId, async (client) => {
      await client.query(
        `insert into public.on_call_plan (construction_stage_id, plan_date, technician_id, assignment_kind)
         values (null, $1::date, $2::uuid, 'dispo')`,
        [dateIso, technicianId],
      );
    });
  } catch (error) {
    logDbFailure("Dispo-Zuweisung anlegen", error);
    if (isPgError(error, PG_UNIQUE_VIOLATION)) {
      return { ok: false, error: "Dieser Techniker besetzt an diesem Tag bereits die Dispo/das Bereitschaftstelefon." };
    }
    return { ok: false, error: SAVE_FAILED };
  }

  revalidatePlan();
  return { ok: true, error: null };
}

/** Ziel einer Verschiebung (Drag & Drop bzw. Klick-Ebene) - eine bestehende Zelle. */
export type OnCallMoveTarget =
  | { kind: "bereitschaft"; stageId: string; dateIso: string }
  | { kind: "dispo"; dateIso: string };

/**
 * Eine bestehende Zuweisung auf eine andere Zelle verschieben (Drag & Drop
 * ODER die Klick-Rueckfallebene, Punkt 4 des Auftrags) - IMMER als delete +
 * insert in EINER Transaktion (Auftragstext AUFTRAG_14: "Verschieben einer
 * Zuweisung = EINE Transaktion"). withUserTransaction() fuehrt beide
 * Anweisungen ueber dieselbe Verbindung im selben BEGIN/COMMIT aus - schlaegt
 * der insert fehl (z. B. Unique-Verletzung auf der Zielzelle), nimmt COMMIT
 * die Verbindung nie an und der vorangegangene delete wird automatisch mit
 * zurueckgerollt; es entsteht nie ein Zwischenzustand ohne die alte UND ohne
 * die neue Zuweisung.
 */
export async function moveOnCallEntry(
  entryId: string,
  target: OnCallMoveTarget,
): Promise<OnCallPlanActionResult> {
  const session = await getSessionProfile();
  if (!session || !STAFF_ALLOWED_ROLES.includes(session.role)) {
    return { ok: false, error: STAFF_ONLY };
  }
  if (!isUuid(entryId) || !isIsoCalendarDate(target.dateIso)) {
    return { ok: false, error: SAVE_FAILED };
  }
  if (target.kind === "bereitschaft" && !isUuid(target.stageId)) {
    return { ok: false, error: SAVE_FAILED };
  }

  try {
    await withUserTransaction(session.userId, async (client) => {
      const existing = await client.query<{ technician_id: string }>(
        `select technician_id from public.on_call_plan where id = $1::uuid`,
        [entryId],
      );
      const technicianId = existing.rows[0]?.technician_id;
      if (!technicianId) {
        throw new Error("Verschieben fehlgeschlagen: Zuweisung nicht gefunden.");
      }

      await client.query(`delete from public.on_call_plan where id = $1::uuid`, [entryId]);

      if (target.kind === "dispo") {
        await client.query(
          `insert into public.on_call_plan (construction_stage_id, plan_date, technician_id, assignment_kind)
           values (null, $1::date, $2::uuid, 'dispo')`,
          [target.dateIso, technicianId],
        );
      } else {
        await client.query(
          `insert into public.on_call_plan (construction_stage_id, plan_date, technician_id, assignment_kind)
           values ($1::uuid, $2::date, $3::uuid, 'bereitschaft')`,
          [target.stageId, target.dateIso, technicianId],
        );
      }
    });
  } catch (error) {
    logDbFailure("Zuweisung verschieben", error);
    if (isPgError(error, PG_UNIQUE_VIOLATION)) {
      return { ok: false, error: "Dieser Techniker ist auf der Zielzelle bereits eingeteilt." };
    }
    return { ok: false, error: SAVE_FAILED };
  }

  revalidatePlan();
  return { ok: true, error: null };
}

// =====================================================================
// AUFTRAG_18 – Dispo-Board: Zuweisung ueber einen zusammenhaengenden
// Zeitraum ("von-bis"-Dialog, Entscheidung Dennis 2026-08-18). Ergaenzt die
// bestehenden tagweisen Actions oben - assignOnCall/assignDispo/
// moveOnCallEntry/removeOnCall bleiben in Signatur UND Verhalten
// unveraendert (Negativliste).
// =====================================================================

/** Ziel eines Zeitraums - dieselbe fachliche Unterscheidung wie
 * OnCallMoveTarget oben, aber OHNE dateIso: der Zeitraum traegt fromIso/
 * toIso als eigene Parameter (siehe assignOnCallRange). */
export type OnCallRangeTarget =
  | { kind: "bereitschaft"; stageId: string }
  | { kind: "dispo" };

/** Ergebnis von assignOnCallRange() - erweitert OnCallPlanActionResult um
 * die Anzahl ANGELEGTER und UEBERSPRUNGENER Tage (Punkt 7/8 des Auftrags).
 * Beide Zusatzfelder sind OPTIONAL: der bestehende Ergebnistyp
 * OnCallPlanActionResult und damit assignOnCall/assignDispo/
 * moveOnCallEntry/removeOnCall bleiben unveraendert (Negativliste
 * AUFTRAG_18 verbietet, deren Verhalten oder Signatur zu aendern). */
export type OnCallPlanRangeResult = OnCallPlanActionResult & {
  createdCount?: number;
  skippedCount?: number;
};

// MAX_RANGE_DAYS (92 Tage, ein Quartal) liegt seit AUFTRAG_24 in
// on-call-plan-limits.ts und wird von hier importiert: eine
// "use server"-Datei darf ausschliesslich `export async function`- und
// Typ-Exporte tragen, ein direkter Wert-Export der Konstanten an dieser
// Stelle wuerde Turbopack veranlassen, ALLE Exporte dieses Moduls zu
// verwerfen (Build-Fehler "Only async functions are allowed to be exported
// in a 'use server' file").
// DIESELBE Zahl wird in OnCallPlanClient.tsx importiert und fuer die
// clientseitige Fruehwarnung VOR diesem Serverschritt verwendet - es gibt
// bewusst nur diese EINE Quelle, keinen zweiten, unabhaengig gepflegten
// Zahlenwert.

const RANGE_ORDER_ERROR = "Das Bis-Datum darf nicht vor dem Von-Datum liegen.";
const RANGE_TOO_LONG_ERROR =
  `Der Zeitraum darf höchstens ${MAX_RANGE_DAYS} Tage umfassen (Schutz gegen einen Tippfehler im Jahr).`;

/**
 * Anzahl Kalendertage von `fromIso` bis `toIso` EINSCHLIESSLICH beider Enden.
 * Bricht fruehzeitig ab, sobald `limit` ueberschritten ist - kein
 * unbegrenztes Hochzaehlen bei einem grob falschen Datum (z. B. einem Jahr
 * Differenz); der Rueckgabewert ist dann nur noch verlaesslich als "> limit"
 * zu lesen, nicht mehr als exakte Tagesanzahl.
 */
function countDaysInclusive(fromIso: string, toIso: string, limit: number): number {
  let count = 1;
  let cursor = fromIso;
  while (cursor < toIso) {
    cursor = addDaysToIsoDate(cursor, 1);
    count += 1;
    if (count > limit) return count;
  }
  return count;
}

/**
 * Eine Zuweisung ueber einen zusammenhaengenden Zeitraum [fromIso, toIso]
 * anlegen (Punkt 7 des Auftrags, Gegenstueck zum "von-bis"-Dialog in
 * OnCallPlanClient.tsx). Dieselbe Rollen-Allowlist und dieselben
 * Eingabepruefungen wie assignOnCall/assignDispo (STAFF_ALLOWED_ROLES,
 * isUuid, isIsoCalendarDate) - kein eigener, abweichender Pruefpfad.
 *
 * Die Oberflaeche prueft "Bis vor Von" und die 92-Tage-Grenze bereits selbst
 * (fruehes, sachliches Feedback im Dialog); BEIDE Grenzen werden hier
 * serverseitig WIEDERHOLT, weil die Oberflaeche keine Sicherung ist.
 *
 * EINE withUserTransaction() traegt alle Tage; je Tag ein
 * "insert ... on conflict ... do nothing" auf den passenden PARTIELLEN
 * Unique-Index aus 0022_hlk_dispo_board.sql (on_call_plan_dispo_uq bzw.
 * on_call_plan_bereitschaft_uq, siehe Kommentar dort Zeilen ~245-254) - ein
 * am jeweiligen Tag bereits vorhandener Eintrag wird dadurch UEBERSPRUNGEN
 * statt die gesamte Transaktion mit einer 23505-Verletzung abzubrechen.
 * `on conflict (SPALTEN) where <PRAEDIKAT>` muss dafuer EXAKT Spalten UND
 * Praedikat des jeweiligen partiellen Index treffen (PostgreSQL-Regel zur
 * Arbiter-Inferenz bei partiellen Unique-Indizes) - deshalb zwei getrennte
 * Formulierungen statt einer gemeinsamen.
 *
 * Rueckgabe zaehlt angelegte und uebersprungene Tage getrennt (Punkt 8:
 * "5 Tage eingeplant, 2 Tage waren bereits vergeben").
 */
export async function assignOnCallRange(
  target: OnCallRangeTarget,
  fromIso: string,
  toIso: string,
  technicianId: string,
): Promise<OnCallPlanRangeResult> {
  const session = await getSessionProfile();
  if (!session || !STAFF_ALLOWED_ROLES.includes(session.role)) {
    return { ok: false, error: STAFF_ONLY };
  }
  if (!isUuid(technicianId) || !isIsoCalendarDate(fromIso) || !isIsoCalendarDate(toIso)) {
    return { ok: false, error: SAVE_FAILED };
  }
  if (target.kind === "bereitschaft" && !isUuid(target.stageId)) {
    return { ok: false, error: SAVE_FAILED };
  }
  // Punkt 3: ein Bis vor dem Von ist unzulaessig - serverseitige Wiederholung
  // der clientseitigen Pruefung, die Oberflaeche ist keine Sicherung.
  if (toIso < fromIso) {
    return { ok: false, error: RANGE_ORDER_ERROR };
  }
  // Punkt 4: Obergrenze 92 Tage - ebenfalls serverseitig wiederholt.
  if (countDaysInclusive(fromIso, toIso, MAX_RANGE_DAYS) > MAX_RANGE_DAYS) {
    return { ok: false, error: RANGE_TOO_LONG_ERROR };
  }

  let createdCount = 0;
  let skippedCount = 0;

  try {
    await withUserTransaction(session.userId, async (client) => {
      let cursor = fromIso;
      for (;;) {
        const result = target.kind === "dispo"
          ? await client.query(
              `insert into public.on_call_plan (construction_stage_id, plan_date, technician_id, assignment_kind)
               values (null, $1::date, $2::uuid, 'dispo')
               on conflict (plan_date, technician_id) where assignment_kind = 'dispo' do nothing`,
              [cursor, technicianId],
            )
          : await client.query(
              `insert into public.on_call_plan (construction_stage_id, plan_date, technician_id, assignment_kind)
               values ($1::uuid, $2::date, $3::uuid, 'bereitschaft')
               on conflict (construction_stage_id, plan_date, technician_id) where assignment_kind = 'bereitschaft' do nothing`,
              [target.stageId, cursor, technicianId],
            );
        if ((result.rowCount ?? 0) > 0) {
          createdCount += 1;
        } else {
          skippedCount += 1;
        }
        if (cursor === toIso) break;
        cursor = addDaysToIsoDate(cursor, 1);
      }
    });
  } catch (error) {
    logDbFailure("Zeitraum-Zuweisung anlegen", error);
    return { ok: false, error: SAVE_FAILED };
  }

  revalidatePlan();
  return { ok: true, error: null, createdCount, skippedCount };
}
