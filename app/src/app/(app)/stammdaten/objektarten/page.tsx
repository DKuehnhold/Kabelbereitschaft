import { requireSession } from "@/lib/auth";
import { NoAccess } from "@/components/Placeholder";
import { PageHeader } from "@/components/ui/primitives";
import { listObjectTypes } from "@/lib/masterdata";
import { ObjectTypesClient } from "@/components/masterdata/ObjectTypesClient";

export const dynamic = "force-dynamic";

export default async function ObjektartenPage() {
  const session = await requireSession();
  if (session.role !== "admin" && session.role !== "disponent") return <NoAccess />;
  const objectTypes = await listObjectTypes();
  return (
    <div className="space-y-4">
      <PageHeader title="Objektarten" subtitle="Referenzliste der Objektarten (Anlagen, inkl. LST-Elemente)." />
      <ObjectTypesClient objectTypes={objectTypes} />
    </div>
  );
}
