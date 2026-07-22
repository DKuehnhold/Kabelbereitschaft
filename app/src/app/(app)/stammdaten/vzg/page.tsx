import { requireSession } from "@/lib/auth";
import { NoAccess } from "@/components/Placeholder";
import { PageHeader } from "@/components/ui/primitives";
import { listVzgLines, getActiveStageOptions } from "@/lib/masterdata";
import { VzgLinesClient } from "@/components/masterdata/VzgLinesClient";

export const dynamic = "force-dynamic";

export default async function VzgPage() {
  const session = await requireSession();
  if (session.role !== "admin" && session.role !== "disponent") return <NoAccess />;
  const [lines, stageOptions] = await Promise.all([listVzgLines(), getActiveStageOptions()]);
  return (
    <div className="space-y-4">
      <PageHeader title="VzG-Strecken" subtitle="Vierstellige Streckennummern je Bauabschnitt." />
      <VzgLinesClient lines={lines} stageOptions={stageOptions} />
    </div>
  );
}
