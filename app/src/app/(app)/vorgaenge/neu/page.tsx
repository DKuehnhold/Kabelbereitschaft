import { requireSession } from "@/lib/auth";
import { NoAccess } from "@/components/Placeholder";
import { PageHeader } from "@/components/ui/primitives";
import { Button } from "@/components/ui/shadcn/button";
import { getIncidentFormOptions } from "@/lib/incidents";
import { NewIncidentForm, NEW_INCIDENT_FORM_ID } from "@/components/incidents/NewIncidentForm";

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
      <PageHeader
        title="Neue Meldung"
        subtitle="Neue Vorgänge auf Basis der Stammdaten (AP9)."
        actions={
          // AUFTRAG_5, Punkt 1: Primäraktion zusätzlich oben rechts, nur ab md
          // sichtbar (auf Mobil übernimmt die unten fixierte Leiste in
          // NewIncidentForm die alleinige Primäraktion). Bindung an das <form>
          // in NewIncidentForm über das native HTML5-`form`-Attribut (keine
          // Client-Interaktivität in dieser Server-Komponente nötig).
          <Button key="submit-top" type="submit" form={NEW_INCIDENT_FORM_ID} className="hidden h-11 px-6 md:inline-flex">
            Meldung anlegen
          </Button>
        }
      />
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
