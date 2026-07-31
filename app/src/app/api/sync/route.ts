import { NextResponse } from "next/server";
import { withUserTransaction, type DatabaseClient } from "@/lib/db";
import { isPgError, PG_UNIQUE_VIOLATION } from "@/lib/db/pg-errors";
import { getSessionProfile } from "@/lib/auth";
import { INCIDENT_STATUS, MONTEUR_STATUS, type IncidentStatus } from "@/lib/status";

type SyncItem = {
  id: string;
  clientActionId: string; // stabile Idempotenz-ID (= Outbox-ID)
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
// Idempotenz über public.sync_actions (unique actor+client_action_id): ein Retry
// derselben Aktion wird dedupliziert (kein Duplikat). Konflikterkennung über
// incidents.updated_at – keine stille Überschreibung. RLS ist maßgeblich.
//
// AP14/B: jeder Eintrag läuft in EINER eigenen Transaktion über
// withUserTransaction() mit der Identität aus der geprüften Auth.js-Sitzung
// (ADR-011 / 2.5). Der frühere Kompensations-DELETE auf sync_actions entfällt;
// an seine Stelle tritt der echte Transaktionsrollback, weshalb app_user auf
// dieser Tabelle bewusst kein delete-Recht hat (Migration 0014).
//
// Warum je Eintrag und nicht eine Transaktion für den ganzen Stapel: die
// Einträge sind fachlich unabhängig, und die Antwort meldet je Eintrag ein
// eigenes Ergebnis. Bei einer Stapeltransaktion würde ein Konflikt an Eintrag 3
// die Einträge 1 und 2 mit zurückrollen, während die Antwort sie als "applied"
// meldet – der Client löscht dann seine Outbox-Einträge und die Daten wären
// verloren.

// Erlaubte Aktionsarten (feste Allow-List). Die Spalte sync_actions.kind hat
// keinen Check-Constraint; diese Prüfung ist die einzige Schranke.
const SYNC_KINDS = ["note", "status"] as const;

function isSyncKind(value: unknown): value is SyncItem["kind"] {
  return (SYNC_KINDS as readonly unknown[]).includes(value);
}

// Einzige Meldung für technische Fehler. Eine Datenbankmeldung gelangt nie in
// die Antwort: sie nennt Tabellen-, Spalten- und Constraint-Namen.
const APPLY_FAILED = "Die Aktion konnte nicht angewendet werden.";

/**
 * Fachliche Ablehnung innerhalb der Transaktion – modulprivates Sentinel.
 *
 * withUserTransaction() committet, sobald der Rückruf normal zurückkehrt. Ein
 * Konflikt oder eine Validierungsablehnung muss aber ZURÜCKROLLEN (damit der
 * Dedup-Marker verschwindet) und trotzdem ein fachliches Ergebnis liefern.
 * Deshalb wird sie geworfen, außerhalb des Wrappers gefangen und dort in das
 * Ergebnisobjekt übersetzt. Ein Sentinel ist kein technischer Fehler und wird
 * nicht protokolliert.
 */
class SyncItemRejection extends Error {
  readonly outcome: "conflict" | "error";
  readonly serverUpdatedAt?: string | null;

  constructor(outcome: "conflict" | "error", message: string, serverUpdatedAt?: string | null) {
    super(message);
    this.name = "SyncItemRejection";
    this.outcome = outcome;
    // Nur bei einem Konflikt gesetzt; sonst bleibt das Feld in der Antwort weg.
    if (serverUpdatedAt !== undefined) this.serverUpdatedAt = serverUpdatedAt;
  }
}

/**
 * Bereits angewendeter Eintrag – modulprivates Sentinel.
 *
 * Es wird AUSSCHLIESSLICH an der Unique-Verletzung des Dedup-Markers geworfen
 * und bedeutet genau „bereits angewendet". Warum nicht mehr pauschal 23505
 * außerhalb der Transaktion: der Status-Update löst die AP13-Trigger aus,
 * sync_incident_tasks_internal schreibt abgeleitete Aufgaben, und auf
 * public.incident_tasks liegt der partielle Unique-Index
 * (incident_id, task_type) where source = 'derived' (Migration 0011). Eine
 * Unique-Verletzung aus diesem Weg wäre als „applied" gemeldet worden, der
 * Client hätte den Outbox-Eintrag gelöscht, obwohl die Aktion NICHT angewendet
 * wurde. Ein Sentinel ist kein technischer Fehler und wird nicht protokolliert.
 */
class SyncItemDuplicate extends Error {
  constructor() {
    super("Dedup-Marker bereits vorhanden");
    this.name = "SyncItemDuplicate";
  }
}

function rejectionResult(id: string, rejection: SyncItemRejection): ItemResult {
  if (rejection.serverUpdatedAt === undefined) {
    return { id, result: rejection.outcome, message: rejection.message };
  }
  return {
    id,
    result: rejection.outcome,
    message: rejection.message,
    serverUpdatedAt: rejection.serverUpdatedAt,
  };
}

type IncidentUpdatedAtRow = { updated_at: string | null };

/**
 * Einen Eintrag anwenden – ausschließlich innerhalb der Transaktion.
 *
 * Reihenfolge verbindlich: (1) Dedup-Marker, (2) fachliche Prüfung, (3) Wirkung.
 * Der Marker steht bewusst VOR der Prüfung: ein bereits angewendeter Eintrag
 * ergibt über die Unique-Verletzung sofort "applied", ohne erneute Validierung.
 * Würde zuerst validiert, bekäme ein wiederholt gesendeter, fachlich
 * unbrauchbarer Eintrag plötzlich "error" statt "applied" – die Idempotenzzusage
 * hängt an dieser Reihenfolge.
 */
async function applyItem(
  client: DatabaseClient,
  it: SyncItem,
  role: string,
): Promise<void> {
  const clientActionId = it.clientActionId || it.id;

  // 1) Dedup-Marker setzen. Die Unique-Verletzung (actor, client_action_id)
  // bricht die Transaktion ab; der Rollback des Wrappers ist genau richtig. Die
  // Auswertung geschieht HIER, unmittelbar an der Anweisung, die den Fehler
  // erzeugen darf – nur so ist 23505 eindeutig dem Marker zugeordnet.
  //
  // Nach einer Unique-Verletzung ist die Transaktion abgebrochen: es folgt in
  // ihr keine weitere Anweisung, das Sentinel wird sofort geworfen und der
  // Wrapper rollt zurück und wirft weiter.
  //
  // `actor` wird NICHT gesetzt: die Spalte trägt den Default
  // app.current_user_id(); die Identität ist keine Angabe des Aufrufers.
  try {
    await client.query(
      `insert into public.sync_actions (client_action_id, kind, incident_id)
       values ($1::uuid, $2, $3::uuid)`,
      [clientActionId, it.kind, it.incidentId],
    );
  } catch (error) {
    if (isPgError(error, PG_UNIQUE_VIOLATION)) throw new SyncItemDuplicate();
    throw error;
  }

  // 2) Fachliche Prüfung. Jede Ablehnung rollt zurück und entfernt damit den
  // eben gesetzten Marker – auch den mit unbekannter Aktionsart.
  const kind = it.kind;
  if (!isSyncKind(kind)) throw new SyncItemRejection("error", "Unbekannter Typ");

  if (kind === "note") {
    if (!it.incidentId || !it.body?.trim()) {
      throw new SyncItemRejection("error", "Notiz unvollständig");
    }
    // 3) Wirkung. note_type ist ein fester Wert im Anweisungstext.
    await client.query(
      `insert into public.incident_notes (incident_id, body, note_type)
       values ($1::uuid, $2, 'allgemein')`,
      [it.incidentId, it.body.trim()],
    );
    return;
  }

  const status = it.status as IncidentStatus;
  if (!it.incidentId || !INCIDENT_STATUS.includes(status)) {
    throw new SyncItemRejection("error", "Ungültiger Status");
  }
  if (role === "monteur" && !MONTEUR_STATUS.includes(status)) {
    throw new SyncItemRejection("error", "Status für Monteur nicht erlaubt");
  }

  // Konfliktbasis lesen. `to_json(updated_at)` liefert ISO-8601-Text in voller
  // Mikrosekundengenauigkeit; der Wert geht als serverUpdatedAt an den Client
  // und wird dort weiterverwendet. Ein als JS-Date zurückgegebener Wert wäre auf
  // Millisekunden gekürzt.
  const current = await client.query<IncidentUpdatedAtRow>(
    `select to_json(updated_at) as updated_at
       from public.incidents
      where id = $1::uuid`,
    [it.incidentId],
  );
  const row = current.rows[0];
  if (!row) {
    throw new SyncItemRejection("error", "Vorgang nicht gefunden oder kein Zugriff");
  }
  if (
    it.baseUpdatedAt && row.updated_at &&
    new Date(row.updated_at).getTime() !== new Date(it.baseUpdatedAt).getTime()
  ) {
    // Konflikt: die Aktion darf nicht als angewendet gelten. Der Rollback nimmt
    // den Marker zurück, das Ergebnis geht über das Sentinel nach außen.
    throw new SyncItemRejection(
      "conflict",
      "Vorgang wurde zwischenzeitlich serverseitig geändert",
      row.updated_at,
    );
  }

  await client.query(
    `update public.incidents
        set status = $1::public.incident_status
      where id = $2::uuid`,
    [status, it.incidentId],
  );
}

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
  const results: ItemResult[] = [];

  for (const it of items) {
    // Der try/catch je Eintrag bleibt: ein einzelner Fehlschlag darf den Stapel
    // nicht abbrechen.
    try {
      await withUserTransaction(session.userId, (client) => applyItem(client, it, session.role));
      results.push({ id: it.id, result: "applied" });
    } catch (error) {
      if (error instanceof SyncItemDuplicate) {
        results.push({ id: it.id, result: "applied", message: "bereits angewendet (dedupliziert)" });
        continue;
      }
      if (error instanceof SyncItemRejection) {
        results.push(rejectionResult(it.id, error));
        continue;
      }
      // Technischer Fehler: die Einordnung bleibt serverseitig, nach außen geht
      // ausschließlich die neutrale Meldung. Hierunter fällt bewusst AUCH eine
      // Unique-Verletzung, die nicht vom Dedup-Marker stammt (etwa aus den
      // AP13-Triggern des Status-Updates): sie darf nicht als "applied" gelten,
      // weil der Client den Outbox-Eintrag sonst löschen und die Aktion
      // verlieren würde.
      console.error(
        "Offline-Aktion konnte nicht angewendet werden",
        error instanceof Error ? error.message : "unbekannter Fehler",
      );
      results.push({ id: it.id, result: "error", message: APPLY_FAILED });
    }
  }

  return NextResponse.json({ ok: true, results });
}
