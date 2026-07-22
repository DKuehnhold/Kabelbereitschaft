import { requireSession } from "@/lib/auth";
import { NoAccess } from "@/components/Placeholder";
import { PageHeader } from "@/components/ui/primitives";
import { getAppSettings, getActiveCustomers, getActiveOnCallOptions } from "@/lib/masterdata";
import { SettingsClient } from "@/components/masterdata/SettingsClient";

export const dynamic = "force-dynamic";

export default async function EinstellungenPage() {
  const session = await requireSession();
  if (session.role !== "admin" && session.role !== "disponent") return <NoAccess />;
  const [settings, customers, onCallOptions] = await Promise.all([
    getAppSettings(),
    getActiveCustomers(),
    getActiveOnCallOptions(),
  ]);
  return (
    <div className="space-y-4">
      <PageHeader title="Einstellungen" subtitle="Standardkunde und Standard-Bereitschaftsnummer." />
      <SettingsClient settings={settings} customers={customers} onCallOptions={onCallOptions} />
    </div>
  );
}
