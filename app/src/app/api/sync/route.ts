import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { INCIDENT_STATUS, MONTEUR_STATUS, type IncidentStatus } from "@/lib/status";

type SyncItem = {
  id: string;
  kind: "note" | "status";
  incidentId: string;
  body?: string;
  status?: string;
  baseUpdatedAt?: string | null;
};
type ItemResult = {
  id: string;
  result: "applied" | "conflict" | "error";
  message?: string;
  serverUpdatedAt?: string | null;
};

// Wendet vorgemerkte Offline-Mutationen (Notizen/Statusänderungen) an.
// Konflikterkennung über incidents.updated_at – keine stillschweigende Überschreibung.
// RLS ist maßgeblich (Client trägt die Session-Cookies).
export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session) return NextResponse.json({ ok: false, error: "Nicht angemeldet." }, { status: 401 });

  let body: { items?: SyncItem[] };
  try {
    body = (await req.json()) as { items?: SyncItem[] };
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültige Anfrage." }, { status: 400 });
  }
  const items = Array.isArray(body.items) ? body.items : [];
  const supabase = await createClient();
  const results: ItemResult[] = [];

  for (const it of items) {
    try {
      if (it.kind === "note") {
        if (!it.incidentId || !it.body?.trim()) {
          results.push({ id: it.id, result: "error", message: "Notiz unvollständig" });
          continue;
        }
        const { error } = await supabase
          .from("incident_notes")
          .insert({ incident_id: it.incidentId, body: it.body.trim(), note_type: "allgemein" });
        results.push(error ? { id: it.id, result: "error", message: error.message } : { id: it.id, result: "applied" });
      } else if (it.kind === "status") {
        const status = it.status as IncidentStatus;
        if (!it.incidentId || !INCIDENT_STATUS.includes(status)) {
          results.push({ id: it.id, result: "error", message: "Ungültiger Status" });
          continue;
        }
        if (session.role === "monteur" && !MONTEUR_STATUS.includes(status)) {
          results.push({ id: it.id, result: "error", message: "Status für Monteur nicht erlaubt" });
          continue;
        }
        const { data: cur } = await supabase
          .from("incidents")
          .select("updated_at")
          .eq("id", it.incidentId)
          .maybeSingle();
        if (!cur) {
          results.push({ id: it.id, result: "error", message: "Vorgang nicht gefunden oder kein Zugriff" });
          continue;
        }
        if (
          it.baseUpdatedAt && cur.updated_at &&
          new Date(cur.updated_at).getTime() !== new Date(it.baseUpdatedAt).getTime()
        ) {
          results.push({
            id: it.id, result: "conflict",
            message: "Vorgang wurde zwischenzeitlich serverseitig geändert",
            serverUpdatedAt: cur.updated_at,
          });
          continue;
        }
        const { error } = await supabase.from("incidents").update({ status }).eq("id", it.incidentId);
        results.push(error ? { id: it.id, result: "error", message: error.message } : { id: it.id, result: "applied" });
      } else {
        results.push({ id: it.id, result: "error", message: "Unbekannter Typ" });
      }
    } catch (e) {
      results.push({ id: it.id, result: "error", message: e instanceof Error ? e.message : "Fehler" });
    }
  }

  return NextResponse.json({ ok: true, results });
}
