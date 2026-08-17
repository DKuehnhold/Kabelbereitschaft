import { requireSession } from "@/lib/auth";
import { NoAccess } from "@/components/Placeholder";
import { PageHeader } from "@/components/ui/primitives";
import { listContactFunctions } from "@/lib/masterdata";
import { ContactFunctionsClient } from "@/components/masterdata/ContactFunctionsClient";

export const dynamic = "force-dynamic";

export default async function FunktionenPage() {
  const session = await requireSession();
  if (session.role !== "admin" && session.role !== "disponent") return <NoAccess />;
  const functions = await listContactFunctions();
  return (
    <div className="space-y-4">
      <PageHeader title="Funktionen" subtitle="Referenzliste der Funktionen des Anrufenden/Ansprechpartners." />
      <ContactFunctionsClient functions={functions} />
    </div>
  );
}
