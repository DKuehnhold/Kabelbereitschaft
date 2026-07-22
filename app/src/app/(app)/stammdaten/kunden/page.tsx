import { requireSession } from "@/lib/auth";
import { NoAccess } from "@/components/Placeholder";
import { PageHeader } from "@/components/ui/primitives";
import { listCustomers } from "@/lib/masterdata";
import { CustomersClient } from "@/components/masterdata/CustomersClient";

export const dynamic = "force-dynamic";

export default async function KundenPage() {
  const session = await requireSession();
  if (session.role !== "admin" && session.role !== "disponent") return <NoAccess />;
  const customers = await listCustomers();
  return (
    <div className="space-y-4">
      <PageHeader title="Kunden" subtitle="Stammdaten der Auftraggeber (intern)." />
      <CustomersClient customers={customers} />
    </div>
  );
}
