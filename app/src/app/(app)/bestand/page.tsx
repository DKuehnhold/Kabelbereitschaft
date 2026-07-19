import { requireSession } from "@/lib/auth";
import { getStock, getActiveMaterials, getActiveLocations, type MaterialRow, type LocationRow } from "@/lib/inventory";
import { StockClient } from "@/components/inventory/StockClient";

export const dynamic = "force-dynamic";

export default async function BestandPage() {
  const session = await requireSession();
  const isAdmin = session.role === "admin";

  const [stock, materials, locations] = await Promise.all([
    getStock(),
    isAdmin ? getActiveMaterials() : Promise.resolve<MaterialRow[]>([]),
    isAdmin ? getActiveLocations() : Promise.resolve<LocationRow[]>([]),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Bestandsübersicht</h1>
      <p className="text-sm text-slate-500">
        Bestände werden ausschließlich aus den Materialbewegungen berechnet (View „material_stock“).
      </p>
      <StockClient stock={stock} isAdmin={isAdmin} materials={materials} locations={locations} />
    </div>
  );
}
