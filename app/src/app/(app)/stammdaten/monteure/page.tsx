import { requireSession } from "@/lib/auth";
import { NoAccess } from "@/components/Placeholder";
import { PageHeader } from "@/components/ui/primitives";
import { listTechnicians, listProfileOptions } from "@/lib/masterdata";
import { TechniciansClient } from "@/components/masterdata/TechniciansClient";

export const dynamic = "force-dynamic";

export default async function MonteurePage() {
  const session = await requireSession();
  if (session.role !== "admin" && session.role !== "disponent") return <NoAccess />;
  const [technicians, profileOptions] = await Promise.all([listTechnicians(), listProfileOptions()]);
  return (
    <div className="space-y-4">
      <PageHeader title="Monteure" subtitle="Monteur-Stammdaten mit optionalem CSV-Import." />
      <TechniciansClient technicians={technicians} profileOptions={profileOptions} />
    </div>
  );
}
