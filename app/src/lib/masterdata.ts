import { createClient } from "@/lib/supabase/server";
import type { PhoneType } from "@/lib/status";

// =====================================================================
// AP9 – Stammdaten: Reads (Sichtmodelle, entkoppelt von Embed-Typen)
// =====================================================================

export type CustomerRow = {
  id: string;
  name: string;
  erp_id: string | null;
  is_active: boolean;
};

export type StageRow = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  wus_bst: string | null;
  default_on_call_number_id: string | null;
  default_on_call_label: string | null;
  is_active: boolean;
};

export type VzgLineRow = {
  id: string;
  line_number: string;
  description: string | null;
  construction_stage_id: string;
  stage_name: string;
  is_active: boolean;
};

export type PhoneRow = {
  id: string;
  phone: string;
  phone_type: PhoneType;
  sort_order: number;
};

export type ContactRow = {
  id: string;
  customer_id: string;
  customer_name: string;
  name: string;
  function: string | null;
  email: string | null;
  is_active: boolean;
  phones: PhoneRow[];
  stage_ids: string[];
};

export type TechnicianRow = {
  id: string;
  first_name: string;
  last_name: string;
  profile_id: string | null;
  profile_name: string | null;
  is_active: boolean;
};

export type TeamRow = {
  id: string;
  name: string;
  is_active: boolean;
  member_ids: string[];
  member_names: string[];
};

export type CableTypeRow = {
  id: string;
  code: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export type OnCallRow = {
  id: string;
  number: string;
  label: string | null;
  is_active: boolean;
};

export type StageOption = { id: string; label: string };

export type AppSettingsRow = {
  id: number;
  default_customer_id: string | null;
  default_on_call_number_id: string | null;
};

// ---------------------------------------------------------------------
// Kunden
// ---------------------------------------------------------------------
export async function listCustomers(): Promise<CustomerRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id, name, erp_id, is_active")
    .order("name", { ascending: true });
  return (data ?? []) as unknown as CustomerRow[];
}

export async function getActiveCustomers(): Promise<CustomerRow[]> {
  return (await listCustomers()).filter((c) => c.is_active);
}

// ---------------------------------------------------------------------
// Bauabschnitte (construction_stages) inkl. Bereitschaftsnummer-Label
// ---------------------------------------------------------------------
export async function listStages(): Promise<StageRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("construction_stages")
    .select(
      "id, code, name, description, wus_bst, default_on_call_number_id, is_active, oncall:on_call_numbers!default_on_call_number_id(number, label)",
    )
    .order("name", { ascending: true });
  return ((data as Record<string, unknown>[]) ?? []).map((s) => {
    const oc = s.oncall as { number?: string; label?: string | null } | null;
    const ocLabel = oc ? (oc.label ? `${oc.number} – ${oc.label}` : oc.number ?? null) : null;
    return {
      id: s.id as string,
      code: (s.code as string | null) ?? null,
      name: s.name as string,
      description: (s.description as string | null) ?? null,
      wus_bst: (s.wus_bst as string | null) ?? null,
      default_on_call_number_id: (s.default_on_call_number_id as string | null) ?? null,
      default_on_call_label: ocLabel,
      is_active: s.is_active as boolean,
    };
  });
}

export async function getActiveStageOptions(): Promise<StageOption[]> {
  return (await listStages())
    .filter((s) => s.is_active)
    .map((s) => ({ id: s.id, label: s.code ? `${s.code} – ${s.name}` : s.name }));
}

// ---------------------------------------------------------------------
// Bereitschaftsnummern (bestehende Tabelle on_call_numbers wiederverwendet)
// ---------------------------------------------------------------------
export async function listOnCallNumbers(): Promise<OnCallRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("on_call_numbers")
    .select("id, number, label, is_active")
    .order("number", { ascending: true });
  return (data ?? []) as unknown as OnCallRow[];
}

export async function getActiveOnCallOptions(): Promise<StageOption[]> {
  return (await listOnCallNumbers())
    .filter((o) => o.is_active)
    .map((o) => ({ id: o.id, label: o.label ? `${o.number} – ${o.label}` : o.number }));
}

// ---------------------------------------------------------------------
// VzG-Strecken
// ---------------------------------------------------------------------
export async function listVzgLines(): Promise<VzgLineRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vzg_lines")
    .select("id, line_number, description, construction_stage_id, is_active, stage:construction_stages!construction_stage_id(name, code)")
    .order("line_number", { ascending: true });
  return ((data as Record<string, unknown>[]) ?? []).map((v) => {
    const st = v.stage as { name?: string; code?: string | null } | null;
    const stageName = st ? (st.code ? `${st.code} – ${st.name}` : st.name ?? "—") : "—";
    return {
      id: v.id as string,
      line_number: v.line_number as string,
      description: (v.description as string | null) ?? null,
      construction_stage_id: v.construction_stage_id as string,
      stage_name: stageName,
      is_active: v.is_active as boolean,
    };
  });
}

// ---------------------------------------------------------------------
// Ansprechpartner inkl. Telefonnummern + Bauabschnitts-Zuordnung
// ---------------------------------------------------------------------
export async function listContacts(): Promise<ContactRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select(
      "id, customer_id, name, function, email, is_active, customer:customers!customer_id(name), phones:contact_phone_numbers(id, phone, phone_type, sort_order), stages:construction_stage_contacts(construction_stage_id)",
    )
    .order("name", { ascending: true });
  return ((data as Record<string, unknown>[]) ?? []).map((c) => {
    const cust = c.customer as { name?: string } | null;
    const phones = ((c.phones as Record<string, unknown>[]) ?? [])
      .map((p) => ({
        id: p.id as string,
        phone: p.phone as string,
        phone_type: p.phone_type as PhoneType,
        sort_order: Number(p.sort_order ?? 0),
      }))
      .sort((a, b) => a.sort_order - b.sort_order);
    const stage_ids = ((c.stages as Record<string, unknown>[]) ?? []).map(
      (s) => s.construction_stage_id as string,
    );
    return {
      id: c.id as string,
      customer_id: c.customer_id as string,
      customer_name: cust?.name ?? "—",
      name: c.name as string,
      function: (c.function as string | null) ?? null,
      email: (c.email as string | null) ?? null,
      is_active: c.is_active as boolean,
      phones,
      stage_ids,
    };
  });
}

// ---------------------------------------------------------------------
// Monteure
// ---------------------------------------------------------------------
export async function listTechnicians(): Promise<TechnicianRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("technicians")
    .select("id, first_name, last_name, profile_id, is_active, profile:profiles!profile_id(full_name)")
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });
  return ((data as Record<string, unknown>[]) ?? []).map((t) => {
    const p = t.profile as { full_name?: string | null } | null;
    return {
      id: t.id as string,
      first_name: t.first_name as string,
      last_name: t.last_name as string,
      profile_id: (t.profile_id as string | null) ?? null,
      profile_name: p?.full_name ?? null,
      is_active: t.is_active as boolean,
    };
  });
}

export async function getActiveTechnicians(): Promise<TechnicianRow[]> {
  return (await listTechnicians()).filter((t) => t.is_active);
}

// ---------------------------------------------------------------------
// Teams inkl. Mitglieder
// ---------------------------------------------------------------------
export async function listTeams(): Promise<TeamRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("teams")
    .select(
      "id, name, is_active, members:team_members(technician_id, technician:technicians!technician_id(first_name, last_name))",
    )
    .order("name", { ascending: true });
  return ((data as Record<string, unknown>[]) ?? []).map((t) => {
    const members = (t.members as Record<string, unknown>[]) ?? [];
    const member_ids = members.map((m) => m.technician_id as string);
    const member_names = members
      .map((m) => {
        const tech = m.technician as { first_name?: string; last_name?: string } | null;
        return tech ? `${tech.first_name ?? ""} ${tech.last_name ?? ""}`.trim() : "";
      })
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    return {
      id: t.id as string,
      name: t.name as string,
      is_active: t.is_active as boolean,
      member_ids,
      member_names,
    };
  });
}

// ---------------------------------------------------------------------
// Kabelarten
// ---------------------------------------------------------------------
export async function listCableTypes(): Promise<CableTypeRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cable_types")
    .select("id, code, name, sort_order, is_active")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  return (data ?? []) as unknown as CableTypeRow[];
}

// ---------------------------------------------------------------------
// Benutzerkonten (profiles) – Optionen für optionale Monteur-Verknüpfung
// ---------------------------------------------------------------------
export async function listProfileOptions(): Promise<StageOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .order("full_name", { ascending: true });
  return ((data ?? []) as { id: string; full_name: string | null; role: string }[]).map((p) => ({
    id: p.id,
    label: `${p.full_name ?? p.id} (${p.role})`,
  }));
}

// ---------------------------------------------------------------------
// App-Einstellungen (Singleton)
// ---------------------------------------------------------------------
export async function getAppSettings(): Promise<AppSettingsRow> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("id, default_customer_id, default_on_call_number_id")
    .eq("id", 1)
    .maybeSingle();
  return (
    (data as unknown as AppSettingsRow) ?? {
      id: 1,
      default_customer_id: null,
      default_on_call_number_id: null,
    }
  );
}
