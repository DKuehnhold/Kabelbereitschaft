import { requireSession } from "@/lib/auth";
import { NoAccess } from "@/components/Placeholder";
import { PageHeader } from "@/components/ui/primitives";
import { listOnCallNumbers } from "@/lib/masterdata";
import { OnCallNumbersClient } from "@/components/masterdata/OnCallNumbersClient";

export const dynamic = "force-dynamic";

export default async function BereitschaftsnummernPage() {
  const session = await requireSession();
  if (session.role !== "admin" && session.role !== "disponent") return <NoAccess />;
  const rows = await listOnCallNumbers();
  return (
    <div className="space-y-4">
      <PageHeader title="Bereitschaftsnummern" subtitle="Operative Rufnummern für Bereitschaftsvorgänge verwalten." />
      <OnCallNumbersClient rows={rows} />
    </div>
  );
}
