import "server-only";
import { getSessionProfile } from "@/lib/auth";
import { withUserTransaction } from "@/lib/db";
import { TERMINAL_STATUS, type IncidentStatus } from "@/lib/status";

// AP15-1/W1: Statusbasierte Dashboardkennzahlen als Datenbankaggregat.
//
// Bisher wurden diese Zahlen in JavaScript aus der vollstaendig geladenen
// Vorgangsliste gezaehlt. Die Zaehlung laeuft jetzt in EINER Anweisung innerhalb
// EINER withUserTransaction(): die Transaktion ist der einzige Weg, auf dem
// `app.user_id` transaktionslokal gesetzt wird, und der Anweisungsschutz sieht
// je Aufruf genau eine parametrisierte Anweisung. Fuenf getrennte Zaehlabfragen
// waeren fuenf Anweisungen und koennten - trotz gleicher Transaktion - nur mit
// zusaetzlichem Aufwand als EIN Datenstand begruendet werden; als eine einzige
// Projektion ist der gemeinsame Stand strukturell gegeben.
//
// Grenze dieses gemeinsamen Datenstands: er gilt ausschliesslich innerhalb
// dieser fuenf Kennzahlen. Die aufrufende Seite zeigt sie zusammen mit Werten
// aus einer zweiten Transaktion (listIncidents()); zwischen beiden kann ein
// Schreibvorgang liegen. Im Grenzfall nennt eine Kachel deshalb eine Zahl, die
// um eins von der Zeilenzahl der darunter gerenderten Liste abweicht. Das
// bleibt so: die gerenderten Listen bleiben nach Architekturauftrag auf
// listIncidents(); eine gemeinsame Quelle waere ein sichtbarer Listenumbau
// und damit ausserhalb dieses Schritts.
//
// Warum die Werte fachlich gleich zur bisherigen JS-Auswertung sind:
// public.incident_list_view laeuft mit security_invoker und hat damit dieselbe
// Kardinalitaet wie die per RLS sichtbaren Zeilen von public.incidents - eine
// Zeile je sichtbarem Vorgang, wie bisher ein Element je `rows`-Eintrag. Die
// Spalte `monteur_ids` enthaelt ausschliesslich AKTIVE Zuweisungen und
// entspricht deshalb genau dem bisherigen
// `assignments.filter((a) => a.is_active)`.
//
// Warum die drei Einzelstatus ueber ALLE sichtbaren Zeilen gezaehlt werden und
// nicht nur ueber die offenen: das entspricht zeichengenau dem bisherigen
// `rows.filter((r) => r.status === ...)`. Die Zaehlung bleibt damit auch dann
// richtig, wenn TERMINAL_STATUS spaeter erweitert wird - eine zusaetzliche
// Einschraenkung auf offene Zeilen wuerde die angezeigten Werte in genau diesem
// Fall stillschweigend veraendern.
//
// Warum die offene Statusmenge als Parameter aus TERMINAL_STATUS kommt und nicht
// als SQL-Literal: es darf keine zweite Terminalstatusliste entstehen.
// @/lib/status bleibt die einzige Quelle; ein dortiger Zusatz wirkt hier ohne
// Nachpflege.
//
// Warum `unnest` in einer getrennten Unterabfrage steht: in derselben Projektion
// wuerde es die Zeilenmenge vervielfachen (eine Zeile je Vorgang x Monteur) und
// damit alle vier `count(*) filter (...)` verfaelschen; offene Vorgaenge ohne
// Monteur fielen dabei ganz heraus.
//
// Warum jedes `count()` nach `::int` gecastet wird: der Treiber liefert `bigint`
// als Zeichenkette. Ohne den Cast waeren die Kennzahlen Text und die Kacheln
// wuerden Zeichenketten anzeigen.
//
// Fehlt die Sitzung, wird kein SQL ausgefuehrt und alle Werte sind 0. Das ist
// genau das bisherige sichtbare Verhalten: ohne Identitaet liefert die RLS keine
// Zeile, `rows` war leer und jede Kachel zeigte 0.

export type IncidentStatusMetrics = {
  offen: number;
  technisch_abgeschlossen: number;
  warten_auf_db: number;
  warten_auf_material: number;
  monteure_im_einsatz: number;
};

// Als IncidentStatus typisiert, damit ein Umbenennen des Enum-Codes den Build
// bricht statt still eine Kachel auf 0 zu setzen.
const STATUS_TECHNISCH_ABGESCHLOSSEN: IncidentStatus = "technisch_abgeschlossen";
const STATUS_WARTEN_AUF_DB: IncidentStatus = "warten_auf_db";
const STATUS_WARTEN_AUF_MATERIAL: IncidentStatus = "warten_auf_material";

const EMPTY_METRICS: IncidentStatusMetrics = {
  offen: 0,
  technisch_abgeschlossen: 0,
  warten_auf_db: 0,
  warten_auf_material: 0,
  monteure_im_einsatz: 0,
};

// Feste Zeichenkette; alle vier Werte sind gebundene Parameter. In den
// Anweisungstext wird nichts interpoliert.
const STATUS_METRICS_SQL = `
  select
    count(*) filter (where v.status <> all ($1::public.incident_status[]))::int as offen,
    count(*) filter (where v.status = $2::public.incident_status)::int as technisch_abgeschlossen,
    count(*) filter (where v.status = $3::public.incident_status)::int as warten_auf_db,
    count(*) filter (where v.status = $4::public.incident_status)::int as warten_auf_material,
    (
      select count(distinct m.monteur_id)::int
        from public.incident_list_view o
        cross join lateral unnest(o.monteur_ids) as m(monteur_id)
       where o.status <> all ($1::public.incident_status[])
    ) as monteure_im_einsatz
  from public.incident_list_view v`;

type IncidentStatusMetricsRow = {
  offen: number;
  technisch_abgeschlossen: number;
  warten_auf_db: number;
  warten_auf_material: number;
  monteure_im_einsatz: number;
};

// Sichtbarkeit wird durch RLS erzwungen: Disposition/Admin zaehlen alle,
// Monteur nur zugewiesene Vorgänge.
export async function getIncidentStatusMetrics(): Promise<IncidentStatusMetrics> {
  const session = await getSessionProfile();
  if (!session) return { ...EMPTY_METRICS };
  return withUserTransaction(session.userId, async (client) => {
    const result = await client.query<IncidentStatusMetricsRow>(STATUS_METRICS_SQL, [
      [...TERMINAL_STATUS],
      STATUS_TECHNISCH_ABGESCHLOSSEN,
      STATUS_WARTEN_AUF_DB,
      STATUS_WARTEN_AUF_MATERIAL,
    ]);
    const row = result.rows[0];
    if (!row) return { ...EMPTY_METRICS };
    return {
      offen: row.offen ?? 0,
      technisch_abgeschlossen: row.technisch_abgeschlossen ?? 0,
      warten_auf_db: row.warten_auf_db ?? 0,
      warten_auf_material: row.warten_auf_material ?? 0,
      monteure_im_einsatz: row.monteure_im_einsatz ?? 0,
    };
  });
}
