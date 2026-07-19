import { requireSession } from "@/lib/auth";
import { Placeholder, NoAccess } from "@/components/Placeholder";
import type { UserRole } from "@/lib/roles";

const ALLOWED: UserRole[] = ["admin"];

export default async function Page() {
  const session = await requireSession();
  if (!ALLOWED.includes(session.role)) return <NoAccess />;
  return (
    <Placeholder
      title="Lagerorte"
      intro="Verwaltung der Lagerorte (Zentrallager, Fahrzeuglager, Baustellenlager, Materialcontainer, temporäres Lager) inkl. Anfangsbeständen und Korrekturbuchungen."
      planned="Geplant für Arbeitspaket 3 (Lagerverwaltung)."
    />
  );
}
