import { requireSession } from "@/lib/auth";
import { NoAccess } from "@/components/Placeholder";
import { PageHeader } from "@/components/ui/primitives";
import { getIncidentFormOptions } from "@/lib/incidents";
import { NewIncidentForm } from "@/components/incidents/NewIncidentForm";

export const dynamic = "force-dynamic";

export default async function NeuerVorgangPage() {
  const session = await requireSession();
  if (session.role === "monteur") return <NoAccess />;

  const options = await getIncidentFormOptions();
  const missing: string[] = [];
  if (options.customers.length === 0) missing.push("Kunden");
  if (options.stages.length === 0) missing.push("Bauabschnitte");
  if (options.vzgLines.length === 0) missing.push("VzG-Strecken");
  if (options.cableTypes.length === 0) missing.push("Kabelarten");

  return (
    <div className="space-y-4">
      <PageHeader title="Vorgang anlegen" subtitle="Neue Vorgänge auf Basis der Stammdaten (AP9)." />
      {missing.length > 0 ? (
        <div
          role="alert"
          className="rounded-md border px-4 py-3 text-sm"
          style={{ background: "var(--warning-bg)", color: "var(--warning)", borderColor: "var(--warning)" }}
        >
          Hinweis: Es fehlen aktive Stammdaten ({missing.join(", ")}). Bitte zuerst im Bereich Stammdaten pflegen,
          damit die Pflichtauswahl möglich ist.
        </div>
      ) : null}
      <NewIncidentForm options={options} />
    </div>
  );
}
