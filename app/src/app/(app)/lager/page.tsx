import { requireSession } from "@/lib/auth";
import { NoAccess } from "@/components/Placeholder";
import { listLocations } from "@/lib/inventory";
import { LocationsClient } from "@/components/inventory/LocationsClient";

export const dynamic = "force-dynamic";

export default async function LagerPage() {
  const session = await requireSession();
  if (session.role !== "admin") return <NoAccess />;

  const locations = await listLocations();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Lagerorte</h1>
      <LocationsClient locations={locations} />
    </div>
  );
}
