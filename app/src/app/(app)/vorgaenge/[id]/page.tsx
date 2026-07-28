import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { NoAccess } from "@/components/Placeholder";
import { getAssignedIncidentContact, getIncidentDetail, getMonteure, getStaffIncidentContact } from "@/lib/incidents";
import { StatusBadge } from "@/components/incidents/StatusBadge";
import { PriorityBadge } from "@/components/incidents/PriorityBadge";
import { Timeline } from "@/components/incidents/Timeline";
import { IncidentControls } from "@/components/incidents/IncidentControls";
import { getIncidentMovements, getActiveMaterials, getActiveLocations } from "@/lib/inventory";
import { IncidentMaterialCard } from "@/components/inventory/IncidentMaterialCard";
import { IncidentImages } from "@/components/images/IncidentImages";
import { OfflineIncidentActions } from "@/components/offline/OfflineIncidentActions";
import { CONDITION_LABELS } from "@/lib/status";
import { listAssignedIncidentTasks, listIncidentTasks } from "@/lib/tasks";
import type { AssignedIncidentTask, IncidentTask } from "@/lib/tasks";
import { AssignedTaskList, TaskList } from "@/components/incidents/TaskList";
import { listProfileOptions, listTeams } from "@/lib/masterdata";
import type { StageOption, TeamRow } from "@/lib/masterdata";

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
  // AP13: Aufgaben. Staff liest die Tabelle (RLS), Monteure erhalten die
  // minimierte Projektion über die RPC. Zuständigkeitsoptionen nur für Staff.
  const [tasks, assignedTasks, taskProfiles, teamRows] = await Promise.all([
    isStaff ? listIncidentTasks(id) : Promise.resolve<IncidentTask[]>([]),
    isStaff ? Promise.resolve<AssignedIncidentTask[]>([]) : listAssignedIncidentTasks(id),
    isStaff ? listProfileOptions() : Promise.resolve<StageOption[]>([]),
    isStaff ? listTeams() : Promise.resolve<TeamRow[]>([]),
  ]);
  const taskTeams = teamRows.filter((t) => t.is_active).map((t) => ({ id: t.id, label: t.name }));

  const projectedContact = isStaff
    ? await getStaffIncidentContact(i.contact_id, i.contact_phone_number_id)
    : await getAssignedIncidentContact(id);
  const contactName = projectedContact?.contact_name ?? i.contact_name_snapshot ?? i.caller_name;
  const contactFunction = projectedContact?.contact_function ?? i.contact_function_snapshot;
  const contactPhone = projectedContact?.operative_phone ?? i.contact_phone_snapshot ?? i.caller_contact;
  const conditionLabels = {
    ready: "Einsatzbereit",
    restricted: "Eingeschränkt",
    damaged: "Beschädigt",
    unusable: "Nicht verwendbar",
  } as const;

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
              <Row label="Kunde" value={i.customer?.name} />
              <Row label="Baustufe" value={i.stage?.name} />
              <Row label="VzG-Streckennummer" value={i.vzgline?.line_number ?? i.vzg_line_number} />
              <Row
                label="Streckenkilometer"
                value={i.km_from != null ? `${i.km_from}${i.km_to != null ? " – " + i.km_to : ""}` : "—"}
              />
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
              <Row label="Ansprechpartner" value={contactName} />
              <Row label="Funktion/Rolle" value={contactFunction} />
              <Row label="Operative Telefonnummer" value={contactPhone} />
              <Row label="Beschreibung" value={i.description} />
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">Kabelpositionen</h2>
            {i.cable_positions?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="pb-2 pr-4">Position</th>
                      <th className="pb-2 pr-4">Kabelart</th>
                      <th className="pb-2 pr-4">Menge</th>
                      <th className="pb-2">Zustand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {i.cable_positions
                      .slice()
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((position, index) => (
                        <tr key={position.id} className="border-t border-slate-100">
                          <td className="py-2 pr-4">{index + 1}</td>
                          <td className="py-2 pr-4">{position.cable_type?.name ?? "—"}</td>
                          <td className="py-2 pr-4">
                            {position.quantity_value == null
                              ? "nicht erfasst"
                              : `${position.quantity_value} ${position.quantity_unit === "piece" ? "Stück" : "m"}`}
                          </td>
                          <td className="py-2">
                            {position.condition_code ? conditionLabels[position.condition_code] : "nicht erfasst"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-slate-500">Keine Kabelpositionen erfasst.</p>}
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

          {isStaff ? (
            <TaskList incidentId={i.id} tasks={tasks} profiles={taskProfiles} teams={taskTeams} />
          ) : (
            <AssignedTaskList tasks={assignedTasks} />
          )}

          <IncidentControls incident={i} role={session.role} monteure={monteure} />

          <OfflineIncidentActions
            incidentId={i.id}
            incidentNo={i.incident_no}
            currentStatus={i.status}
            updatedAt={i.updated_at}
            role={session.role}
          />

          <IncidentMaterialCard
            incidentId={i.id}
            movements={movements}
            canBook={true}
            materials={materials}
            locations={locations}
          />

          <IncidentImages incidentId={i.id} currentUserId={session.userId} isStaff={isStaff} />
        </div>

        {/* Timeline (rechts auf Desktop, unten auf Mobile) */}
        <div className="lg:col-span-1">
          <Timeline detail={detail} />
        </div>
      </div>
    </div>
  );
}
