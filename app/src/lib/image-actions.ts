"use server";

import { revalidatePath } from "next/cache";
import { isUuid, withUserTransaction } from "@/lib/db";
import { getSessionProfile } from "@/lib/auth";
import { IMAGE_CATEGORIES, type ImageCategory } from "@/lib/status";
import type { FormState } from "@/lib/incidents";
import { uploadIncidentImages } from "@/lib/image-upload-core";

// =====================================================================
// AP4 – Server-Actions der Bilddokumentation.
//
// AP14/B: jede Datenbankoperation läuft über withUserTransaction() mit der
// Identität aus der serverseitig geprüften Auth.js-Sitzung (ADR-011 / 2.5).
// Kennungen aus dem Formular werden vor dem SQL mit isUuid() geprüft; in den
// SQL-Text gelangt kein Eingabewert – alle Werte sind Parameter ($1, $2).
//
// Eine Datenbankmeldung gelangt nie in ein Aktionsergebnis (verbindliche Regel
// aus @/lib/db/pg-errors): sie nennt Tabellen-, Spalten- und Constraint-Namen.
// Die Rohmeldung geht ausschließlich ins Serverprotokoll.
// =====================================================================

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
function strOrNull(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v === "" ? null : v;
}
function isCategory(v: string): v is ImageCategory {
  return (IMAGE_CATEGORIES as readonly string[]).includes(v);
}
function revalidate(incidentId: string) {
  revalidatePath(`/vorgaenge/${incidentId}`);
  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------
// Fehlerabbildung der Änderungswege
//
// Das sichtbare Präfix "Änderung fehlgeschlagen" bleibt wörtlich das bisherige;
// ersetzt wird ausschließlich die früher interpolierte Datenbank-Rohmeldung
// (`error.message`) durch neutralen Text – dieselbe Auflage wie in
// @/lib/db/pg-errors.
//
// CHANGE_NOT_APPLIED gilt, wenn die Anweisung KEINE Zeile getroffen hat.
// „Bild nicht vorhanden" und „Bild für diese Identität nicht sichtbar bzw. nicht
// änderbar" sind darin absichtlich NICHT unterscheidbar: eine eigene Meldung für
// den zweiten Fall wäre eine Existenzaussage über ein fremdes Bild.
// ---------------------------------------------------------------------
const CHANGE_NOT_APPLIED = "Änderung fehlgeschlagen: Bild nicht gefunden oder nicht bearbeitbar.";
const CHANGE_FAILED = "Änderung fehlgeschlagen.";

// Anweisungen als feste Literale. `updated_at` wird bewusst NICHT gesetzt: im
// Bildpfad gibt es keinen entsprechenden Trigger und keine solche Spaltenpflege –
// daran ändert diese Migration nichts.
const UPDATE_IMAGE_CATEGORY_SQL = `
  update public.incident_images
     set category = $2::public.image_category
   where id = $1::uuid and deleted_at is null`;

const UPDATE_IMAGE_DESCRIPTION_SQL = `
  update public.incident_images
     set description = $2
   where id = $1::uuid and deleted_at is null`;

/**
 * Gemeinsamer Ablauf der beiden Änderungswege.
 *
 * `sql` ist an jeder Aufrufstelle ein festes Literal; übergeben wird die fertige
 * Anweisung und nicht etwa ein Spaltenname, damit nichts in den SQL-Text
 * hineingebaut wird (gleiche Form wie setActive() in @/lib/inventory-actions).
 *
 * Die betroffenen Zeilen werden AUSGEWERTET. Ohne diese Auswertung hätte eine
 * Änderung an einem nicht sichtbaren oder bereits gelöschten Bild einen stillen
 * Erfolg gemeldet: der bisherige Weg wertete nur einen Fehlerwert aus, der in
 * diesem Fall leer blieb – die Aktion meldete `{ ok: true }`, und die Oberfläche
 * zeigte "Speichern" erfolgreich an, obwohl nichts geschrieben wurde.
 */
async function applyImageChange(
  userId: string,
  sql: string,
  values: readonly unknown[],
): Promise<FormState> {
  let changed: number;
  try {
    changed = await withUserTransaction(userId, async (client) => {
      const result = await client.query(sql, values);
      return result.rowCount ?? 0;
    });
  } catch (error) {
    console.error(
      "Bildänderung fehlgeschlagen (Datenbankfehler)",
      error instanceof Error ? error.message : "unbekannter Fehler",
    );
    return { ok: false, error: CHANGE_FAILED };
  }
  if (changed === 0) return { ok: false, error: CHANGE_NOT_APPLIED };
  return { ok: true, error: null };
}

// ---------------------------------------------------------------------
// Mehrfach-Upload (privat). Nutzt die gemeinsame Upload-Logik (image-upload-core),
// die auch der Offline-Replay-Endpunkt /api/images/upload verwendet.
// ---------------------------------------------------------------------
export async function uploadImages(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Nicht angemeldet." };

  const incidentId = strOrNull(fd, "incident_id");
  if (!incidentId) return { ok: false, error: "Kein Vorgang – Upload nicht möglich." };

  const category = str(fd, "category");
  if (!isCategory(category)) return { ok: false, error: "Bitte eine gültige Kategorie wählen." };

  const description = strOrNull(fd, "description");
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { ok: false, error: "Keine Datei ausgewählt." };

  // `clientActionId` wird hier bewusst NICHT übergeben: der interaktive Upload
  // hat keine Warteschlangenkennung. Nur der Offline-Replay über
  // /api/images/upload liefert eine und aktiviert damit die Deduplizierung.
  // Folgerichtig wird `duplicate` hier auch nicht ausgewertet – es kann ohne
  // Kennung nicht auftreten.
  const { ok, errors } = await uploadIncidentImages({
    incidentId,
    category,
    description,
    files,
    userId: session.userId,
  });

  revalidate(incidentId);

  if (ok === 0) return { ok: false, error: errors.join(" · ") || "Upload fehlgeschlagen." };
  if (errors.length) return { ok: true, error: `${ok} hochgeladen, ${errors.length} abgelehnt: ${errors.join(" · ")}` };
  return { ok: true, error: null };
}

// ---------------------------------------------------------------------
// Kategorie ändern (validiert; Trigger schreibt Chronik + Audit)
// ---------------------------------------------------------------------
export async function changeImageCategory(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Nicht angemeldet." };
  const id = strOrNull(fd, "image_id");
  const incidentId = strOrNull(fd, "incident_id");
  const category = str(fd, "category");
  if (!id || !incidentId) return { ok: false, error: "Bild/Vorgang fehlt." };
  if (!isCategory(category)) return { ok: false, error: "Ungültige Kategorie." };
  // Unbrauchbare Bildkennung: dieselbe Meldung wie eine fehlende – kein neues
  // Vokabular, und kein Abbruch erst in der Datenbank.
  if (!isUuid(id)) return { ok: false, error: "Bild/Vorgang fehlt." };

  const result = await applyImageChange(session.userId, UPDATE_IMAGE_CATEGORY_SQL, [id, category]);
  // Revalidierung nur im Erfolgsfall: ohne geschriebene Zeile hat sich nichts
  // geändert.
  if (!result.ok) return result;
  revalidate(incidentId);
  return result;
}

// ---------------------------------------------------------------------
// Beschreibung ändern (optional; Trigger schreibt Chronik + Audit)
// ---------------------------------------------------------------------
export async function changeImageDescription(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Nicht angemeldet." };
  const id = strOrNull(fd, "image_id");
  const incidentId = strOrNull(fd, "incident_id");
  if (!id || !incidentId) return { ok: false, error: "Bild/Vorgang fehlt." };
  if (!isUuid(id)) return { ok: false, error: "Bild/Vorgang fehlt." };
  const description = strOrNull(fd, "description");

  const result = await applyImageChange(session.userId, UPDATE_IMAGE_DESCRIPTION_SQL, [
    id,
    description,
  ]);
  if (!result.ok) return result;
  revalidate(incidentId);
  return result;
}

// ---------------------------------------------------------------------
// Soft Delete (kein physisches Löschen; Trigger schreibt Chronik + Audit)
//
// `deleted_at` wird auf `now()` gesetzt, also auf die DATENBANKZEIT, und nicht
// mehr auf einen in der Anwendung erzeugten Zeitstempel. Der Löschzeitpunkt
// gehört zur Chronik und darf nicht von der Uhr eines Anwendungscontainers
// abhängen.
//
// `deleted_by` MUSS hier ausdrücklich gesetzt werden: die Spalte hat KEINEN
// Default (`add column if not exists deleted_by uuid references auth.users(id)`,
// 0005_ap4_images.sql:30) – anders als `uploaded_by` und `actor`, die seit
// Migration 0012 den Default app.current_user_id() tragen und deshalb in den
// Inserts von @/lib/image-upload-core bewusst ungeschrieben bleiben. Ohne diese
// Zuweisung bliebe der Löschende unbekannt; der Chroniktrigger (0005:100)
// verwendet `coalesce(new.deleted_by, ...)` und wäre auf den Rückfall
// angewiesen.
//
// Das MinIO-Objekt bleibt bewusst STEHEN: der Soft-Delete ist eine fachliche
// Markierung, keine Vernichtung. Ein Bereinigungsprozess mit Aufbewahrungsfrist
// ist eine eigene Aufgabe und für V1 gesperrt (03-Architektur/STORAGE.md).
// ---------------------------------------------------------------------
const SOFT_DELETE_IMAGE_SQL = `
  update public.incident_images
     set deleted_at = now(), deleted_by = $2::uuid
   where id = $1::uuid and deleted_at is null`;

export async function softDeleteImage(fd: FormData): Promise<void> {
  const session = await getSessionProfile();
  if (!session) return;
  const id = strOrNull(fd, "image_id");
  const incidentId = strOrNull(fd, "incident_id");
  if (!id || !incidentId) return;
  if (!isUuid(id)) return;

  // Ein Fehlschlag – keine getroffene Zeile ODER ein technischer Fehler – wird
  // AUSSCHLIESSLICH serverseitig protokolliert.
  //
  // OFFENER PUNKT, Entscheidung nicht hier: der Rückgabetyp `void` lässt keine
  // Rückmeldung an die Oberfläche zu. Eine sichtbare Meldung wäre nur über eine
  // Signaturänderung (etwa auf FormState) möglich, und die berührt
  // components/images/ImageGallery.tsx, das die Aktion als
  // `<form action={softDeleteImage}>` einbindet – also eine sichtbare
  // Komponente. Das ist eine GUI-Entscheidung und bleibt hier unangetastet.
  try {
    const changed = await withUserTransaction(session.userId, async (client) => {
      const result = await client.query(SOFT_DELETE_IMAGE_SQL, [id, session.userId]);
      return result.rowCount ?? 0;
    });
    if (changed === 0) {
      // Bild nicht vorhanden, bereits gelöscht oder für diese Identität nicht
      // änderbar. Nennt bewusst keine Kennung.
      console.error("Bild-Soft-Delete hat keine Zeile getroffen");
    }
  } catch (error) {
    console.error(
      "Bild-Soft-Delete fehlgeschlagen (Datenbankfehler)",
      error instanceof Error ? error.message : "unbekannter Fehler",
    );
  }

  revalidate(incidentId);
}
