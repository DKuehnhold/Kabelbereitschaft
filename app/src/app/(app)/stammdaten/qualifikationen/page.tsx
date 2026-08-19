import { requireSession } from "@/lib/auth";
import { NoAccess } from "@/components/Placeholder";
import { PageHeader } from "@/components/ui/primitives";
import { listQualifications } from "@/lib/masterdata";
import { QualificationsClient } from "@/components/masterdata/QualificationsClient";

export const dynamic = "force-dynamic";

// AUFTRAG_14: Pflegeseite "Qualifikationen" - exaktes Muster der
// 0019-Kataloge (siehe stammdaten/gewerke/page.tsx). Bewusst KEINE
// Startwerte im Katalog (0022_hlk_dispo_board.sql) - die Liste kann beim
// ersten Aufruf leer sein.
export default async function QualifikationenPage() {
  const session = await requireSession();
  if (session.role !== "admin" && session.role !== "disponent") return <NoAccess />;
  const qualifications = await listQualifications();
  return (
    <div className="space-y-4">
      <PageHeader
        title="Qualifikationen"
        subtitle="Rangfolge und Farbe je Qualifikation - die höchste Qualifikation eines Monteurs bestimmt seine Farbe im Dispo-Board."
      />
      <QualificationsClient qualifications={qualifications} />
    </div>
  );
}
