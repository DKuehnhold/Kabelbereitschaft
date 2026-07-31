import { NextResponse } from "next/server";
import { isUuid, withUserTransaction } from "@/lib/db";
import { getSessionProfile } from "@/lib/auth";

// Aktueller Serverstand eines Vorgangs (Status + updated_at) – für die
// Konfliktauflösung („lokale Änderung auf Basis des aktuellen Standes erneut anwenden").
// RLS greift: nur zugänglich, wenn der Nutzer den Vorgang sehen darf.
type IncidentMetaRow = { status: string; updated_at: string };

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionProfile();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  // Unbrauchbare Kennung: die Abfrage lieferte hier bisher keine Zeile, die
  // sichtbare Wirkung (404) bleibt damit gleich – ohne Verbindungsaufbau.
  if (!isUuid(id)) return NextResponse.json({ ok: false }, { status: 404 });

  let row: IncidentMetaRow | null;
  try {
    row = await withUserTransaction(session.userId, async (client) => {
      const result = await client.query<IncidentMetaRow>(
        // `to_json(updated_at)` liefert ISO-8601-Text in voller
        // Mikrosekundengenauigkeit. Der Wert ist die Konfliktbasis der
        // Offline-Nachbearbeitung; ein auf Millisekunden gekürzter Zeitstempel
        // (JS-Date) würde dort dauerhaft als Konflikt gelten.
        `select status, to_json(updated_at) as updated_at
           from public.incidents
          where id = $1::uuid`,
        [id],
      );
      return result.rows[0] ?? null;
    });
  } catch (error) {
    // Wie bisher ist ein nicht lesbarer Stand „kein Stand"; die
    // Datenbankmeldung bleibt serverseitig und gelangt nicht in die Antwort.
    console.error(
      "Vorgangsstand konnte nicht gelesen werden",
      error instanceof Error ? error.message : "unbekannter Fehler",
    );
    row = null;
  }
  if (!row) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, status: row.status, updated_at: row.updated_at });
}
