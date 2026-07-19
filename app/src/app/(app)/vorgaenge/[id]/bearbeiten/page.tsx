import { requireSession } from "@/lib/auth";
import { NoAccess } from "@/components/Placeholder";
import { getIncidentDetail, getStages, getOnCallNumbers } from "@/lib/incidents";
import { EditIncidentForm } from "@/components/incidents/EditIncidentForm";

export const dynamic = "force-dynamic";

export default async function EditIncidentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  if (session.role === "monteur") return <NoAccess />;

  const [detail, stages, oncall] = await Promise.all([
    getIncidentDetail(id),
    getStages(),
    getOnCallNumbers(),
  ]);
  if (!detail) return <NoAccess />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Vorgang #{detail.incident.incident_no} bearbeiten</h1>
      <EditIncidentForm
        incident={detail.incident}
        stages={stages.map((s) => ({ id: s.id, label: s.code ? `${s.code} – ${s.name}` : s.name }))}
        oncall={oncall.map((o) => ({ id: o.id, label: o.label ? `${o.number} – ${o.label}` : o.number }))}
      />
    </div>
  );
}
