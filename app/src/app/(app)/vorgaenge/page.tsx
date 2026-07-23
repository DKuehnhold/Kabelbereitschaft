import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { NoAccess } from "@/components/Placeholder";
import { PageHeader } from "@/components/ui/primitives";
import { listIncidentsPaged, getIncidentListFilterOptions } from "@/lib/incidents";
import { parseIncidentListQuery } from "@/lib/incident-list-url";
import { OperationalList } from "@/components/incidents/list/OperationalList";

export const dynamic = "force-dynamic";

export default async function VorgaengePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  if (session.role === "monteur") return <NoAccess />;

  const sp = await searchParams;
  const get = (k: string): string | null => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] ?? null : v ?? null;
  };
  const query = parseIncidentListQuery(get);

  const [result, options] = await Promise.all([
    listIncidentsPaged(query),
    getIncidentListFilterOptions(),
  ]);

  const effQuery = { ...query, page: result.page, pageSize: result.pageSize };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Vorgänge"
        subtitle="Operative Arbeitsliste"
        actions={<Link href="/vorgaenge/neu" className="btn btn-primary">+ Vorgang anlegen</Link>}
      />
      <OperationalList
        rows={result.rows}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        query={effQuery}
        options={options}
      />
    </div>
  );
}
