import { getSessionProfile } from "@/lib/auth";
import { withUserTransaction } from "@/lib/db";
import {
  addDaysToIsoDate,
  daysInMonthIso,
  isIsoCalendarDate,
  mondayOfWeekBerlinIso,
  monthStartIso,
  startOfMonthBerlinIso,
} from "@/lib/date-local";

// =====================================================================
// AUFTRAG_10 – Bereitschaftsplan (Einsatzplanung): Lesepfad.
//
// Wer hat wann je Bauabschnitt Bereitschaft - pflegbar in einer
// Wochenansicht. Grundlage ist die Excel-Matrix "Einsatzplanung"
// (Bauabschnitt x Kalendertag mit Mitarbeitern): Zeilen sind die AKTIVEN
// Bauabschnitte, Spalten sind Montag bis Sonntag mit Datum, Zellen sind die
// zugewiesenen Techniker. Diese Datei liefert die Rohdaten fuer genau diese
// Matrix; das Gruppieren nach Bauabschnitt x Tag geschieht in der
// UI-Komponente (dieselbe Aufteilung wie bei den uebrigen Lesepfaden aus
// masterdata.ts: die Reads liefern flache Zeilen, die Komponente formt sie).
//
// AP14/B-Muster wie jeder Read seit masterdata.ts: die Identitaet stammt
// ausschliesslich aus der serverseitig geprueften Auth.js-Sitzung; fehlt sie,
// wird kein SQL ausgefuehrt. Ein echter Datenbankfehler wird NICHT gefangen -
// ein fehlendes Tabellenrecht muss laut scheitern.
// =====================================================================

export type OnCallStageOption = {
  id: string;
  code: string | null;
  name: string;
};

// AUFTRAG_14: Zuweisungsart, wortgetreu wie der Check-Constraint
// on_call_plan_assignment_kind_chk (0022_hlk_dispo_board.sql). 'dispo' ist
// die neue Zeile "Dispo/Bereitschaftstelefon" (Punkt 14 des Auftrags) -
// construction_stage_id ist dafuer NULL.
export type OnCallAssignmentKind = "bereitschaft" | "dispo";

export type OnCallPlanEntry = {
  id: string;
  /** NULL bei assignment_kind = 'dispo' (Migration 0022, construction_stage_id nullable). */
  construction_stage_id: string | null;
  plan_date: string;
  technician_id: string;
  technician_name: string;
  assignment_kind: OnCallAssignmentKind;
};

export type OnCallWeek = {
  /** Montag der Woche (Europe/Berlin), "YYYY-MM-DD". */
  weekStart: string;
  /** Genau sieben Kalendertage Montag..Sonntag, "YYYY-MM-DD". */
  days: string[];
  /** Aktive Bauabschnitte, alphabetisch – die Zeilen der Matrix. */
  stages: OnCallStageOption[];
  /** Alle Zuweisungen innerhalb der sieben Tage, unabhaengig vom Bauabschnittsstatus. */
  entries: OnCallPlanEntry[];
};

/**
 * AUFTRAG_14: Monatsansicht. `weeks` liefert vollstaendige Montag-Sonntag-
 * Wochen, die den gesamten Kalendermonat abdecken (Fuehrungs-/Folgetage aus
 * dem Vor-/Folgemonat inklusive, wie in einer Kalendermatrix ueblich) -
 * `inMonth` markiert je Tag, ob er zum angeforderten Monat gehoert.
 */
export type OnCallMonth = {
  /** Erster Kalendertag "YYYY-MM-01" des Monats (Europe/Berlin). */
  monthStart: string;
  /** Vollstaendige Wochen (Montag..Sonntag) als Tage-Arrays. */
  weeks: string[][];
  /** Kalendertage, die tatsaechlich zum Monat gehoeren (fuer inMonth-Markierung). */
  daysInMonth: string[];
  stages: OnCallStageOption[];
  entries: OnCallPlanEntry[];
};

function emptyWeek(weekStart: string): OnCallWeek {
  const days = Array.from({ length: 7 }, (_, i) => addDaysToIsoDate(weekStart, i));
  return { weekStart, days, stages: [], entries: [] };
}

const LIST_ACTIVE_STAGES_SQL = `
  select id, code, name
    from public.construction_stages
   where is_active
   order by name asc`;

const LIST_WEEK_ENTRIES_SQL = `
  select p.id, p.construction_stage_id, p.plan_date::text as plan_date, p.technician_id,
         t.first_name, t.last_name, p.assignment_kind
    from public.on_call_plan p
    join public.technicians t on t.id = p.technician_id
   where p.plan_date >= $1::date and p.plan_date < ($1::date + 7)
   order by p.plan_date asc, t.last_name asc, t.first_name asc`;

const LIST_RANGE_ENTRIES_SQL = `
  select p.id, p.construction_stage_id, p.plan_date::text as plan_date, p.technician_id,
         t.first_name, t.last_name, p.assignment_kind
    from public.on_call_plan p
    join public.technicians t on t.id = p.technician_id
   where p.plan_date >= $1::date and p.plan_date < $2::date
   order by p.plan_date asc, t.last_name asc, t.first_name asc`;

type WeekEntryRow = {
  id: string;
  construction_stage_id: string | null;
  plan_date: string;
  technician_id: string;
  first_name: string;
  last_name: string;
  assignment_kind: OnCallAssignmentKind;
};

function mapEntryRow(r: WeekEntryRow): OnCallPlanEntry {
  return {
    id: r.id,
    construction_stage_id: r.construction_stage_id,
    plan_date: r.plan_date,
    technician_id: r.technician_id,
    technician_name: `${r.first_name} ${r.last_name}`.trim(),
    assignment_kind: r.assignment_kind,
  };
}

/**
 * Sieben Tage ab Montag (Europe/Berlin, DST-fest über date-local.ts) der
 * Woche, die `weekStartIso` enthaelt.
 *
 * `weekStartIso` muss KEIN Montag sein: ein beliebiges Datum innerhalb der
 * gewuenschten Woche wird auf ihren Montag normalisiert (Vor-/Zurueck-
 * Navigation reicht deshalb ±7 Tage weiter, ohne selbst wissen zu muessen,
 * welcher Wochentag das Ergebnis ist). Ein unbrauchbarer Wert liefert
 * fail-closed die leere Woche ab dem heutigen Montag - kein SQL mit einem
 * Eingabewert, der keine kanonische Kalenderdatumszeichenkette ist.
 */
export async function listOnCallWeek(weekStartIso: string): Promise<OnCallWeek> {
  const normalized = isIsoCalendarDate(weekStartIso)
    ? mondayOfWeekBerlinIso(new Date(`${weekStartIso}T12:00:00Z`))
    : mondayOfWeekBerlinIso();

  const session = await getSessionProfile();
  if (!session) return emptyWeek(normalized);

  return withUserTransaction(session.userId, async (client) => {
    const [stagesResult, entriesResult] = await Promise.all([
      client.query<OnCallStageOption>(LIST_ACTIVE_STAGES_SQL),
      client.query<WeekEntryRow>(LIST_WEEK_ENTRIES_SQL, [normalized]),
    ]);

    const days = Array.from({ length: 7 }, (_, i) => addDaysToIsoDate(normalized, i));
    const entries: OnCallPlanEntry[] = entriesResult.rows.map(mapEntryRow);

    return { weekStart: normalized, days, stages: stagesResult.rows, entries };
  });
}

/**
 * AUFTRAG_14 – Monatsansicht: vollstaendige Kalendermatrix des Monats, der
 * `monthStartIso_` enthaelt (Fuehrungs-/Folgetage aus dem Vor-/Folgemonat
 * eingeschlossen, wie in einer Kalendermatrix ueblich - Punkt 11 des
 * Auftrags "Kalendermatrix des Monats"). `monthStartIso_` muss KEIN
 * Monatsanfang sein (wird normalisiert); ein unbrauchbarer Wert liefert
 * fail-closed den leeren aktuellen Monat.
 */
export async function listOnCallMonth(monthStartIso_: string): Promise<OnCallMonth> {
  const normalized = isIsoCalendarDate(monthStartIso_)
    ? monthStartIso(monthStartIso_)
    : startOfMonthBerlinIso();

  const monthDays = daysInMonthIso(normalized);
  const firstWeekMonday = mondayOfWeekBerlinIso(new Date(`${monthDays[0]}T12:00:00Z`));
  const lastWeekMonday = mondayOfWeekBerlinIso(
    new Date(`${monthDays[monthDays.length - 1]}T12:00:00Z`),
  );
  const gridStart = firstWeekMonday;
  const gridEnd = addDaysToIsoDate(lastWeekMonday, 7); // exklusiv - Ende der letzten sichtbaren Woche
  const totalDays = Math.round(
    (new Date(`${gridEnd}T00:00:00Z`).getTime() - new Date(`${gridStart}T00:00:00Z`).getTime()) /
      86400000,
  );
  const allDays = Array.from({ length: totalDays }, (_, i) => addDaysToIsoDate(gridStart, i));
  const weeks: string[][] = [];
  for (let i = 0; i < allDays.length; i += 7) weeks.push(allDays.slice(i, i + 7));

  const session = await getSessionProfile();
  if (!session) {
    return { monthStart: normalized, weeks, daysInMonth: monthDays, stages: [], entries: [] };
  }

  return withUserTransaction(session.userId, async (client) => {
    const [stagesResult, entriesResult] = await Promise.all([
      client.query<OnCallStageOption>(LIST_ACTIVE_STAGES_SQL),
      client.query<WeekEntryRow>(LIST_RANGE_ENTRIES_SQL, [gridStart, gridEnd]),
    ]);
    const entries: OnCallPlanEntry[] = entriesResult.rows.map(mapEntryRow);
    return { monthStart: normalized, weeks, daysInMonth: monthDays, stages: stagesResult.rows, entries };
  });
}
