import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { NoAccess } from "@/components/Placeholder";
import { getIncidentDetail, getMonteure } from "@/lib/incidents";
import { StatusBadge } from "@/components/incidents/StatusBadge";
import { PriorityBadge } from "@/components/incidents/PriorityBadge";
import { Timeline } from "@/components/incidents/Timeline";
import { IncidentControls } from "@/components/incidents/IncidentControls";
import { getIncidentMovements, getActiveMaterials, getActiveLocations } from "@/lib/inventory";
import { IncidentMaterialCard } from "@/components/inventory/IncidentMaterialCard";
import { CONDITION_LABELS } from "@/lib/status";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col border-b border-slate-100 py-1.5 sm:flex-row">
      <dt className="w-52 shrink-0 text-sm text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-800">{value ?? "—"}</dd>
    </div>
  );
}

function fmt(dt: string | null): string {
  return dt ? new Date(dt).toLocaleString("de-DE") : "—";
}

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const detail = await getIncidentDetail(id);
  if (!detail) return <NoAccess />;

  const i = detail.incident;
  const isStaff = session.role !== "monteur";
  const [monteure, movements, materials, locations] = await Promise.all([
    isStaff ? getMonteure() : Promise.resolve([] as { id: string; full_name: string | null }[]),
    getIncidentMovements(id),
    getActiveMaterials(),
    getActiveLocations(),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">Vorgang #{i.incident_no}</h1>
          <StatusBadge status={i.status} />
          <PriorityBadge priority={i.priority} />
        </div>
        <div className="flex items-center gap-2">
          <Link href="/vorgaenge" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
            Übersicht
          </Link>
          {isStaff ? (
            <Link href={`/vorgaenge/${i.id}/bearbeiten`} className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700">
              Bearbeiten
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Hauptspalte */}
        <div className="space-y-5 lg:col-span-2">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase text-slate-500">Standort</h2>
            <dl>
              <Row label="Baustufe" value={i.stage?.name} />
              <Row label="VzG-Streckennummer" value={i.vzg_line_number} />
              <Row label="Streckenkilometer" value={`${i.km_from}${i.km_to != null ? " – " + i.km_to : ""}`} />
              <Row label="Betriebsstelle" value={i.operating_point} />
              <Row label="Gleis" value={i.track} />
              <Row label="Richtung" value={i.direction} />
              <Row label="Objektart" value={i.object_type} />
              <Row label="Objektbezeichnung" value={i.object_designation} />
              <Row label="Ortsbeschreibung" value={i.location_description} />
              <Row label="Externe Referenz" value={i.external_reference} />
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase text-slate-500">Meldung & Kontakt</h2>
            <dl>
              <Row label="Bereitschaftsnummer" value={i.oncall ? (i.oncall.label ? `${i.oncall.number} – ${i.oncall.label}` : i.oncall.number) : "—"} />
              <Row label="Anrufzeitpunkt" value={fmt(i.call_received_at)} />
              <Row label="DB-Ansprechpartner" value={i.caller_name} />
              <Row label="Telefon" value={i.caller_contact} />
              <Row label="Beschreibung" value={i.description} />
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase text-slate-500">Bewertung & Bemerkungen</h2>
            <dl>
              <Row label="Zustandsbewertung" value={i.condition_rating ? CONDITION_LABELS[i.condition_rating] : "—"} />
              <Row label="Interne Bemerkung" value={i.internal_note} />
              <Row label="Abschlussbemerkung" value={i.closing_note} />
              <Row label="Abschlussdatum" value={fmt(i.closed_at)} />
            </dl>
          </section>

          <IncidentControls incident={i} role={session.role} monteure={monteure} />

          <IncidentMaterialCard
            incidentId={i.id}
            movements={movements}
            canBook={true}
            materials={materials}
            locations={locations}
          />
        </div>

        {/* Timeline (rechts auf Desktop, unten auf Mobile) */}
        <div className="lg:col-span-1">
          <Timeline detail={detail} />
        </div>
      </div>
    </div>
  );
}
