import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui/primitives";
import { listOnCallWeek, listOnCallMonth } from "@/lib/on-call-plan";
import { getActiveTechniciansWithColor } from "@/lib/masterdata";
import { OnCallPlanClient } from "@/components/on-call-plan/OnCallPlanClient";
import { isIsoCalendarDate, mondayOfWeekBerlinIso, startOfMonthBerlinIso } from "@/lib/date-local";

export const dynamic = "force-dynamic";

// AUFTRAG_10/AUFTRAG_14: Dispo-Board - Wochen- ODER Monatsansicht (Umschalter,
// Punkt 11 des Auftrags) mit rechter Monteurliste (farbig nach höchster
// Qualifikation, Punkt 3/12) und einer eigenen Zeile "Dispo/Bereitschafts-
// telefon" (Punkt 14). Fuer ALLE Rollen sichtbar (Navigation in roles.ts):
// der Monteur sieht read-only, Staff (admin, disponent) bedient. Die
// Sichtbarkeit der Bedienelemente kommt allein aus `canEdit` (echtes
// Weglassen, kein Verstecken per CSS); die Durchsetzung selbst laeuft ueber
// RLS (0021/0022) und die Staff-Allowlist in on-call-plan-actions.ts.
export default async function BereitschaftsplanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const ansichtValue = first(sp.ansicht);
  const view: "woche" | "monat" = ansichtValue === "monat" ? "monat" : "woche";

  const wocheValue = first(sp.woche);
  const weekStart = wocheValue && isIsoCalendarDate(wocheValue) ? wocheValue : mondayOfWeekBerlinIso();

  const monatValue = first(sp.monat);
  const monthStart = monatValue && isIsoCalendarDate(monatValue) ? monatValue : startOfMonthBerlinIso();

  const [week, month, technicians] = await Promise.all([
    view === "woche" ? listOnCallWeek(weekStart) : Promise.resolve(null),
    view === "monat" ? listOnCallMonth(monthStart) : Promise.resolve(null),
    getActiveTechniciansWithColor(),
  ]);

  const canEdit = session.role === "admin" || session.role === "disponent";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bereitschaftsplan"
        subtitle="Wer hat wann je Bauabschnitt Bereitschaft - und wer besetzt die Dispo/das Bereitschaftstelefon."
      />
      <OnCallPlanClient
        view={view}
        week={week}
        month={month}
        technicians={technicians}
        canEdit={canEdit}
      />
    </div>
  );
}
