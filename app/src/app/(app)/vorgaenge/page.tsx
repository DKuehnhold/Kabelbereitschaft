import { requireSession } from "@/lib/auth";
import { Placeholder, NoAccess } from "@/components/Placeholder";
import type { UserRole } from "@/lib/roles";

const ALLOWED: UserRole[] = ["admin", "disponent"];

export default async function Page() {
  const session = await requireSession();
  if (!ALLOWED.includes(session.role)) return <NoAccess />;
  return (
    <Placeholder
      title="Vorgänge"
      intro="Übersicht aller Bereitschaftsvorgänge mit Filtern nach Status, Baustufe, Monteur und Zeitraum."
      planned="Geplant für Arbeitspaket 2 (Vorgangsübersicht, Detailansicht mit Chronik, Filter)."
    />
  );
}
