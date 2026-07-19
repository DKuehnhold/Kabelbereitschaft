import { STATUS_LABELS } from "@/lib/status";
import type { IncidentDetail } from "@/lib/incidents";

type TItem = { at: string; title: string; detail?: string; tone: keyof typeof DOT };

const DOT: Record<string, string> = {
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
  teal: "bg-teal-500",
  slate: "bg-slate-400",
  green: "bg-green-600",
  amber: "bg-amber-500",
};

function fmt(dt: string): string {
  return new Date(dt).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function Timeline({ detail }: { detail: IncidentDetail }) {
  const { incident, history, notes } = detail;
  const items: TItem[] = [];

  items.push({ at: incident.created_at, title: "Vorgang erstellt", detail: `#${incident.incident_no}`, tone: "blue" });

  history
    .filter((h) => h.old_status !== null)
    .forEach((h) =>
      items.push({
        at: h.changed_at,
        title: `Statuswechsel: ${STATUS_LABELS[h.new_status]}`,
        detail: h.old_status ? `von ${STATUS_LABELS[h.old_status]}` : undefined,
        tone: h.new_status === "technisch_abgeschlossen" ? "green" : "indigo",
      }),
    );

  incident.assignments.forEach((a) =>
    items.push({
      at: a.assigned_at,
      title: `Monteur zugewiesen: ${a.monteur?.full_name ?? "—"}${a.is_active ? "" : " (entfernt)"}`,
      tone: "teal",
    }),
  );

  notes.forEach((n) => items.push({ at: n.created_at, title: "Notiz", detail: n.body, tone: "slate" }));

  if (incident.closed_at) {
    items.push({
      at: incident.closed_at,
      title: "Administrativer Abschluss",
      detail: incident.closing_note ?? undefined,
      tone: "green",
    });
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-4 text-sm font-semibold uppercase text-slate-500">Chronik</h2>
      <ol className="relative border-l border-slate-200 pl-5">
        {items.map((it, i) => (
          <li key={i} className="mb-5 last:mb-0">
            <span className={`absolute -left-[7px] mt-1 h-3.5 w-3.5 rounded-full ring-2 ring-white ${DOT[it.tone]}`} />
            <div className="text-sm font-medium text-slate-800">{it.title}</div>
            {it.detail ? <div className="text-sm text-slate-600">{it.detail}</div> : null}
            <div className="text-xs text-slate-400">{fmt(it.at)}</div>
          </li>
        ))}
      </ol>
      <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
        Material- und Bildereignisse erscheinen hier ab AP3/AP4. Die Chronik ist unveränderbar.
      </p>
    </div>
  );
}
