import { requireSession } from "@/lib/auth";
import { Placeholder, NoAccess } from "@/components/Placeholder";
import type { UserRole } from "@/lib/roles";

const ALLOWED: UserRole[] = ["admin", "disponent", "monteur"];

export default async function Page() {
  const session = await requireSession();
  if (!ALLOWED.includes(session.role)) return <NoAccess />;
  return (
    <Placeholder
      title="Material"
      intro="Materialstammdaten und Bestände. Monteure entnehmen/geben Material vorgangs- und lagerbezogen zurück; Bestände nur über Bewegungen."
      planned="Geplant für Arbeitspaket 3 (Material & Bestände)."
    />
  );
}
