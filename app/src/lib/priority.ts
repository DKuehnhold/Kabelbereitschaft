// Priorität eines Vorgangs (AP2).
export const PRIORITIES = ["niedrig", "normal", "hoch", "kritisch"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  niedrig: "Niedrig",
  normal: "Normal",
  hoch: "Hoch",
  kritisch: "Kritisch",
};

// Farbgebung für Badges im Dashboard.
export const PRIORITY_STYLES: Record<Priority, string> = {
  niedrig: "bg-slate-100 text-slate-600 border-slate-200",
  normal: "bg-sky-100 text-sky-800 border-sky-200",
  hoch: "bg-amber-100 text-amber-900 border-amber-300",
  kritisch: "bg-red-100 text-red-800 border-red-300",
};

// Sortierreihenfolge (kritisch zuerst).
export const PRIORITY_ORDER: Record<Priority, number> = {
  kritisch: 0,
  hoch: 1,
  normal: 2,
  niedrig: 3,
};
