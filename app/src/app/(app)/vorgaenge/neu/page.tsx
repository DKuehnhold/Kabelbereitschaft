import { requireSession } from "@/lib/auth";
import { Placeholder, NoAccess } from "@/components/Placeholder";
import type { UserRole } from "@/lib/roles";

const ALLOWED: UserRole[] = ["admin", "disponent"];

export default async function Page() {
  const session = await requireSession();
  if (!ALLOWED.includes(session.role)) return <NoAccess />;
  return (
    <Placeholder
      title="Vorgang anlegen"
      intro="Neuen Bereitschaftsvorgang erfassen: Anrufzeitpunkt, Bereitschaftsnummer, Ansprechpartner, Baustufe, Standort (VzG, Streckenkilometer) und Monteurzuweisung."
      planned="Geplant für Arbeitspaket 2 (Vorgangserfassung durch Disposition)."
    />
  );
}
