"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  uploadImages,
  changeImageCategory,
  changeImageDescription,
  softDeleteImage,
} from "@/lib/image-actions";
import { IMAGE_CATEGORIES, IMAGE_CATEGORY_LABELS, type ImageCategory } from "@/lib/status";
import { MAX_IMAGE_MB, MAX_IMAGE_BYTES, ALLOWED_IMAGE_MIME, type GalleryImage } from "@/lib/images";
import type { FormState } from "@/lib/incidents";

const initial: FormState = { ok: false, error: null };

function fmt(dt: string | null): string {
  return dt ? new Date(dt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
}
function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
function canManage(img: GalleryImage, currentUserId: string, isStaff: boolean): boolean {
  return isStaff || img.uploaded_by === currentUserId;
}

const imgStyle = { imageOrientation: "from-image" as const };

export function ImageGallery({
  incidentId,
  images,
  canUpload,
  currentUserId,
  isStaff,
}: {
  incidentId: string;
  images: GalleryImage[];
  canUpload: boolean;
  currentUserId: string;
  isStaff: boolean;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState<ImageCategory>("uebersicht");
  const [description, setDescription] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [clientWarn, setClientWarn] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadState, uploadAction, uploading] = useActionState(uploadImages, initial);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Nach erfolgreichem Upload die Auswahl leeren (Formular-Sync mit Action-Ergebnis).
  const lastHandled = useRef<FormState | null>(null);
  useEffect(() => {
    if (uploadState !== lastHandled.current && uploadState.ok) {
      lastHandled.current = uploadState;
      setFiles([]);
      setDescription("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [uploadState]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list);
    const warnings: string[] = [];
    const accepted = incoming.filter((f) => {
      if (!(ALLOWED_IMAGE_MIME as readonly string[]).includes(f.type)) {
        warnings.push(`${f.name}: nur JPG/PNG`);
        return false;
      }
      if (f.size > MAX_IMAGE_BYTES) {
        warnings.push(`${f.name}: größer als ${MAX_IMAGE_MB} MB`);
        return false;
      }
      return true;
    });
    setClientWarn(warnings.length ? warnings.join(" · ") : null);
    if (accepted.length) setFiles((prev) => [...prev, ...accepted]);
  }

  function submitUpload() {
    if (files.length === 0) return;
    const fd = new FormData();
    fd.set("incident_id", incidentId);
    fd.set("category", category);
    if (description.trim()) fd.set("description", description.trim());
    for (const f of files) fd.append("files", f);
    uploadAction(fd);
  }

  const btn = "rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50";
  const field = "rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 w-full";

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase text-slate-500">Bilder</h2>
        <span className="text-xs text-slate-400">{images.length} Bild(er)</span>
      </div>

      {/* Upload */}
      {canUpload ? (
        <div className="mb-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
            className={`rounded-lg border-2 border-dashed p-4 text-center text-sm ${dragOver ? "border-blue-500 bg-blue-50" : "border-slate-300"}`}
          >
            <p className="text-slate-600">Bilder hierher ziehen oder auswählen</p>
            <p className="mt-1 text-xs text-slate-400">JPG oder PNG, max. {MAX_IMAGE_MB} MB je Datei</p>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png"
              multiple
              onChange={(e) => addFiles(e.target.files)}
              className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm"
            />
          </div>

          {files.length > 0 ? (
            <div className="mt-3 space-y-2">
              <ul className="max-h-32 overflow-auto text-xs text-slate-600">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between border-b border-slate-100 py-1">
                    <span className="truncate">{f.name} · {fmtSize(f.size)}</span>
                    <button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="ml-2 text-red-700 hover:underline">entfernen</button>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs text-slate-500">
                  Kategorie (Pflicht)
                  <select value={category} onChange={(e) => setCategory(e.target.value as ImageCategory)} className={`${field} max-w-xs`}>
                    {IMAGE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{IMAGE_CATEGORY_LABELS[c]}</option>
                    ))}
                  </select>
                </label>
                <label className="flex-1 text-xs text-slate-500">
                  Beschreibung (optional)
                  <input value={description} onChange={(e) => setDescription(e.target.value)} className={field} placeholder="z. B. Nahaufnahme Schadstelle" />
                </label>
                <button type="button" onClick={submitUpload} disabled={uploading} className={btn}>
                  {uploading ? "Lädt hoch…" : `${files.length} hochladen`}
                </button>
              </div>
            </div>
          ) : null}

          {clientWarn ? <p className="mt-2 text-xs text-amber-700">{clientWarn}</p> : null}
          {uploadState.error ? (
            <p className={`mt-2 text-xs ${uploadState.ok ? "text-amber-700" : "text-red-700"}`}>{uploadState.error}</p>
          ) : null}
          {uploadState.ok && !uploadState.error ? <p className="mt-2 text-xs text-green-700">Upload erfolgreich.</p> : null}
        </div>
      ) : null}

      {/* Galerie */}
      {images.length === 0 ? (
        <p className="text-sm text-slate-400">Noch keine Bilder vorhanden.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img, idx) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setOpenIndex(idx)}
              className="group overflow-hidden rounded-lg border border-slate-200 text-left hover:border-blue-400"
            >
              <div className="aspect-square w-full bg-slate-100">
                {img.signed_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img.signed_url} alt={img.description ?? img.file_name} loading="lazy" style={imgStyle} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">Vorschau nicht verfügbar</div>
                )}
              </div>
              <div className="p-2">
                <div className="truncate text-xs font-medium text-slate-700">{IMAGE_CATEGORY_LABELS[img.category]}</div>
                <div className="truncate text-[11px] text-slate-400">{fmt(img.taken_at ?? img.uploaded_at)} · {img.uploader_name}</div>
                {img.description ? <div className="truncate text-[11px] text-slate-500">{img.description}</div> : null}
              </div>
            </button>
          ))}
        </div>
      )}

      {openIndex !== null && images[openIndex] ? (
        <Lightbox
          image={images[openIndex]}
          hasPrev={openIndex > 0}
          hasNext={openIndex < images.length - 1}
          onPrev={() => setOpenIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
          onNext={() => setOpenIndex((i) => (i !== null && i < images.length - 1 ? i + 1 : i))}
          onClose={() => setOpenIndex(null)}
          canManage={canManage(images[openIndex], currentUserId, isStaff)}
          incidentId={incidentId}
        />
      ) : null}
    </section>
  );
}

function Lightbox({
  image,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onClose,
  canManage: mayManage,
  incidentId,
}: {
  image: GalleryImage;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  canManage: boolean;
  incidentId: string;
}) {
  const [catState, catAction, catPending] = useActionState(changeImageCategory, initial);
  const [descState, descAction, descPending] = useActionState(changeImageDescription, initial);
  const field = "rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 w-full";
  const smallBtn = "rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50";

  const gps = image.gps_lat != null && image.gps_lon != null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-lg bg-white p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="truncate text-sm font-semibold text-slate-800">{image.file_name}</h3>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-100">Schließen</button>
        </div>

        <div className="relative bg-slate-100">
          {image.signed_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image.signed_url} alt={image.description ?? image.file_name} style={imgStyle} className="mx-auto max-h-[60vh] w-auto object-contain" />
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-slate-400">Vorschau nicht verfügbar</div>
          )}
          <div className="flex items-center justify-between p-2">
            <button type="button" onClick={onPrev} disabled={!hasPrev} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40">← Vorheriges</button>
            <button type="button" onClick={onNext} disabled={!hasNext} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40">Nächstes →</button>
          </div>
        </div>

        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <Meta label="Kategorie" value={IMAGE_CATEGORY_LABELS[image.category]} />
          <Meta label="Beschreibung" value={image.description ?? "—"} />
          <Meta label="Aufnahmedatum" value={fmt(image.taken_at)} />
          <Meta label="Hochgeladen" value={`${fmt(image.uploaded_at)} · ${image.uploader_name}`} />
          <Meta label="Kamera" value={image.camera_model ?? "—"} />
          <Meta label="Abmessungen" value={image.width && image.height ? `${image.width} × ${image.height}` : "—"} />
          <Meta label="Dateigröße" value={fmtSize(image.file_size)} />
          <Meta
            label="GPS"
            value={
              gps ? (
                <a className="text-blue-800 hover:underline" href={`https://www.google.com/maps?q=${image.gps_lat},${image.gps_lon}`} target="_blank" rel="noopener noreferrer">
                  {image.gps_lat!.toFixed(6)}, {image.gps_lon!.toFixed(6)} (Karte öffnen)
                </a>
              ) : "—"
            }
          />
        </dl>

        {mayManage ? (
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
            <form action={catAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="image_id" value={image.id} />
              <input type="hidden" name="incident_id" value={incidentId} />
              <label className="text-xs text-slate-500">
                Kategorie ändern
                <select name="category" defaultValue={image.category} className={`${field} max-w-xs`}>
                  {IMAGE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{IMAGE_CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={catPending} className={smallBtn}>Speichern</button>
              {catState.error ? <span className="text-xs text-red-700">{catState.error}</span> : null}
            </form>

            <form action={descAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="image_id" value={image.id} />
              <input type="hidden" name="incident_id" value={incidentId} />
              <label className="flex-1 text-xs text-slate-500">
                Beschreibung ändern
                <input name="description" defaultValue={image.description ?? ""} className={field} />
              </label>
              <button type="submit" disabled={descPending} className={smallBtn}>Speichern</button>
              {descState.error ? <span className="text-xs text-red-700">{descState.error}</span> : null}
            </form>

            <form
              action={softDeleteImage}
              onSubmit={(e) => { if (!confirm("Dieses Bild wirklich als gelöscht markieren?")) e.preventDefault(); }}
            >
              <input type="hidden" name="image_id" value={image.id} />
              <input type="hidden" name="incident_id" value={incidentId} />
              <button type="submit" className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">
                Bild löschen (Soft Delete)
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 border-b border-slate-100 py-1">
      <dt className="w-32 shrink-0 text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value}</dd>
    </div>
  );
}
