import type { ReactNode } from "react";

// Platzhalter fuer Fachfunktionen, die in spaeteren Arbeitspaketen folgen.
export function Placeholder({
  title,
  intro,
  planned,
  children,
}: {
  title: string;
  intro?: string;
  planned?: string;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      {intro ? <p className="max-w-2xl text-slate-600">{intro}</p> : null}
      {planned ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Status:</strong> {planned}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function NoAccess() {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      Kein Zugriff. Diese Ansicht ist für Ihre Rolle nicht freigegeben.
    </div>
  );
}
