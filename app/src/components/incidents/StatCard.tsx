import Link from "next/link";

export function StatCard({
  label,
  value,
  accent = "slate",
  href,
}: {
  label: string;
  value: number;
  accent?: "slate" | "blue" | "amber" | "orange" | "green" | "red" | "indigo";
  href?: string;
}) {
  const accents: Record<string, string> = {
    slate: "border-slate-200",
    blue: "border-blue-300",
    amber: "border-amber-300",
    orange: "border-orange-300",
    green: "border-green-300",
    red: "border-red-300",
    indigo: "border-indigo-300",
  };
  const inner = (
    <div className={`rounded-lg border bg-white p-4 shadow-sm ${accents[accent]}`}>
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
  );
  return href ? (
    <Link href={href} className="block transition hover:shadow">
      {inner}
    </Link>
  ) : (
    inner
  );
}
