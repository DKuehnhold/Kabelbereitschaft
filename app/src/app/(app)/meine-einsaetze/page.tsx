import { requireSession } from "@/lib/auth";
import { Placeholder, NoAccess } from "@/components/Placeholder";
import type { UserRole } from "@/lib/roles";

const ALLOWED: UserRole[] = ["monteur"];

export default async function Page() {
  const session = await requireSession();
  if (!ALLOWED.includes(session.role)) return <NoAccess />;
  return (
    <Placeholder
      title="Meine Einsätze"
      intro="Nur die dem angemeldeten Monteur zugewiesenen Vorgänge – mit Statuswechsel, Zustandsbewertung, Dokumentation, Bildern und Materialbuchungen."
      planned="Geplant für Arbeitspaket 2/3 (Monteuransicht)."
    />
  );
}
