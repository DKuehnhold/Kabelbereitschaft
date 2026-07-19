import { requireSession } from "@/lib/auth";
import { NoAccess } from "@/components/Placeholder";
import { listMaterials } from "@/lib/inventory";
import { MaterialsClient } from "@/components/inventory/MaterialsClient";

export const dynamic = "force-dynamic";

export default async function MaterialPage() {
  const session = await requireSession();
  if (session.role !== "admin") return <NoAccess />;

  const materials = await listMaterials();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Materialstammdaten</h1>
      <MaterialsClient materials={materials} />
    </div>
  );
}
