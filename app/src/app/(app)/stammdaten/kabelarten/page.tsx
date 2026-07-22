import { requireSession } from "@/lib/auth";
import { NoAccess } from "@/components/Placeholder";
import { PageHeader } from "@/components/ui/primitives";
import { listCableTypes } from "@/lib/masterdata";
import { CableTypesClient } from "@/components/masterdata/CableTypesClient";

export const dynamic = "force-dynamic";

export default async function KabelartenPage() {
  const session = await requireSession();
  if (session.role !== "admin" && session.role !== "disponent") return <NoAccess />;
  const cableTypes = await listCableTypes();
  return (
    <div className="space-y-4">
      <PageHeader title="Kabelarten" subtitle="Referenzliste der Kabelarten inkl. Unbekannt." />
      <CableTypesClient cableTypes={cableTypes} />
    </div>
  );
}
