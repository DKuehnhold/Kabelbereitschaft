"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { PHONE_TYPES, type PhoneType } from "@/lib/status";
import type { FormState } from "@/lib/incidents";
import {
  parseTechnicianCsv,
  technicianKey,
  classifyImport,
  type ImportPreview,
  type ImportCommitResult,
} from "@/lib/csv-import";

// ---------------------------------------------------------------------
// Helfer
// ---------------------------------------------------------------------
function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
function strOrNull(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v === "" ? null : v;
}
function intOrZero(fd: FormData, key: string): number {
  const v = str(fd, key);
  const x = parseInt(v, 10);
  return Number.isFinite(x) && x >= 0 ? x : 0;
}

async function requireStaff() {
  const s = await getSessionProfile();
  return s && (s.role === "admin" || s.role === "disponent") ? s : null;
}

const STAFF_ONLY = "Nur Administration und Disposition dürfen Stammdaten verwalten.";

function saveErr(message: string): FormState {
  // DB-Fehler benutzerfreundlich zusammenfassen (z. B. Unique-Verletzung).
  if (/duplicate key|unique|23505/i.test(message)) {
    return { ok: false, error: `Speichern fehlgeschlagen: Eintrag ist bereits vorhanden (Eindeutigkeit verletzt).` };
  }
  if (/vzg_lines_number_format|23514/i.test(message)) {
    return { ok: false, error: `Speichern fehlgeschlagen: Ungültiges Format.` };
  }
  return { ok: false, error: `Speichern fehlgeschlagen: ${message}` };
}

function revalidateMaster() {
  for (const p of [
    "/stammdaten/kunden",
    "/stammdaten/bauabschnitte",
    "/stammdaten/vzg",
    "/stammdaten/ansprechpartner",
    "/stammdaten/monteure",
    "/stammdaten/teams",
    "/stammdaten/kabelarten",
    "/stammdaten/einstellungen",
  ]) {
    revalidatePath(p);
  }
}

// =====================================================================
// Kunden
// =====================================================================
export async function saveCustomer(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await requireStaff())) return { ok: false, error: STAFF_ONLY };
  const id = strOrNull(fd, "id");
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "Kundenname ist erforderlich." };
  const payload = {
    name,
    erp_id: strOrNull(fd, "erp_id"),
    is_active: str(fd, "is_active") !== "false",
  };
  const supabase = await createClient();
  const res = id
    ? await supabase.from("customers").update(payload).eq("id", id)
    : await supabase.from("customers").insert(payload);
  if (res.error) return saveErr(res.error.message);
  revalidateMaster();
  return { ok: true, error: null };
}

export async function setCustomerActive(fd: FormData): Promise<void> {
  if (!(await requireStaff())) return;
  const id = str(fd, "id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("customers").update({ is_active: str(fd, "active") === "true" }).eq("id", id);
  revalidateMaster();
}

// =====================================================================
// Bauabschnitte (construction_stages)
// =====================================================================
export async function saveStage(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await requireStaff())) return { ok: false, error: STAFF_ONLY };
  const id = strOrNull(fd, "id");
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "Bezeichnung ist erforderlich." };
  const payload = {
    code: strOrNull(fd, "code"),
    name,
    description: strOrNull(fd, "description"),
    wus_bst: strOrNull(fd, "wus_bst"),
    default_on_call_number_id: strOrNull(fd, "default_on_call_number_id"),
    is_active: str(fd, "is_active") !== "false",
  };
  const supabase = await createClient();
  const res = id
    ? await supabase.from("construction_stages").update(payload).eq("id", id)
    : await supabase.from("construction_stages").insert(payload);
  if (res.error) return saveErr(res.error.message);
  revalidateMaster();
  return { ok: true, error: null };
}

export async function setStageActive(fd: FormData): Promise<void> {
  if (!(await requireStaff())) return;
  const id = str(fd, "id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("construction_stages").update({ is_active: str(fd, "active") === "true" }).eq("id", id);
  revalidateMaster();
}

// =====================================================================
// VzG-Strecken
// =====================================================================
export async function saveVzgLine(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await requireStaff())) return { ok: false, error: STAFF_ONLY };
  const id = strOrNull(fd, "id");
  const line_number = str(fd, "line_number");
  const construction_stage_id = strOrNull(fd, "construction_stage_id");
  if (!/^[0-9]{4}$/.test(line_number))
    return { ok: false, error: "Die VzG-Streckennummer muss aus genau vier Ziffern bestehen." };
  if (!construction_stage_id) return { ok: false, error: "Bauabschnitt ist erforderlich." };
  const payload = {
    line_number,
    description: strOrNull(fd, "description"),
    construction_stage_id,
    is_active: str(fd, "is_active") !== "false",
  };
  const supabase = await createClient();
  const res = id
    ? await supabase.from("vzg_lines").update(payload).eq("id", id)
    : await supabase.from("vzg_lines").insert(payload);
  if (res.error) {
    if (/unique|duplicate|23505/i.test(res.error.message))
      return { ok: false, error: "Diese VzG-Streckennummer ist für diesen Bauabschnitt bereits vergeben." };
    return saveErr(res.error.message);
  }
  revalidateMaster();
  return { ok: true, error: null };
}

export async function setVzgLineActive(fd: FormData): Promise<void> {
  if (!(await requireStaff())) return;
  const id = str(fd, "id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("vzg_lines").update({ is_active: str(fd, "active") === "true" }).eq("id", id);
  revalidateMaster();
}

// =====================================================================
// Ansprechpartner (inkl. Telefonnummern + Bauabschnitts-Zuordnung)
// =====================================================================
type PhoneInput = { phone: string; phone_type: PhoneType; sort_order: number };

function parsePhones(fd: FormData): PhoneInput[] {
  const raw = str(fd, "phones_json");
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((p: unknown, i: number) => {
        const o = (p ?? {}) as { phone?: unknown; phone_type?: unknown };
        const phone = String(o.phone ?? "").trim();
        const pt = String(o.phone_type ?? "sonstige") as PhoneType;
        return {
          phone,
          phone_type: (PHONE_TYPES as readonly string[]).includes(pt) ? pt : ("sonstige" as PhoneType),
          sort_order: i,
        };
      })
      .filter((p) => p.phone !== "");
  } catch {
    return [];
  }
}

export async function saveContact(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await requireStaff())) return { ok: false, error: STAFF_ONLY };
  const id = strOrNull(fd, "id");
  const customer_id = strOrNull(fd, "customer_id");
  const name = str(fd, "name");
  if (!customer_id) return { ok: false, error: "Kunde ist erforderlich." };
  if (!name) return { ok: false, error: "Name ist erforderlich." };

  const payload = {
    customer_id,
    name,
    function: strOrNull(fd, "function"),
    email: strOrNull(fd, "email"),
    is_active: str(fd, "is_active") !== "false",
  };

  const supabase = await createClient();
  let contactId = id;
  if (id) {
    const res = await supabase.from("contacts").update(payload).eq("id", id);
    if (res.error) return saveErr(res.error.message);
  } else {
    const res = await supabase.from("contacts").insert(payload).select("id").single();
    if (res.error || !res.data) return saveErr(res.error?.message ?? "unbekannt");
    contactId = (res.data as { id: string }).id;
  }
  if (!contactId) return saveErr("Kontakt-ID konnte nicht ermittelt werden.");

  // Telefonnummern: vollständig ersetzen (staff-verwaltete Stammdaten).
  const phones = parsePhones(fd);
  const delPhones = await supabase.from("contact_phone_numbers").delete().eq("contact_id", contactId);
  if (delPhones.error) return saveErr(delPhones.error.message);
  if (phones.length > 0) {
    const rows = phones.map((p, i) => ({
      contact_id: contactId,
      phone: p.phone,
      phone_type: p.phone_type,
      sort_order: i,
    }));
    const insPhones = await supabase.from("contact_phone_numbers").insert(rows);
    if (insPhones.error) return saveErr(insPhones.error.message);
  }

  // Bauabschnitts-Zuordnung: vollständig ersetzen.
  const stageIds = fd.getAll("stage_ids").map(String).filter(Boolean);
  const delStages = await supabase.from("construction_stage_contacts").delete().eq("contact_id", contactId);
  if (delStages.error) return saveErr(delStages.error.message);
  if (stageIds.length > 0) {
    const rows = stageIds.map((sid) => ({ construction_stage_id: sid, contact_id: contactId }));
    const insStages = await supabase.from("construction_stage_contacts").insert(rows);
    if (insStages.error) return saveErr(insStages.error.message);
  }

  revalidateMaster();
  return { ok: true, error: null };
}

export async function setContactActive(fd: FormData): Promise<void> {
  if (!(await requireStaff())) return;
  const id = str(fd, "id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("contacts").update({ is_active: str(fd, "active") === "true" }).eq("id", id);
  revalidateMaster();
}

// =====================================================================
// Monteure
// =====================================================================
export async function saveTechnician(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await requireStaff())) return { ok: false, error: STAFF_ONLY };
  const id = strOrNull(fd, "id");
  const first_name = str(fd, "first_name");
  const last_name = str(fd, "last_name");
  if (!first_name) return { ok: false, error: "Vorname ist erforderlich." };
  if (!last_name) return { ok: false, error: "Nachname ist erforderlich." };
  const payload = {
    first_name,
    last_name,
    profile_id: strOrNull(fd, "profile_id"),
    is_active: str(fd, "is_active") !== "false",
  };
  const supabase = await createClient();
  const res = id
    ? await supabase.from("technicians").update(payload).eq("id", id)
    : await supabase.from("technicians").insert(payload);
  if (res.error) {
    if (/unique|duplicate|23505/i.test(res.error.message))
      return { ok: false, error: "Diese Profil-ID ist bereits einem Monteur zugeordnet." };
    return saveErr(res.error.message);
  }
  revalidateMaster();
  return { ok: true, error: null };
}

export async function setTechnicianActive(fd: FormData): Promise<void> {
  if (!(await requireStaff())) return;
  const id = str(fd, "id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("technicians").update({ is_active: str(fd, "active") === "true" }).eq("id", id);
  revalidateMaster();
}

// ---- Monteur-CSV-Import (Vorschau + Commit) -------------------------
async function existingTechnicianSets() {
  const supabase = await createClient();
  const { data } = await supabase.from("technicians").select("first_name, last_name, profile_id");
  const names = new Set<string>();
  const profiles = new Set<string>();
  for (const t of (data ?? []) as { first_name: string; last_name: string; profile_id: string | null }[]) {
    names.add(technicianKey(t.first_name, t.last_name));
    if (t.profile_id) profiles.add(t.profile_id.toLowerCase());
  }
  return { names, profiles };
}

export async function previewTechnicianImport(text: string): Promise<ImportPreview> {
  if (!(await requireStaff())) {
    return {
      ok: false,
      fatal: STAFF_ONLY,
      delimiter: ";",
      rows: [],
      summary: { total: 0, neu: 0, dublette_datei: 0, dublette_db: 0, fehler: 0 },
    };
  }
  const parsed = parseTechnicianCsv(text);
  const { names, profiles } = await existingTechnicianSets();
  return classifyImport(parsed, names, profiles);
}

export async function commitTechnicianImport(text: string): Promise<ImportCommitResult> {
  if (!(await requireStaff())) return { ok: false, inserted: 0, skipped: 0, failed: 0, message: STAFF_ONLY };
  const parsed = parseTechnicianCsv(text);
  if (parsed.fatal) return { ok: false, inserted: 0, skipped: 0, failed: 0, message: parsed.fatal };
  const { names, profiles } = await existingTechnicianSets();
  const preview = classifyImport(parsed, names, profiles);

  const toInsert = preview.rows
    .filter((r) => r.status === "neu")
    .map((r) => ({
      first_name: r.first_name,
      last_name: r.last_name,
      is_active: r.is_active,
      profile_id: r.profile_id,
    }));

  const skipped = preview.summary.dublette_datei + preview.summary.dublette_db + preview.summary.fehler;
  if (toInsert.length === 0) {
    return { ok: true, inserted: 0, skipped, failed: 0, message: "Keine neuen Monteure zum Anlegen." };
  }

  const supabase = await createClient();
  const res = await supabase.from("technicians").insert(toInsert);
  if (res.error) {
    return { ok: false, inserted: 0, skipped, failed: toInsert.length, message: `Import fehlgeschlagen: ${res.error.message}` };
  }
  revalidateMaster();
  return {
    ok: true,
    inserted: toInsert.length,
    skipped,
    failed: 0,
    message: `${toInsert.length} Monteur(e) angelegt, ${skipped} übersprungen.`,
  };
}

// =====================================================================
// Teams (inkl. Mitglieder)
// =====================================================================
export async function saveTeam(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await requireStaff())) return { ok: false, error: STAFF_ONLY };
  const id = strOrNull(fd, "id");
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "Teamname ist erforderlich." };
  const payload = { name, is_active: str(fd, "is_active") !== "false" };

  const supabase = await createClient();
  let teamId = id;
  if (id) {
    const res = await supabase.from("teams").update(payload).eq("id", id);
    if (res.error) return saveErr(res.error.message);
  } else {
    const res = await supabase.from("teams").insert(payload).select("id").single();
    if (res.error || !res.data) return saveErr(res.error?.message ?? "unbekannt");
    teamId = (res.data as { id: string }).id;
  }
  if (!teamId) return saveErr("Team-ID konnte nicht ermittelt werden.");

  const memberIds = Array.from(new Set(fd.getAll("member_ids").map(String).filter(Boolean)));
  const del = await supabase.from("team_members").delete().eq("team_id", teamId);
  if (del.error) return saveErr(del.error.message);
  if (memberIds.length > 0) {
    const rows = memberIds.map((tid) => ({ team_id: teamId, technician_id: tid }));
    const ins = await supabase.from("team_members").insert(rows);
    if (ins.error) return saveErr(ins.error.message);
  }

  revalidateMaster();
  return { ok: true, error: null };
}

export async function setTeamActive(fd: FormData): Promise<void> {
  if (!(await requireStaff())) return;
  const id = str(fd, "id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("teams").update({ is_active: str(fd, "active") === "true" }).eq("id", id);
  revalidateMaster();
}

// =====================================================================
// Kabelarten
// =====================================================================
export async function saveCableType(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await requireStaff())) return { ok: false, error: STAFF_ONLY };
  const id = strOrNull(fd, "id");
  const code = str(fd, "code");
  const name = str(fd, "name");
  if (!code) return { ok: false, error: "Code ist erforderlich." };
  if (!name) return { ok: false, error: "Bezeichnung ist erforderlich." };
  const payload = {
    code,
    name,
    sort_order: intOrZero(fd, "sort_order"),
    is_active: str(fd, "is_active") !== "false",
  };
  const supabase = await createClient();
  const res = id
    ? await supabase.from("cable_types").update(payload).eq("id", id)
    : await supabase.from("cable_types").insert(payload);
  if (res.error) {
    if (/unique|duplicate|23505/i.test(res.error.message))
      return { ok: false, error: "Dieser Kabelart-Code ist bereits vergeben." };
    return saveErr(res.error.message);
  }
  revalidateMaster();
  return { ok: true, error: null };
}

export async function setCableTypeActive(fd: FormData): Promise<void> {
  if (!(await requireStaff())) return;
  const id = str(fd, "id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("cable_types").update({ is_active: str(fd, "active") === "true" }).eq("id", id);
  revalidateMaster();
}

// =====================================================================
// App-Einstellungen (Singleton id = 1)
// =====================================================================
export async function saveSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await requireStaff())) return { ok: false, error: STAFF_ONLY };
  const payload = {
    id: 1,
    default_customer_id: strOrNull(fd, "default_customer_id"),
    default_on_call_number_id: strOrNull(fd, "default_on_call_number_id"),
  };
  const supabase = await createClient();
  // Singletonzeile existiert aus der Migration; upsert sichert Robustheit ab.
  const res = await supabase.from("app_settings").upsert(payload, { onConflict: "id" });
  if (res.error) return saveErr(res.error.message);
  revalidateMaster();
  return { ok: true, error: null };
}
