import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { navFor, ROLE_LABELS } from "@/lib/roles";

export default async function DashboardPage() {
  const session = await requireSession();
  const links = navFor(session.role).filter((l) => l.href !== "/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Willkommen, {session.fullName}
        </h1>
        <p className="text-slate-600">
          Angemeldet als <strong>{ROLE_LABELS[session.role]}</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow"
          >
            <div className="text-base font-medium text-slate-900">{l.label}</div>
            <div className="mt-1 text-sm text-slate-500">Öffnen →</div>
          </Link>
        ))}
      </div>

      <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <strong>Hinweis (Arbeitspaket 1):</strong> Grundgerüst, Login,
        rollenbasierte Navigation und Datenmodell stehen. Die Fachfunktionen
        (Vorgänge, Bild-Upload, Material/Lager, CSV-Export) folgen in den
        nächsten Arbeitspaketen.
      </div>
    </div>
  );
}
