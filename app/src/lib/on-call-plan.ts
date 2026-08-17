import { getSessionProfile } from "@/lib/auth";
import { withUserTransaction } from "@/lib/db";
import { addDaysToIsoDate, isIsoCalendarDate, mondayOfWeekBerlinIso } from "@/lib/date-local";

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

export type OnCallPlanEntry = {
  id: string;
  construction_stage_id: string;
  plan_date: string;
  technician_id: string;
  technician_name: string;
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
         t.first_name, t.last_name
    from public.on_call_plan p
    join public.technicians t on t.id = p.technician_id
   where p.plan_date >= $1::date and p.plan_date < ($1::date + 7)
   order by p.plan_date asc, t.last_name asc, t.first_name asc`;

type WeekEntryRow = {
  id: string;
  construction_stage_id: string;
  plan_date: string;
  technician_id: string;
  first_name: string;
  last_name: string;
};

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
    const entries: OnCallPlanEntry[] = entriesResult.rows.map((r) => ({
      id: r.id,
      construction_stage_id: r.construction_stage_id,
      plan_date: r.plan_date,
      technician_id: r.technician_id,
      technician_name: `${r.first_name} ${r.last_name}`.trim(),
    }));

    return { weekStart: normalized, days, stages: stagesResult.rows, entries };
  });
}
