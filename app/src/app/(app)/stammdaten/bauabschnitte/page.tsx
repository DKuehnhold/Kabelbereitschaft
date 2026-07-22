import { requireSession } from "@/lib/auth";
import { NoAccess } from "@/components/Placeholder";
import { PageHeader } from "@/components/ui/primitives";
import { listStages, getActiveOnCallOptions } from "@/lib/masterdata";
import { StagesClient } from "@/components/masterdata/StagesClient";

export const dynamic = "force-dynamic";

export default async function BauabschnittePage() {
  const session = await requireSession();
  if (session.role !== "admin" && session.role !== "disponent") return <NoAccess />;
  const [stages, onCallOptions] = await Promise.all([listStages(), getActiveOnCallOptions()]);
  return (
    <div className="space-y-4">
      <PageHeader title="Bauabschnitte" subtitle="Baustufen inkl. WUS-BST und Standard-Bereitschaftsnummer." />
      <StagesClient stages={stages} onCallOptions={onCallOptions} />
    </div>
  );
}
