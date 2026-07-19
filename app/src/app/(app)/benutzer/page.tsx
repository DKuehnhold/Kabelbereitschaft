import { requireSession } from "@/lib/auth";
import { Placeholder, NoAccess } from "@/components/Placeholder";
import type { UserRole } from "@/lib/roles";

const ALLOWED: UserRole[] = ["admin"];

export default async function Page() {
  const session = await requireSession();
  if (!ALLOWED.includes(session.role)) return <NoAccess />;
  return (
    <Placeholder
      title="Benutzer"
      intro="Benutzer- und Rollenverwaltung (Administrator, Disponent, Monteur), Aktivierung/Deaktivierung."
      planned="Geplant für Arbeitspaket 2 (Benutzerverwaltung); Anlage vorerst über Supabase Auth."
    />
  );
}
