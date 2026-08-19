import { requireSession } from "@/lib/auth";
import { NoAccess } from "@/components/Placeholder";
import { PageHeader } from "@/components/ui/primitives";
import {
  listTechnicians, listProfileOptions,
  listQualifications, listTechnicianQualificationLinks,
} from "@/lib/masterdata";
import { TechniciansClient } from "@/components/masterdata/TechniciansClient";

export const dynamic = "force-dynamic";

export default async function MonteurePage() {
  const session = await requireSession();
  if (session.role !== "admin" && session.role !== "disponent") return <NoAccess />;
  // AUFTRAG_14: Qualifikations-Zuordnung (Mehrfachauswahl) auf derselben
  // Seite - Katalog und die flachen Zuordnungspaare, gruppiert im Client.
  const [technicians, profileOptions, qualifications, links] = await Promise.all([
    listTechnicians(), listProfileOptions(), listQualifications(), listTechnicianQualificationLinks(),
  ]);
  const qualificationIdsByTechnician: Record<string, string[]> = {};
  for (const link of links) {
    (qualificationIdsByTechnician[link.technician_id] ??= []).push(link.qualification_id);
  }
  return (
    <div className="space-y-4">
      <PageHeader title="Monteure" subtitle="Monteur-Stammdaten mit optionalem CSV-Import." />
      <TechniciansClient
        technicians={technicians}
        profileOptions={profileOptions}
        qualifications={qualifications}
        qualificationIdsByTechnician={qualificationIdsByTechnician}
      />
    </div>
  );
}
