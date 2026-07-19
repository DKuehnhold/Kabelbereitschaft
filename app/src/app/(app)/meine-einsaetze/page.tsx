import { requireSession } from "@/lib/auth";
import { NoAccess } from "@/components/Placeholder";
import { listIncidents } from "@/lib/incidents";
import { isOpenStatus } from "@/lib/status";
import { EinsatzListe } from "@/components/incidents/EinsatzListe";

export const dynamic = "force-dynamic";

export default async function MeineEinsaetzePage() {
  const session = await requireSession();
  if (session.role !== "monteur" && session.role !== "admin") {
    // Disponenten nutzen die Vorgangsübersicht
    return <NoAccess />;
  }
  const rows = await listIncidents();
  const offen = rows.filter((r) => isOpenStatus(r.status));
  const erledigt = rows.filter((r) => !isOpenStatus(r.status));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Meine Einsätze</h1>
      <div>
        <h2 className="mb-2 text-lg font-semibold text-slate-800">Offen</h2>
        <EinsatzListe rows={offen} />
      </div>
      {erledigt.length ? (
        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-800">Abgeschlossen</h2>
          <EinsatzListe rows={erledigt} />
        </div>
      ) : null}
    </div>
  );
}
