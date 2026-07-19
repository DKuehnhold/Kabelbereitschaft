import { MOVEMENT_TYPE_LABELS } from "@/lib/status";
import type { MovementRow, MaterialRow, LocationRow } from "@/lib/inventory";
import { MonteurMaterialActions } from "./MonteurMaterialActions";

function fmt(dt: string): string {
  return new Date(dt).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

// Berechnet Bewegungen automatisch aus inventory_movements (keine eigene Tabelle).
export function IncidentMaterialCard({
  incidentId,
  movements,
  canBook,
  materials,
  locations,
}: {
  incidentId: string;
  movements: MovementRow[];
  canBook: boolean;
  materials: MaterialRow[];
  locations: LocationRow[];
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">Material</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Material</th><th className="px-3 py-2">Menge</th>
              <th className="px-3 py-2">Lager</th><th className="px-3 py-2">Zeit</th>
              <th className="px-3 py-2">Monteur</th><th className="px-3 py-2">Bewegungstyp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {movements.map((m) => (
              <tr key={m.id}>
                <td className="px-3 py-2 text-slate-800">{m.material?.name ?? "—"}</td>
                <td className="px-3 py-2 text-slate-700">{m.quantity} {m.unit}</td>
                <td className="px-3 py-2 text-slate-600">{m.source?.name ?? m.target?.name ?? "—"}</td>
                <td className="px-3 py-2 text-slate-500">{fmt(m.created_at)}</td>
                <td className="px-3 py-2 text-slate-600">{m.created_by_name}</td>
                <td className="px-3 py-2 text-slate-700">{MOVEMENT_TYPE_LABELS[m.movement_type]}</td>
              </tr>
            ))}
            {movements.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-400">Noch keine Materialbewegungen.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {canBook ? (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <MonteurMaterialActions incidentId={incidentId} materials={materials} locations={locations} />
        </div>
      ) : null}
    </section>
  );
}
