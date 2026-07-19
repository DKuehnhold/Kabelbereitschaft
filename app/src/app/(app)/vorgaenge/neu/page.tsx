import { requireSession } from "@/lib/auth";
import { NoAccess } from "@/components/Placeholder";
import { getStages, getOnCallNumbers } from "@/lib/incidents";
import { NewIncidentForm } from "@/components/incidents/NewIncidentForm";

export const dynamic = "force-dynamic";

export default async function NeuerVorgangPage() {
  const session = await requireSession();
  if (session.role === "monteur") return <NoAccess />;

  const [stages, oncall] = await Promise.all([getStages(), getOnCallNumbers()]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Vorgang anlegen</h1>
      {stages.length === 0 || oncall.length === 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Hinweis: Es sind noch keine {stages.length === 0 ? "Baustufen" : ""}
          {stages.length === 0 && oncall.length === 0 ? " und " : ""}
          {oncall.length === 0 ? "Bereitschaftsnummern" : ""} hinterlegt. Bitte zuerst als
          Administrator anlegen (Stammdaten), damit die Pflichtauswahl möglich ist.
        </div>
      ) : null}
      <NewIncidentForm
        stages={stages.map((s) => ({ id: s.id, label: s.code ? `${s.code} – ${s.name}` : s.name }))}
        oncall={oncall.map((o) => ({ id: o.id, label: o.label ? `${o.number} – ${o.label}` : o.number }))}
      />
    </div>
  );
}
