import { requireSession } from "@/lib/auth";
import { NoAccess } from "@/components/Placeholder";
import { PageHeader } from "@/components/ui/primitives";
import { listTeams, getActiveTechnicians } from "@/lib/masterdata";
import { TeamsClient } from "@/components/masterdata/TeamsClient";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const session = await requireSession();
  if (session.role !== "admin" && session.role !== "disponent") return <NoAccess />;
  const [teams, technicians] = await Promise.all([listTeams(), getActiveTechnicians()]);
  const technicianOptions = technicians.map((t) => ({ id: t.id, label: `${t.last_name}, ${t.first_name}` }));
  return (
    <div className="space-y-4">
      <PageHeader title="Teams" subtitle="Teams und Mitglieder (Mehrfachmitgliedschaft möglich)." />
      <TeamsClient teams={teams} technicianOptions={technicianOptions} />
    </div>
  );
}
