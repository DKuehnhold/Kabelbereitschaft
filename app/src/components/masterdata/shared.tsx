"use client";

import { useEffect, type ReactNode } from "react";

// =====================================================================
// AP9 – Gemeinsame, token-basierte CRUD-Bausteine (AP8-Designsystem).
// Kein Alt-Stil (slate/blue/bg-white); Light/Dark über Tokens.
// =====================================================================

export const labelCls = "mb-1 block text-sm font-medium text-foreground";

// Token-basierter Dialog (bewusst eigener statt des hellen Alt-Modals).
export function MasterModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="card mt-10 w-full max-w-2xl p-5 fade-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="text-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toolbar({
  query,
  setQuery,
  searchPlaceholder = "Suche…",
  showInactive,
  setShowInactive,
  onNew,
  newLabel,
  sort,
}: {
  query: string;
  setQuery: (v: string) => void;
  searchPlaceholder?: string;
  showInactive: boolean;
  setShowInactive: (v: boolean) => void;
  onNew: () => void;
  newLabel: string;
  sort?: ReactNode;
}) {
  return (
    <div className="card flex flex-wrap items-center gap-2 p-3">
      <input
        className="input max-w-xs"
        placeholder={searchPlaceholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Suche"
      />
      {sort}
      <label className="flex items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
        />
        Inaktive anzeigen
      </label>
      <button type="button" onClick={onNew} className="btn btn-primary ml-auto">
        {newLabel}
      </button>
    </div>
  );
}

export function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={`badge ${active ? "badge-success" : "badge-warning"}`}>
      {active ? "Aktiv" : "Inaktiv"}
    </span>
  );
}

// Bearbeiten + eindeutig beschriftete Aktiv/Inaktiv-Umschaltung.
// „Deaktivieren" ist als reversible, aber abgesetzte Aktion (Outline + Warnfarbe)
// klar von der primären roten Aktion unterschieden.
export function RowActions({
  id,
  active,
  onEdit,
  toggleAction,
}: {
  id: string;
  active: boolean;
  onEdit: () => void;
  toggleAction: (fd: FormData) => void | Promise<void>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={onEdit} className="btn btn-outline px-3 py-1.5">
        Bearbeiten
      </button>
      <form action={toggleAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="active" value={active ? "false" : "true"} />
        {active ? (
          <button
            type="submit"
            className="btn btn-outline px-3 py-1.5"
            style={{ color: "var(--warning)", borderColor: "var(--warning)" }}
          >
            Deaktivieren
          </button>
        ) : (
          <button type="submit" className="btn btn-accent px-3 py-1.5">
            Aktivieren
          </button>
        )}
      </form>
    </div>
  );
}

export function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="rounded-md border px-3 py-2 text-sm"
      style={{ background: "var(--danger-bg)", color: "var(--danger)", borderColor: "var(--danger)" }}
    >
      {error}
    </div>
  );
}

export function FormActions({ pending }: { pending: boolean }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Speichern…" : "Speichern"}
      </button>
    </div>
  );
}

// Desktop-Tabelle: einheitlicher Rahmen.
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="card hidden overflow-x-auto md:block">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <th className={`px-3 py-2 text-left text-xs font-semibold uppercase text-muted ${className}`}>{children}</th>;
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-foreground ${className}`}>{children}</td>;
}

// Mobile-Kartenliste.
export function CardList({ children }: { children: ReactNode }) {
  return <div className="space-y-2 md:hidden">{children}</div>;
}

export function EmptyState({ text }: { text: string }) {
  return <div className="card p-6 text-center text-muted">{text}</div>;
}
