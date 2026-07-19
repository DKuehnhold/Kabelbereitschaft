import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { NoAccess } from "@/components/Placeholder";
import { listIncidents, getStages, getMonteure } from "@/lib/incidents";
import { IncidentsTable } from "@/components/incidents/IncidentsTable";

export const dynamic = "force-dynamic";

export default async function VorgaengePage() {
  const session = await requireSession();
  if (session.role === "monteur") return <NoAccess />;

  const [rows, stages, monteure] = await Promise.all([
    listIncidents(),
    getStages(),
    getMonteure(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Vorgänge</h1>
        <Link
          href="/vorgaenge/neu"
          className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          + Vorgang anlegen
        </Link>
      </div>
      <IncidentsTable
        rows={rows}
        stages={stages.map((s) => ({ id: s.id, label: s.name }))}
        monteurOptions={monteure.map((m) => ({ id: m.id, label: m.full_name ?? "—" }))}
      />
    </div>
  );
}
