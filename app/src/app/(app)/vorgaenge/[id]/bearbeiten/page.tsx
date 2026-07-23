import { requireSession } from "@/lib/auth";
import { NoAccess } from "@/components/Placeholder";
import { PageHeader } from "@/components/ui/primitives";
import { getIncidentDetail, getIncidentFormOptions } from "@/lib/incidents";
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

  const [detail, options] = await Promise.all([getIncidentDetail(id), getIncidentFormOptions()]);
  if (!detail) return <NoAccess />;

  return (
    <div className="space-y-4">
      <PageHeader title={`Vorgang #${detail.incident.incident_no} bearbeiten`} />
      <EditIncidentForm incident={detail.incident} options={options} />
    </div>
  );
}
