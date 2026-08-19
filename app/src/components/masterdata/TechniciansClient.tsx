"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  saveTechnician, setTechnicianActive,
  previewTechnicianImport, commitTechnicianImport,
  setTechnicianQualifications,
} from "@/lib/masterdata-actions";
import type { TechnicianRow, StageOption } from "@/lib/masterdata";
import type { ImportPreview, ImportCommitResult, ImportRowStatus } from "@/lib/csv-import";
import type { FormState } from "@/lib/incidents";
import type { QualificationRow } from "@/lib/qualifications";
import {
  MasterModal, Toolbar, StatusPill, RowActions, FormError, FormActions,
  TableWrap, Th, Td, CardList, EmptyState, labelCls,
} from "@/components/masterdata/shared";

const initial: FormState = { ok: false, error: null };

function TechnicianForm({
  row, onSaved, profileOptions,
}: { row: TechnicianRow | null; onSaved: () => void; profileOptions: StageOption[] }) {
  const [state, action, pending] = useActionState(saveTechnician, initial);
  useEffect(() => { if (state.ok) onSaved(); }, [state.ok, onSaved]);
  return (
    <form action={action} className="space-y-3">
      {row ? <input type="hidden" name="id" value={row.id} /> : null}
      <FormError error={state.error} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="m_first">Vorname *</label>
          <input id="m_first" name="first_name" required defaultValue={row?.first_name ?? ""} className="input" />
        </div>
        <div>
          <label className={labelCls} htmlFor="m_last">Nachname *</label>
          <input id="m_last" name="last_name" required defaultValue={row?.last_name ?? ""} className="input" />
        </div>
        <div>
          <label className={labelCls} htmlFor="m_profile">Benutzerkonto (optional, für spätere Anmeldung)</label>
          <select id="m_profile" name="profile_id" defaultValue={row?.profile_id ?? ""} className="input">
            <option value="">— nicht verknüpft —</option>
            {profileOptions.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="m_active">Status</label>
          <select id="m_active" name="is_active" defaultValue={row ? String(row.is_active) : "true"} className="input">
            <option value="true">Aktiv</option>
            <option value="false">Inaktiv</option>
          </select>
        </div>
      </div>
      <FormActions pending={pending} />
    </form>
  );
}

/**
 * AUFTRAG_14: Qualifikations-Zuordnung (Mehrfachauswahl) - eigener Bereich
 * unterhalb des Stammdatenformulars, weil setTechnicianQualifications() eine
 * einfache async Funktion ist (kein FormState-Formular wie saveTechnician:
 * sie ersetzt eine ganze Menge, kein einzelnes Feld). Nur für BESTEHENDE
 * Monteure sichtbar - ein neuer Monteur muss zuerst gespeichert werden,
 * bevor er eine technician_id hat, der eine Zuordnung anhängen könnte.
 */
function TechnicianQualifications({
  technicianId, qualifications, initialIds,
}: { technicianId: string; qualifications: QualificationRow[]; initialIds: string[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(initialIds));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const toggle = (id: string) => {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const onSave = async () => {
    setBusy(true); setError(null); setSaved(false);
    const result = await setTechnicianQualifications(technicianId, Array.from(selected));
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setSaved(true);
    router.refresh();
  };

  if (qualifications.length === 0) {
    return (
      <p className="text-sm text-muted">
        Noch keine Qualifikationen im Katalog (Stammdaten → Qualifikationen).
      </p>
    );
  }

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className={labelCls}>Qualifikationen (mehrfach möglich)</div>
      <FormError error={error} />
      {saved ? <p className="text-sm" style={{ color: "var(--success)" }}>Gespeichert.</p> : null}
      <div className="flex flex-wrap gap-3">
        {qualifications.map((q) => (
          <label key={q.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox" checked={selected.has(q.id)} onChange={() => toggle(q.id)} disabled={busy}
              style={{ minHeight: "20px", minWidth: "20px" }}
            />
            {q.label}
          </label>
        ))}
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={onSave} disabled={busy} className="btn btn-outline" style={{ minHeight: "44px" }}>
          {busy ? "Bitte warten…" : "Qualifikationen speichern"}
        </button>
      </div>
    </div>
  );
}

const STATUS_BADGE: Record<ImportRowStatus, string> = {
  neu: "badge-success",
  dublette_datei: "badge-warning",
  dublette_db: "badge-warning",
  fehler: "badge-danger",
};
const STATUS_LABEL: Record<ImportRowStatus, string> = {
  neu: "Neu",
  dublette_datei: "Dublette (Datei)",
  dublette_db: "Bereits vorhanden",
  fehler: "Fehler",
};

function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [fileText, setFileText] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setFileText(""); setFileName(""); setPreview(null); setResult(null); setError(null); };
  const close = () => { reset(); onClose(); };

  const onFile = async (file: File | null) => {
    setPreview(null); setResult(null); setError(null);
    if (!file) return;
    const text = await file.text();
    setFileText(text);
    setFileName(file.name);
    setBusy(true);
    try {
      const p = await previewTechnicianImport(text);
      setPreview(p);
    } catch {
      setError("Vorschau fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const onCommit = async () => {
    if (!fileText) return;
    setBusy(true); setError(null);
    try {
      const r = await commitTechnicianImport(fileText);
      setResult(r);
      if (r.ok) router.refresh();
    } catch {
      setError("Import fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const canCommit = !!preview && !preview.fatal && preview.summary.neu > 0 && !result;

  return (
    <MasterModal open={open} onClose={close} title="Monteure aus CSV importieren">
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Erwartete Kopfzeile: <span className="font-mono">Vorname;Nachname;Aktiv</span> (optional <span className="font-mono">Profil-ID</span>).
          UTF-8 mit/ohne BOM, Trennzeichen Semikolon oder Komma. Bestehende Monteure werden nicht überschrieben.
        </p>

        <input
          type="file" accept=".csv,text/csv" className="input"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)} aria-label="CSV-Datei"
        />
        {fileName ? <p className="text-xs text-muted">Datei: {fileName}{preview ? ` · Trennzeichen „${preview.delimiter}"` : ""}</p> : null}

        <FormError error={error} />
        {preview?.fatal ? <FormError error={preview.fatal} /> : null}

        {preview && !preview.fatal ? (
          <>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="badge badge-success">Neu: {preview.summary.neu}</span>
              <span className="badge badge-warning">Dublette Datei: {preview.summary.dublette_datei}</span>
              <span className="badge badge-warning">Bereits vorhanden: {preview.summary.dublette_db}</span>
              <span className="badge badge-danger">Fehler: {preview.summary.fehler}</span>
            </div>

            <div className="card max-h-72 overflow-auto">
              <table className="w-full text-sm">
                <thead><tr><Th>Zeile</Th><Th>Vorname</Th><Th>Nachname</Th><Th>Aktiv</Th><Th>Status</Th><Th>Hinweis</Th></tr></thead>
                <tbody>
                  {preview.rows.map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <Td className="text-muted">{r.line}</Td>
                      <Td>{r.first_name || "—"}</Td>
                      <Td>{r.last_name || "—"}</Td>
                      <Td className="text-muted">{r.status === "fehler" ? "—" : r.is_active ? "Ja" : "Nein"}</Td>
                      <Td><span className={`badge ${STATUS_BADGE[r.status]}`}>{STATUS_LABEL[r.status]}</span></Td>
                      <Td className="text-muted">{r.message}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        {result ? (
          <div
            role="status" className="rounded-md border px-3 py-2 text-sm"
            style={{
              background: result.ok ? "var(--success-bg)" : "var(--danger-bg)",
              color: result.ok ? "var(--success)" : "var(--danger)",
              borderColor: result.ok ? "var(--success)" : "var(--danger)",
            }}
          >
            {result.message}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={close} className="btn btn-outline">
            {result?.ok ? "Schließen" : "Abbrechen"}
          </button>
          {!result ? (
            <button type="button" onClick={onCommit} disabled={!canCommit || busy} className="btn btn-primary">
              {busy ? "Bitte warten…" : `Import bestätigen${preview ? ` (${preview.summary.neu})` : ""}`}
            </button>
          ) : null}
        </div>
      </div>
    </MasterModal>
  );
}

export function TechniciansClient({
  technicians, profileOptions, qualifications, qualificationIdsByTechnician,
}: {
  technicians: TechnicianRow[];
  profileOptions: StageOption[];
  qualifications?: QualificationRow[];
  qualificationIdsByTechnician?: Record<string, string[]>;
}) {
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<TechnicianRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return technicians
      .filter((t) => (showInactive ? true : t.is_active))
      .filter((t) => (!needle ? true : `${t.first_name} ${t.last_name} ${t.profile_name ?? ""}`.toLowerCase().includes(needle)))
      .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
  }, [technicians, q, showInactive]);

  const openNew = () => { setEdit(null); setOpen(true); };
  const openEdit = (t: TechnicianRow) => { setEdit(t); setOpen(true); };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button type="button" onClick={() => setImportOpen(true)} className="btn btn-outline">
          CSV-Import
        </button>
      </div>

      <Toolbar
        query={q} setQuery={setQ} showInactive={showInactive} setShowInactive={setShowInactive}
        onNew={openNew} newLabel="+ Neuer Monteur" searchPlaceholder="Monteur suchen…"
      />

      <TableWrap>
        <thead><tr><Th>Nachname</Th><Th>Vorname</Th><Th>Benutzerkonto</Th><Th>Status</Th><Th className="text-right">Aktionen</Th></tr></thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-t border-border">
              <Td className="font-medium">{t.last_name}</Td>
              <Td>{t.first_name}</Td>
              <Td className="text-muted">{t.profile_name ?? (t.profile_id ? "verknüpft" : "—")}</Td>
              <Td><StatusPill active={t.is_active} /></Td>
              <Td className="text-right"><div className="flex justify-end"><RowActions id={t.id} active={t.is_active} onEdit={() => openEdit(t)} toggleAction={setTechnicianActive} /></div></Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <CardList>
        {rows.map((t) => (
          <div key={t.id} className="card p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">{t.last_name}, {t.first_name}</span>
              <StatusPill active={t.is_active} />
            </div>
            <div className="mt-1 text-sm text-muted">Konto: {t.profile_name ?? (t.profile_id ? "verknüpft" : "—")}</div>
            <div className="mt-3"><RowActions id={t.id} active={t.is_active} onEdit={() => openEdit(t)} toggleAction={setTechnicianActive} /></div>
          </div>
        ))}
      </CardList>

      {rows.length === 0 ? <EmptyState text="Keine Monteure." /> : null}

      <MasterModal open={open} onClose={() => setOpen(false)} title={edit ? "Monteur bearbeiten" : "Neuer Monteur"}>
        <TechnicianForm row={edit} onSaved={() => setOpen(false)} profileOptions={profileOptions} />
        {edit && qualifications ? (
          <div className="mt-4">
            <TechnicianQualifications
              technicianId={edit.id}
              qualifications={qualifications}
              initialIds={qualificationIdsByTechnician?.[edit.id] ?? []}
            />
          </div>
        ) : null}
      </MasterModal>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
