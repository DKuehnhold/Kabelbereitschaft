import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { listIncidents, getStages, getMonteure } from "@/lib/incidents";
import { getLowStockMaterials, type LowStockRow } from "@/lib/inventory";
import { getTodaysImageCount } from "@/lib/images-server";
import { isOpenStatus } from "@/lib/status";
import { StatCard } from "@/components/incidents/StatCard";
import { IncidentsTable } from "@/components/incidents/IncidentsTable";
import { EinsatzListe } from "@/components/incidents/EinsatzListe";
import { OfflineDashboardCards } from "@/components/offline/OfflineDashboardCards";

export const dynamic = "force-dynamic";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function DashboardPage() {
  const session = await requireSession();
  const rows = await listIncidents();
  const today = startOfToday();

  if (session.role === "monteur") {
    const offen = rows.filter((r) => isOpenStatus(r.status));
    const technisch = rows.filter((r) => r.status === "technisch_abgeschlossen");
    const heute = rows.filter((r) =>
      r.assignments.some(
        (a) => a.monteur_id === session.userId && new Date(a.assigned_at) >= today,
      ),
    );
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-slate-900">Mein Dashboard</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Meine offenen Einsätze" value={offen.length} accent="blue" />
          <StatCard label="Technisch abgeschlossen" value={technisch.length} accent="green" />
          <StatCard label="Heute übernommen" value={heute.length} accent="indigo" />
        </div>
        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-800">Offline &amp; Synchronisation</h2>
          <OfflineDashboardCards />
        </div>
        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-800">Meine Einsätze</h2>
          <EinsatzListe rows={offen} />
        </div>
      </div>
    );
  }

  // Disposition / Administration
  const isAdmin = session.role === "admin";
  const [stages, monteure, lowStock, imagesToday] = await Promise.all([
    getStages(),
    getMonteure(),
    isAdmin ? getLowStockMaterials() : Promise.resolve<LowStockRow[]>([]),
    getTodaysImageCount(),
  ]);
  const openRows = rows.filter((r) => isOpenStatus(r.status));
  const monteureImEinsatz = new Set(
    openRows.flatMap((r) => r.assignments.filter((a) => a.is_active).map((a) => a.monteur_id)),
  ).size;

  const stats = {
    offen: openRows.length,
    technisch: rows.filter((r) => r.status === "technisch_abgeschlossen").length,
    heute: rows.filter((r) => new Date(r.created_at) >= today).length,
    monteure: monteureImEinsatz,
    wartenDb: rows.filter((r) => r.status === "warten_auf_db").length,
    wartenMaterial: rows.filter((r) => r.status === "warten_auf_material").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <Link
          href="/vorgaenge/neu"
          className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          + Vorgang anlegen
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Offene Vorgänge" value={stats.offen} accent="blue" />
        <StatCard label="Technisch abgeschlossen" value={stats.technisch} accent="green" />
        <StatCard label="Heute erstellt" value={stats.heute} accent="indigo" />
        <StatCard label="Monteure im Einsatz" value={stats.monteure} accent="slate" />
        <StatCard label="Warten auf DB" value={stats.wartenDb} accent="orange" />
        <StatCard label="Warten auf Material" value={stats.wartenMaterial} accent="amber" />
        <StatCard label="Heute hochgeladene Bilder" value={imagesToday} accent="indigo" />
        {isAdmin ? (
          <StatCard label="Material unter Mindestbestand" value={lowStock.length} accent="red" href="/bestand" />
        ) : null}
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold text-slate-800">Offline &amp; Synchronisation</h2>
        <OfflineDashboardCards />
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold text-slate-800">Aktuelle Vorgänge</h2>
        <IncidentsTable
          rows={rows}
          stages={stages.map((s) => ({ id: s.id, label: s.name }))}
          monteurOptions={monteure.map((m) => ({ id: m.id, label: m.full_name ?? "—" }))}
        />
      </div>
    </div>
  );
}
