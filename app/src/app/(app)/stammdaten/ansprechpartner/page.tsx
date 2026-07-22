import { requireSession } from "@/lib/auth";
import { NoAccess } from "@/components/Placeholder";
import { PageHeader } from "@/components/ui/primitives";
import { listContacts, getActiveCustomers, getActiveStageOptions } from "@/lib/masterdata";
import { ContactsClient } from "@/components/masterdata/ContactsClient";

export const dynamic = "force-dynamic";

export default async function AnsprechpartnerPage() {
  const session = await requireSession();
  if (session.role !== "admin" && session.role !== "disponent") return <NoAccess />;
  const [contacts, customers, stageOptions] = await Promise.all([
    listContacts(),
    getActiveCustomers(),
    getActiveStageOptions(),
  ]);
  return (
    <div className="space-y-4">
      <PageHeader title="Ansprechpartner" subtitle="Kontakte je Kunde inkl. Telefonnummern und Bauabschnitts-Zuordnung." />
      <ContactsClient contacts={contacts} customers={customers} stageOptions={stageOptions} />
    </div>
  );
}
