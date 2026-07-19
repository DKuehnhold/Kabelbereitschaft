import { requireSession } from "@/lib/auth";
import { NoAccess } from "@/components/Placeholder";
import { listIncidents, getStages, getMonteure } from "@/lib/incidents";
import { IncidentsTable } from "@/components/incidents/IncidentsTable";
import type { UserRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

const ALLOWED: UserRole[] = ["admin"];

export default async function Page() {
  const session = await requireSession();
  if (!ALLOWED.includes(session.role)) return <NoAccess />;

  const [rows, stages, monteure] = await Promise.all([
    listIncidents(),
    getStages(),
    getMonteure(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Export</h1>
        <p className="mt-1 text-sm text-slate-500">
          CSV-Export der Vorgangsübersicht (UTF-8 mit BOM, Semikolon-getrennt für deutsche
          Tabellenprogramme, mit Schutz gegen Formel-Injektion). Filter setzen und den
          CSV-Export starten – exportiert werden ausschließlich die gefilterten Vorgänge.
        </p>
      </div>
      <IncidentsTable
        rows={rows}
        stages={stages.map((s) => ({ id: s.id, label: s.name }))}
        monteurOptions={monteure.map((m) => ({ id: m.id, label: m.full_name ?? "—" }))}
      />
    </div>
  );
}
