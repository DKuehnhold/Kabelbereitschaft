import { requireSession } from "@/lib/auth";
import { NoAccess } from "@/components/Placeholder";
import { listMovements } from "@/lib/inventory";
import { MovementsClient } from "@/components/inventory/MovementsClient";

export const dynamic = "force-dynamic";

export default async function MaterialhistoriePage() {
  const session = await requireSession();
  if (session.role === "monteur") return <NoAccess />;

  const movements = await listMovements();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Materialhistorie</h1>
      <MovementsClient movements={movements} />
    </div>
  );
}
