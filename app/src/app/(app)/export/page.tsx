import { requireSession } from "@/lib/auth";
import { Placeholder, NoAccess } from "@/components/Placeholder";
import type { UserRole } from "@/lib/roles";

const ALLOWED: UserRole[] = ["admin"];

export default async function Page() {
  const session = await requireSession();
  if (!ALLOWED.includes(session.role)) return <NoAccess />;
  return (
    <Placeholder
      title="Export"
      intro="CSV-Export der Vorgangsübersicht (UTF-8), optional mit Metadatenkopf."
      planned="Geplant für Arbeitspaket 4 (CSV-Export)."
    />
  );
}
