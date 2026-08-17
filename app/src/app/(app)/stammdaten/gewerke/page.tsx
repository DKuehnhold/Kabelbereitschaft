import { requireSession } from "@/lib/auth";
import { NoAccess } from "@/components/Placeholder";
import { PageHeader } from "@/components/ui/primitives";
import { listTrades } from "@/lib/masterdata";
import { TradesClient } from "@/components/masterdata/TradesClient";

export const dynamic = "force-dynamic";

export default async function GewerkePage() {
  const session = await requireSession();
  if (session.role !== "admin" && session.role !== "disponent") return <NoAccess />;
  const trades = await listTrades();
  return (
    <div className="space-y-4">
      <PageHeader title="Gewerke" subtitle="Referenzliste der Gewerke." />
      <TradesClient trades={trades} />
    </div>
  );
}
