import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui/primitives";
import { listOnCallWeek } from "@/lib/on-call-plan";
import { getActiveTechnicians } from "@/lib/masterdata";
import { OnCallPlanClient } from "@/components/on-call-plan/OnCallPlanClient";
import { isIsoCalendarDate, mondayOfWeekBerlinIso } from "@/lib/date-local";

export const dynamic = "force-dynamic";

// AUFTRAG_10: Bereitschaftsplan (Einsatzplanung) - Wochenansicht wie die
// Excel-Matrix "Einsatzplanung". Fuer ALLE Rollen sichtbar (Navigation in
// roles.ts): der Monteur sieht den Plan read-only, Staff (admin, disponent)
// bedient ihn. Die Sichtbarkeit der Bedienelemente kommt allein aus `canEdit`
// unten (echtes Weglassen, kein Verstecken per CSS); die Durchsetzung selbst
// laeuft ueber RLS (0021_hlk_bereitschaftsplan.sql) und die
// Staff-Allowlist in on-call-plan-actions.ts.
export default async function BereitschaftsplanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const wocheParam = sp.woche;
  const wocheValue = Array.isArray(wocheParam) ? wocheParam[0] : wocheParam;
  const weekStart =
    wocheValue && isIsoCalendarDate(wocheValue) ? wocheValue : mondayOfWeekBerlinIso();

  const [week, technicians] = await Promise.all([
    listOnCallWeek(weekStart),
    getActiveTechnicians(),
  ]);

  const canEdit = session.role === "admin" || session.role === "disponent";
  const technicianOptions = technicians.map((t) => ({
    id: t.id,
    label: `${t.first_name} ${t.last_name}`,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bereitschaftsplan"
        subtitle="Wer hat wann je Bauabschnitt Bereitschaft."
      />
      <OnCallPlanClient week={week} technicianOptions={technicianOptions} canEdit={canEdit} />
    </div>
  );
}
