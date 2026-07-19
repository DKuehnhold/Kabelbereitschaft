import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";

// Aktueller Serverstand eines Vorgangs (Status + updated_at) – für die
// Konfliktauflösung („lokale Änderung auf Basis des aktuellen Standes erneut anwenden").
// RLS greift: nur zugänglich, wenn der Nutzer den Vorgang sehen darf.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionProfile();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("incidents")
    .select("status, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!data) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, status: data.status, updated_at: data.updated_at });
}
