"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { STORAGE_LOCATION_TYPES, type MovementType } from "@/lib/status";
import type { FormState } from "@/lib/incidents";
import { returnableQuantity } from "@/lib/inventory";

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
function strOrNull(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v === "" ? null : v;
}
function num(fd: FormData, key: string): number | null {
  const v = str(fd, key).replace(",", ".");
  if (v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}
function revalidateInventory(incidentId?: string) {
  revalidatePath("/material");
  revalidatePath("/lager");
  revalidatePath("/bestand");
  revalidatePath("/materialhistorie");
  revalidatePath("/dashboard");
  if (incidentId) revalidatePath(`/vorgaenge/${incidentId}`);
}

async function requireAdmin() {
  const s = await getSessionProfile();
  return s && s.role === "admin" ? s : null;
}

// =====================================================================
// Materialstammdaten (Administrator)
// =====================================================================
export async function saveMaterial(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Nur Administratoren dürfen Material verwalten." };

  const id = strOrNull(fd, "id");
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "Bezeichnung ist erforderlich." };

  const payload = {
    material_no: strOrNull(fd, "material_no"),
    name,
    note: strOrNull(fd, "note"),
    unit: str(fd, "unit") || "Stk",
    category: strOrNull(fd, "category"),
    min_stock: num(fd, "min_stock"),
    is_active: str(fd, "is_active") !== "false",
  };

  const supabase = await createClient();
  const res = id
    ? await supabase.from("materials").update(payload).eq("id", id)
    : await supabase.from("materials").insert(payload);
  if (res.error) return { ok: false, error: `Speichern fehlgeschlagen: ${res.error.message}` };
  revalidateInventory();
  return { ok: true, error: null };
}

export async function setMaterialActive(fd: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;
  const id = str(fd, "id");
  if (!id) return;
  const active = str(fd, "active") === "true";
  const supabase = await createClient();
  await supabase.from("materials").update({ is_active: active }).eq("id", id);
  revalidateInventory();
}

// =====================================================================
// Lagerorte (Administrator)
// =====================================================================
export async function saveLocation(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Nur Administratoren dürfen Lagerorte verwalten." };

  const id = strOrNull(fd, "id");
  const name = str(fd, "name");
  const location_type = str(fd, "location_type");
  if (!name) return { ok: false, error: "Lagername ist erforderlich." };
  if (!STORAGE_LOCATION_TYPES.includes(location_type as (typeof STORAGE_LOCATION_TYPES)[number])) {
    return { ok: false, error: "Bitte einen gültigen Lagerorttyp wählen." };
  }

  const payload = {
    name,
    location_type: location_type as (typeof STORAGE_LOCATION_TYPES)[number],
    note: strOrNull(fd, "note"),
    is_active: str(fd, "is_active") !== "false",
  };

  const supabase = await createClient();
  const res = id
    ? await supabase.from("storage_locations").update(payload).eq("id", id)
    : await supabase.from("storage_locations").insert(payload);
  if (res.error) return { ok: false, error: `Speichern fehlgeschlagen: ${res.error.message}` };
  revalidateInventory();
  return { ok: true, error: null };
}

export async function setLocationActive(fd: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;
  const id = str(fd, "id");
  if (!id) return;
  const active = str(fd, "active") === "true";
  const supabase = await createClient();
  await supabase.from("storage_locations").update({ is_active: active }).eq("id", id);
  revalidateInventory();
}

// =====================================================================
// Lagerbewegungen (Administrator): Wareneingang/Umbuchung/Korrektur/Verlust/Beschädigung
// =====================================================================
const ADMIN_MOVEMENTS: MovementType[] = [
  "wareneingang", "umbuchung", "korrektur", "verlust", "beschaedigung",
];

export async function createMovement(_prev: FormState, fd: FormData): Promise<FormState> {
  const s = await getSessionProfile();
  if (!s || s.role === "monteur")
    return { ok: false, error: "Diese Buchung ist der Disposition/Administration vorbehalten." };

  const movement_type = str(fd, "movement_type") as MovementType;
  if (!ADMIN_MOVEMENTS.includes(movement_type))
    return { ok: false, error: "Ungültiger Bewegungstyp." };

  const material_id = strOrNull(fd, "material_id");
  const quantity = num(fd, "quantity");
  if (!material_id) return { ok: false, error: "Material ist erforderlich." };
  if (quantity === null || quantity <= 0) return { ok: false, error: "Menge muss größer als 0 sein." };

  let source = strOrNull(fd, "source_location_id");
  let target = strOrNull(fd, "target_location_id");

  if (movement_type === "wareneingang") {
    source = null;
    if (!target) return { ok: false, error: "Ziellager ist erforderlich." };
  } else if (movement_type === "umbuchung") {
    if (!source || !target) return { ok: false, error: "Quell- und Ziellager sind erforderlich." };
    if (source === target) return { ok: false, error: "Quell- und Ziellager müssen verschieden sein." };
  } else if (movement_type === "verlust" || movement_type === "beschaedigung") {
    target = null;
    if (!source) return { ok: false, error: "Quelllager ist erforderlich." };
  } else if (movement_type === "korrektur") {
    if ((source && target) || (!source && !target))
      return { ok: false, error: "Bei Korrektur genau ein Lager (Zugang ODER Abgang) wählen." };
  }

  const supabase = await createClient();
  const { data: mat } = await supabase.from("materials").select("unit, is_active").eq("id", material_id).single();
  if (mat && (mat as { is_active: boolean }).is_active === false)
    return { ok: false, error: "Material ist inaktiv." };

  const { error } = await supabase.from("inventory_movements").insert({
    material_id,
    quantity,
    unit: (mat as { unit?: string })?.unit ?? "Stk",
    movement_type,
    source_location_id: source,
    target_location_id: target,
    note: strOrNull(fd, "note"),
  });
  if (error) return { ok: false, error: `Buchung fehlgeschlagen: ${error.message}` };
  revalidateInventory();
  return { ok: true, error: null };
}

// =====================================================================
// Monteur/Staff: Entnahme, Rückgabe, Verbrauch (vorgangsbezogen)
// =====================================================================
async function materialUnit(supabase: Awaited<ReturnType<typeof createClient>>, materialId: string): Promise<string> {
  const { data } = await supabase.from("materials").select("unit").eq("id", materialId).single();
  return (data as { unit?: string } | null)?.unit ?? "Stk";
}

export async function takeoutMaterial(_prev: FormState, fd: FormData): Promise<FormState> {
  const s = await getSessionProfile();
  if (!s) return { ok: false, error: "Nicht angemeldet." };
  const incident_id = strOrNull(fd, "incident_id");
  const material_id = strOrNull(fd, "material_id");
  const source_location_id = strOrNull(fd, "source_location_id");
  const quantity = num(fd, "quantity");
  if (!incident_id) return { ok: false, error: "Keine Entnahme ohne Vorgang möglich." };
  if (!material_id || !source_location_id) return { ok: false, error: "Material und Lager sind erforderlich." };
  if (quantity === null || quantity <= 0) return { ok: false, error: "Menge muss größer als 0 sein." };

  const supabase = await createClient();
  const { error } = await supabase.from("inventory_movements").insert({
    material_id,
    quantity,
    unit: await materialUnit(supabase, material_id),
    movement_type: "entnahme_vorgang",
    source_location_id,
    incident_id,
    note: strOrNull(fd, "note"),
  });
  if (error) return { ok: false, error: `Entnahme fehlgeschlagen (evtl. Bestand zu gering): ${error.message}` };
  revalidateInventory(incident_id);
  return { ok: true, error: null };
}

export async function returnMaterial(_prev: FormState, fd: FormData): Promise<FormState> {
  const s = await getSessionProfile();
  if (!s) return { ok: false, error: "Nicht angemeldet." };
  const incident_id = strOrNull(fd, "incident_id");
  const material_id = strOrNull(fd, "material_id");
  const target_location_id = strOrNull(fd, "target_location_id");
  const quantity = num(fd, "quantity");
  if (!incident_id || !material_id || !target_location_id)
    return { ok: false, error: "Vorgang, Material und Lager sind erforderlich." };
  if (quantity === null || quantity <= 0) return { ok: false, error: "Menge muss größer als 0 sein." };

  const available = await returnableQuantity(incident_id, material_id);
  if (quantity > available)
    return { ok: false, error: `Rückgabe (${quantity}) größer als entnommene Restmenge (${available}).` };

  const supabase = await createClient();
  const { error } = await supabase.from("inventory_movements").insert({
    material_id,
    quantity,
    unit: await materialUnit(supabase, material_id),
    movement_type: "rueckgabe",
    target_location_id,
    incident_id,
    note: strOrNull(fd, "note"),
  });
  if (error) return { ok: false, error: `Rückgabe fehlgeschlagen: ${error.message}` };
  revalidateInventory(incident_id);
  return { ok: true, error: null };
}

export async function consumeMaterial(_prev: FormState, fd: FormData): Promise<FormState> {
  const s = await getSessionProfile();
  if (!s) return { ok: false, error: "Nicht angemeldet." };
  const incident_id = strOrNull(fd, "incident_id");
  const material_id = strOrNull(fd, "material_id");
  const source_location_id = strOrNull(fd, "source_location_id");
  const quantity = num(fd, "quantity");
  if (!incident_id || !material_id || !source_location_id)
    return { ok: false, error: "Vorgang, Material und Lager sind erforderlich." };
  if (quantity === null || quantity <= 0) return { ok: false, error: "Menge muss größer als 0 sein." };

  const supabase = await createClient();
  const { error } = await supabase.from("inventory_movements").insert({
    material_id,
    quantity,
    unit: await materialUnit(supabase, material_id),
    movement_type: "verbrauch",
    source_location_id,
    incident_id,
    note: strOrNull(fd, "note"),
  });
  if (error) return { ok: false, error: `Verbrauch fehlgeschlagen (evtl. Bestand zu gering): ${error.message}` };
  revalidateInventory(incident_id);
  return { ok: true, error: null };
}
