import { AppShell } from "@/components/AppShell";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  return (
    <AppShell role={session.role} fullName={session.fullName}>
      {children}
    </AppShell>
  );
}
