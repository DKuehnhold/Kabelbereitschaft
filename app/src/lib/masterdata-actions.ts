"use server";

import { revalidatePath } from "next/cache";
import { isUuid, withUserTransaction } from "@/lib/db";
import { isPgError, PG_CHECK_VIOLATION, PG_UNIQUE_VIOLATION } from "@/lib/db/pg-errors";
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

// =====================================================================
// AP9 – Server-Actions der Stammdaten (Schreibpfad).
//
// Schreiben darf ausschließlich Staff (admin, disponent). Das wird hier
// serverseitig über getSessionProfile() geprüft und in der Datenbank zusätzlich
// durch die RLS-Policy is_staff() erzwungen.
//
// AP14/B: jede Aktion läuft über withUserTransaction() mit der Identität aus der
// geprüften Auth.js-Sitzung (ADR-011 / 2.5). Kennungen aus dem Formular werden
// vor dem SQL mit isUuid() geprüft; ist eine erforderliche Kennung unbrauchbar,
// wird kein SQL ausgeführt. In den SQL-Text gelangt kein Eingabewert – alle
// Werte sind Parameter ($1, $2, …).
//
// saveContact und saveTeam laufen in GENAU EINER Transaktion. Beide ersetzen
// abhängige Zeilen (Telefonnummern und Bauabschnitts-Zuordnung bzw.
// Teammitglieder) durch delete + insert; ohne gemeinsame Transaktion bliebe bei
// einem Fehler im späteren Schritt ein Teilstand zurück – etwa ein
// Ansprechpartner ohne seine Telefonnummern.
//
// Eine Datenbankmeldung gelangt nie in ein Aktionsergebnis (verbindliche Regel
// aus @/lib/db/pg-errors): klassifiziert wird ausschließlich über den SQLSTATE,
// die Originalmeldung geht allein ins Serverprotokoll.
// =====================================================================

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

/**
 * Optionale Kennung aus dem Formular: leer bleibt NULL, ein nicht kanonischer
 * Wert ist "invalid". Damit gelangt keine Kennung ins SQL, die dort nur einen
 * Typfehler auslösen würde – der Abbruch erfolgt vor dem Verbindungsaufbau.
 */
function optionalUuid(fd: FormData, key: string): string | null | "invalid" {
  const v = strOrNull(fd, key);
  if (v === null) return null;
  return isUuid(v) ? v : "invalid";
}

async function requireStaff() {
  const s = await getSessionProfile();
  return s && (s.role === "admin" || s.role === "disponent") ? s : null;
}

const STAFF_ONLY = "Nur Administration und Disposition dürfen Stammdaten verwalten.";

/** Neutraler Speicherfehler – nennt bewusst keinen Datenbankinhalt. */
const SAVE_FAILED = "Speichern fehlgeschlagen: unerwarteter Datenbankfehler.";

/** Serverseitige Protokollierung ohne Weitergabe der Datenbankmeldung. */
function logDbFailure(action: string, error: unknown): void {
  console.error(
    `${action} fehlgeschlagen`,
    error instanceof Error ? error.message : "unbekannter Fehler",
  );
}

/**
 * DB-Fehler benutzerfreundlich zusammenfassen (z. B. Unique-Verletzung).
 *
 * Eingeordnet wird über den SQLSTATE und nicht mehr über den Meldungstext: eine
 * Datenbankmeldung darf laut @/lib/db/pg-errors nicht in das Ergebnis einer
 * Server Action gelangen, der bisherige Weg hat sie aber in den Rückgabetext
 * interpoliert. Die beiden eingeordneten Texte bleiben unverändert; der
 * Sammelfall ist deshalb zwangsläufig neutral und die Originalmeldung geht
 * ausschließlich ins Serverprotokoll.
 */
function saveErr(error: unknown): FormState {
  // Protokolliert wird VOR der Einordnung, also auch der eingeordnete Fall.
  // Sonst hinterliesse eine Serie verletzter Eindeutigkeiten - etwa das
  // systematische Sondieren vorhandener VzG-Nummern - keine Serverspur.
  logDbFailure("Stammdaten speichern", error);
  if (isPgError(error, PG_UNIQUE_VIOLATION)) {
    return { ok: false, error: `Speichern fehlgeschlagen: Eintrag ist bereits vorhanden (Eindeutigkeit verletzt).` };
  }
  if (isPgError(error, PG_CHECK_VIOLATION)) {
    return { ok: false, error: `Speichern fehlgeschlagen: Ungültiges Format.` };
  }
  return { ok: false, error: SAVE_FAILED };
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
    "/stammdaten/bereitschaftsnummern",
    "/stammdaten/einstellungen",
    "/stammdaten/gewerke",
    "/stammdaten/funktionen",
    "/stammdaten/objektarten",
  ]) {
    revalidatePath(p);
  }
}

/**
 * Gemeinsamer Ablauf der Aktiv/Inaktiv-Schalter.
 *
 * `sql` ist an jeder Aufrufstelle ein festes Literal; übergeben wird die fertige
 * Anweisung und nicht etwa ein Tabellenname, damit nichts in den SQL-Text
 * hineingebaut wird. Die Signatur bleibt Promise<void>: eine Ausnahme würde eine
 * sichtbare Fehleroberfläche erzeugen, deshalb wird ein Datenbankfehler
 * serverseitig protokolliert und die Aktion kehrt still zurück – ohne
 * revalidateMaster(), weil sich nichts geändert hat.
 */
async function setActive(fd: FormData, sql: string): Promise<void> {
  const session = await requireStaff();
  if (!session) return;
  const id = str(fd, "id");
  if (!isUuid(id)) return;
  const active = str(fd, "active") === "true";
  try {
    await withUserTransaction(session.userId, async (client) => {
      await client.query(sql, [active, id]);
    });
  } catch (error) {
    logDbFailure("Aktivkennzeichen setzen", error);
    return;
  }
  revalidateMaster();
}

// =====================================================================
// Bereitschaftsnummern
// =====================================================================
export async function saveOnCallNumber(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireStaff();
  if (!session) return { ok: false, error: STAFF_ONLY };
  const id = strOrNull(fd, "id");
  const number = str(fd, "number");
  if (!number) return { ok: false, error: "Telefonnummer ist erforderlich." };
  if (id && !isUuid(id)) return { ok: false, error: SAVE_FAILED };
  const payload = {
    number,
    label: strOrNull(fd, "label"),
    is_active: str(fd, "is_active") !== "false",
  };
  try {
    await withUserTransaction(session.userId, async (client) => {
      if (id) {
        await client.query(
          `update public.on_call_numbers
              set number = $1, label = $2, is_active = $3
            where id = $4::uuid`,
          [payload.number, payload.label, payload.is_active, id],
        );
      } else {
        await client.query(
          `insert into public.on_call_numbers (number, label, is_active)
           values ($1, $2, $3)`,
          [payload.number, payload.label, payload.is_active],
        );
      }
    });
  } catch (error) {
    return saveErr(error);
  }
  revalidateMaster();
  return { ok: true, error: null };
}

export async function setOnCallNumberActive(fd: FormData): Promise<void> {
  await setActive(fd, `update public.on_call_numbers set is_active = $1 where id = $2::uuid`);
}

// =====================================================================
// Kunden
// =====================================================================
export async function saveCustomer(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireStaff();
  if (!session) return { ok: false, error: STAFF_ONLY };
  const id = strOrNull(fd, "id");
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "Kundenname ist erforderlich." };
  if (id && !isUuid(id)) return { ok: false, error: SAVE_FAILED };
  const payload = {
    name,
    erp_id: strOrNull(fd, "erp_id"),
    is_active: str(fd, "is_active") !== "false",
  };
  try {
    await withUserTransaction(session.userId, async (client) => {
      if (id) {
        await client.query(
          `update public.customers
              set name = $1, erp_id = $2, is_active = $3
            where id = $4::uuid`,
          [payload.name, payload.erp_id, payload.is_active, id],
        );
      } else {
        await client.query(
          `insert into public.customers (name, erp_id, is_active)
           values ($1, $2, $3)`,
          [payload.name, payload.erp_id, payload.is_active],
        );
      }
    });
  } catch (error) {
    return saveErr(error);
  }
  revalidateMaster();
  return { ok: true, error: null };
}

export async function setCustomerActive(fd: FormData): Promise<void> {
  await setActive(fd, `update public.customers set is_active = $1 where id = $2::uuid`);
}

// =====================================================================
// Bauabschnitte (construction_stages)
// =====================================================================
export async function saveStage(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireStaff();
  if (!session) return { ok: false, error: STAFF_ONLY };
  const id = strOrNull(fd, "id");
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "Bezeichnung ist erforderlich." };
  const onCallNumberId = optionalUuid(fd, "default_on_call_number_id");
  if (id && !isUuid(id)) return { ok: false, error: SAVE_FAILED };
  if (onCallNumberId === "invalid") return { ok: false, error: SAVE_FAILED };
  const payload = {
    code: strOrNull(fd, "code"),
    name,
    description: strOrNull(fd, "description"),
    wus_bst: strOrNull(fd, "wus_bst"),
    default_on_call_number_id: onCallNumberId,
    is_active: str(fd, "is_active") !== "false",
  };
  try {
    await withUserTransaction(session.userId, async (client) => {
      if (id) {
        await client.query(
          `update public.construction_stages
              set code = $1, name = $2, description = $3, wus_bst = $4,
                  default_on_call_number_id = $5::uuid, is_active = $6
            where id = $7::uuid`,
          [
            payload.code,
            payload.name,
            payload.description,
            payload.wus_bst,
            payload.default_on_call_number_id,
            payload.is_active,
            id,
          ],
        );
      } else {
        await client.query(
          `insert into public.construction_stages
             (code, name, description, wus_bst, default_on_call_number_id, is_active)
           values ($1, $2, $3, $4, $5::uuid, $6)`,
          [
            payload.code,
            payload.name,
            payload.description,
            payload.wus_bst,
            payload.default_on_call_number_id,
            payload.is_active,
          ],
        );
      }
    });
  } catch (error) {
    return saveErr(error);
  }
  revalidateMaster();
  return { ok: true, error: null };
}

export async function setStageActive(fd: FormData): Promise<void> {
  await setActive(fd, `update public.construction_stages set is_active = $1 where id = $2::uuid`);
}

// =====================================================================
// VzG-Strecken
// =====================================================================
export async function saveVzgLine(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireStaff();
  if (!session) return { ok: false, error: STAFF_ONLY };
  const id = strOrNull(fd, "id");
  const line_number = str(fd, "line_number");
  const construction_stage_id = strOrNull(fd, "construction_stage_id");
  if (!/^[0-9]{4}$/.test(line_number))
    return { ok: false, error: "Die VzG-Streckennummer muss aus genau vier Ziffern bestehen." };
  if (!construction_stage_id) return { ok: false, error: "Bauabschnitt ist erforderlich." };
  if (id && !isUuid(id)) return { ok: false, error: SAVE_FAILED };
  // Erforderliche Kennung: unbrauchbar heißt fail-closed, kein SQL.
  if (!isUuid(construction_stage_id)) return { ok: false, error: SAVE_FAILED };
  const payload = {
    line_number,
    description: strOrNull(fd, "description"),
    construction_stage_id,
    is_active: str(fd, "is_active") !== "false",
  };
  try {
    await withUserTransaction(session.userId, async (client) => {
      if (id) {
        await client.query(
          `update public.vzg_lines
              set line_number = $1, description = $2, construction_stage_id = $3::uuid,
                  is_active = $4
            where id = $5::uuid`,
          [
            payload.line_number,
            payload.description,
            payload.construction_stage_id,
            payload.is_active,
            id,
          ],
        );
      } else {
        await client.query(
          `insert into public.vzg_lines (line_number, description, construction_stage_id, is_active)
           values ($1, $2, $3::uuid, $4)`,
          [
            payload.line_number,
            payload.description,
            payload.construction_stage_id,
            payload.is_active,
          ],
        );
      }
    });
  } catch (error) {
    if (isPgError(error, PG_UNIQUE_VIOLATION))
      return { ok: false, error: "Diese VzG-Streckennummer ist für diesen Bauabschnitt bereits vergeben." };
    return saveErr(error);
  }
  revalidateMaster();
  return { ok: true, error: null };
}

export async function setVzgLineActive(fd: FormData): Promise<void> {
  await setActive(fd, `update public.vzg_lines set is_active = $1 where id = $2::uuid`);
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
  const session = await requireStaff();
  if (!session) return { ok: false, error: STAFF_ONLY };
  const id = strOrNull(fd, "id");
  const customer_id = strOrNull(fd, "customer_id");
  const name = str(fd, "name");
  if (!customer_id) return { ok: false, error: "Kunde ist erforderlich." };
  if (!name) return { ok: false, error: "Name ist erforderlich." };
  if (id && !isUuid(id)) return { ok: false, error: SAVE_FAILED };
  if (!isUuid(customer_id)) return { ok: false, error: SAVE_FAILED };
  // AUFTRAG_6: optionale Verknuepfung auf den Funktionen-Katalog
  // (public.contact_functions). Erforderliche Kennung fail-closed: ein nicht
  // kanonischer Wert gelangt nicht ins SQL.
  const functionId = optionalUuid(fd, "function_id");
  if (functionId === "invalid") return { ok: false, error: SAVE_FAILED };

  const payload = {
    customer_id,
    name,
    function: strOrNull(fd, "function"),
    function_id: functionId,
    email: strOrNull(fd, "email"),
    is_active: str(fd, "is_active") !== "false",
  };

  const phones = parsePhones(fd);
  // Nicht kanonische Kennungen können keinen Bauabschnitt treffen; sie werden
  // vor dem SQL verworfen statt dort einen Typfehler auszulösen. Dedupliziert
  // wird wie bei den Teammitgliedern: csc_stage_contact_uq (0007) würde einen
  // doppelt übermittelten Bauabschnitt mit 23505 abweisen und damit die ganze
  // Transaktion zurückrollen, obwohl die Eingabe fachlich eindeutig ist.
  const stageIds = Array.from(new Set(fd.getAll("stage_ids").map(String).filter(isUuid)));

  try {
    // GENAU EINE Transaktion über alle Schritte: Kontakt, Telefonnummern und
    // Bauabschnitts-Zuordnung. Beide abhängigen Mengen werden vollständig
    // ersetzt (staff-verwaltete Stammdaten); ein Fehler im späteren Schritt
    // rollt auch den Kontakt zurück und hinterlässt keinen Teilstand.
    await withUserTransaction(session.userId, async (client) => {
      let contactId: string;
      if (id) {
        await client.query(
          `update public.contacts
              set customer_id = $1::uuid, name = $2, "function" = $3, function_id = $4::uuid,
                  email = $5, is_active = $6
            where id = $7::uuid`,
          [
            payload.customer_id,
            payload.name,
            payload.function,
            payload.function_id,
            payload.email,
            payload.is_active,
            id,
          ],
        );
        contactId = id;
      } else {
        const inserted = await client.query<{ id: string }>(
          `insert into public.contacts (customer_id, name, "function", function_id, email, is_active)
           values ($1::uuid, $2, $3, $4::uuid, $5, $6)
           returning id`,
          [
            payload.customer_id,
            payload.name,
            payload.function,
            payload.function_id,
            payload.email,
            payload.is_active,
          ],
        );
        const newId = inserted.rows[0]?.id;
        // Kann nur bei einem Fehlschlag von "returning" eintreten; der Wurf
        // rollt die Transaktion zurück und wird oben zur neutralen Meldung.
        if (!newId) throw new Error("Kontakt-ID konnte nicht ermittelt werden.");
        contactId = newId;
      }

      await client.query(
        `delete from public.contact_phone_numbers where contact_id = $1::uuid`,
        [contactId],
      );
      if (phones.length > 0) {
        // Eine Anweisung für alle Nummern: unnest() bindet die drei Spalten als
        // parallele Arrays. sort_order ist bewusst die Position in der
        // gefilterten Liste (0..n-1) und nicht der Rohindex aus parsePhones.
        await client.query(
          `insert into public.contact_phone_numbers (contact_id, phone, phone_type, sort_order)
           select $1::uuid, p.phone, p.phone_type::public.phone_type, p.sort_order
             from unnest($2::text[], $3::text[], $4::int[]) as p(phone, phone_type, sort_order)`,
          [
            contactId,
            phones.map((p) => p.phone),
            phones.map((p) => p.phone_type),
            phones.map((_, i) => i),
          ],
        );
      }

      await client.query(
        `delete from public.construction_stage_contacts where contact_id = $1::uuid`,
        [contactId],
      );
      if (stageIds.length > 0) {
        await client.query(
          `insert into public.construction_stage_contacts (contact_id, construction_stage_id)
           select $1::uuid, s.construction_stage_id
             from unnest($2::uuid[]) as s(construction_stage_id)`,
          [contactId, stageIds],
        );
      }
    });
  } catch (error) {
    return saveErr(error);
  }

  revalidateMaster();
  return { ok: true, error: null };
}

export async function setContactActive(fd: FormData): Promise<void> {
  await setActive(fd, `update public.contacts set is_active = $1 where id = $2::uuid`);
}

// =====================================================================
// Monteure
// =====================================================================
export async function saveTechnician(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireStaff();
  if (!session) return { ok: false, error: STAFF_ONLY };
  const id = strOrNull(fd, "id");
  const first_name = str(fd, "first_name");
  const last_name = str(fd, "last_name");
  if (!first_name) return { ok: false, error: "Vorname ist erforderlich." };
  if (!last_name) return { ok: false, error: "Nachname ist erforderlich." };
  const profileId = optionalUuid(fd, "profile_id");
  if (id && !isUuid(id)) return { ok: false, error: SAVE_FAILED };
  if (profileId === "invalid") return { ok: false, error: SAVE_FAILED };
  const payload = {
    first_name,
    last_name,
    profile_id: profileId,
    is_active: str(fd, "is_active") !== "false",
  };
  try {
    await withUserTransaction(session.userId, async (client) => {
      if (id) {
        await client.query(
          `update public.technicians
              set first_name = $1, last_name = $2, profile_id = $3::uuid, is_active = $4
            where id = $5::uuid`,
          [payload.first_name, payload.last_name, payload.profile_id, payload.is_active, id],
        );
      } else {
        await client.query(
          `insert into public.technicians (first_name, last_name, profile_id, is_active)
           values ($1, $2, $3::uuid, $4)`,
          [payload.first_name, payload.last_name, payload.profile_id, payload.is_active],
        );
      }
    });
  } catch (error) {
    if (isPgError(error, PG_UNIQUE_VIOLATION))
      return { ok: false, error: "Diese Profil-ID ist bereits einem Monteur zugeordnet." };
    return saveErr(error);
  }
  revalidateMaster();
  return { ok: true, error: null };
}

export async function setTechnicianActive(fd: FormData): Promise<void> {
  await setActive(fd, `update public.technicians set is_active = $1 where id = $2::uuid`);
}

// ---- Monteur-CSV-Import (Vorschau + Commit) -------------------------
type TechnicianKeyRow = { first_name: string; last_name: string; profile_id: string | null };

// Lesepfad des Imports: wie die übrigen Reads ohne eigenes catch – ein
// fehlendes Tabellenrecht muss laut scheitern und darf nicht als "keine
// Dubletten" durchgehen, weil sonst bestehende Monteure doppelt angelegt würden.
async function existingTechnicianSets(userId: string) {
  const rows = await withUserTransaction(userId, async (client) => {
    const result = await client.query<TechnicianKeyRow>(
      `select first_name, last_name, profile_id from public.technicians`,
    );
    return result.rows;
  });
  const names = new Set<string>();
  const profiles = new Set<string>();
  for (const t of rows) {
    names.add(technicianKey(t.first_name, t.last_name));
    if (t.profile_id) profiles.add(t.profile_id.toLowerCase());
  }
  return { names, profiles };
}

export async function previewTechnicianImport(text: string): Promise<ImportPreview> {
  const session = await requireStaff();
  if (!session) {
    return {
      ok: false,
      fatal: STAFF_ONLY,
      delimiter: ";",
      rows: [],
      summary: { total: 0, neu: 0, dublette_datei: 0, dublette_db: 0, fehler: 0 },
    };
  }
  const parsed = parseTechnicianCsv(text);
  const { names, profiles } = await existingTechnicianSets(session.userId);
  return classifyImport(parsed, names, profiles);
}

export async function commitTechnicianImport(text: string): Promise<ImportCommitResult> {
  const session = await requireStaff();
  if (!session) return { ok: false, inserted: 0, skipped: 0, failed: 0, message: STAFF_ONLY };
  const parsed = parseTechnicianCsv(text);
  if (parsed.fatal) return { ok: false, inserted: 0, skipped: 0, failed: 0, message: parsed.fatal };
  const { names, profiles } = await existingTechnicianSets(session.userId);
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

  try {
    // Alle neuen Monteure in EINER Transaktion und EINER Anweisung: der Import
    // ist damit vollständig oder gar nicht wirksam (failed = alle oder keine).
    await withUserTransaction(session.userId, async (client) => {
      await client.query(
        `insert into public.technicians (first_name, last_name, is_active, profile_id)
         select t.first_name, t.last_name, t.is_active, t.profile_id
           from unnest($1::text[], $2::text[], $3::boolean[], $4::uuid[])
                as t(first_name, last_name, is_active, profile_id)`,
        [
          toInsert.map((t) => t.first_name),
          toInsert.map((t) => t.last_name),
          toInsert.map((t) => t.is_active),
          toInsert.map((t) => t.profile_id),
        ],
      );
    });
  } catch (error) {
    logDbFailure("Monteur-Import", error);
    return {
      ok: false,
      inserted: 0,
      skipped,
      failed: toInsert.length,
      message: "Import fehlgeschlagen: unerwarteter Datenbankfehler.",
    };
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
  const session = await requireStaff();
  if (!session) return { ok: false, error: STAFF_ONLY };
  const id = strOrNull(fd, "id");
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "Teamname ist erforderlich." };
  if (id && !isUuid(id)) return { ok: false, error: SAVE_FAILED };
  const payload = { name, is_active: str(fd, "is_active") !== "false" };

  const memberIds = Array.from(new Set(fd.getAll("member_ids").map(String).filter(isUuid)));

  try {
    // GENAU EINE Transaktion: Team, Löschen der Mitgliedschaften und Einfügen
    // der neuen Menge. Ein Fehler beim Einfügen darf kein Team ohne Mitglieder
    // hinterlassen.
    await withUserTransaction(session.userId, async (client) => {
      let teamId: string;
      if (id) {
        await client.query(
          `update public.teams set name = $1, is_active = $2 where id = $3::uuid`,
          [payload.name, payload.is_active, id],
        );
        teamId = id;
      } else {
        const inserted = await client.query<{ id: string }>(
          `insert into public.teams (name, is_active) values ($1, $2) returning id`,
          [payload.name, payload.is_active],
        );
        const newId = inserted.rows[0]?.id;
        if (!newId) throw new Error("Team-ID konnte nicht ermittelt werden.");
        teamId = newId;
      }

      await client.query(`delete from public.team_members where team_id = $1::uuid`, [teamId]);
      if (memberIds.length > 0) {
        await client.query(
          `insert into public.team_members (team_id, technician_id)
           select $1::uuid, m.technician_id
             from unnest($2::uuid[]) as m(technician_id)`,
          [teamId, memberIds],
        );
      }
    });
  } catch (error) {
    return saveErr(error);
  }

  revalidateMaster();
  return { ok: true, error: null };
}

export async function setTeamActive(fd: FormData): Promise<void> {
  await setActive(fd, `update public.teams set is_active = $1 where id = $2::uuid`);
}

// =====================================================================
// Kabelarten
// =====================================================================
export async function saveCableType(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireStaff();
  if (!session) return { ok: false, error: STAFF_ONLY };
  const id = strOrNull(fd, "id");
  const code = str(fd, "code");
  const name = str(fd, "name");
  if (!code) return { ok: false, error: "Code ist erforderlich." };
  if (!name) return { ok: false, error: "Bezeichnung ist erforderlich." };
  if (id && !isUuid(id)) return { ok: false, error: SAVE_FAILED };
  const payload = {
    code,
    name,
    sort_order: intOrZero(fd, "sort_order"),
    is_active: str(fd, "is_active") !== "false",
  };
  try {
    await withUserTransaction(session.userId, async (client) => {
      if (id) {
        await client.query(
          `update public.cable_types
              set code = $1, name = $2, sort_order = $3, is_active = $4
            where id = $5::uuid`,
          [payload.code, payload.name, payload.sort_order, payload.is_active, id],
        );
      } else {
        await client.query(
          `insert into public.cable_types (code, name, sort_order, is_active)
           values ($1, $2, $3, $4)`,
          [payload.code, payload.name, payload.sort_order, payload.is_active],
        );
      }
    });
  } catch (error) {
    if (isPgError(error, PG_UNIQUE_VIOLATION))
      return { ok: false, error: "Dieser Kabelart-Code ist bereits vergeben." };
    return saveErr(error);
  }
  revalidateMaster();
  return { ok: true, error: null };
}

export async function setCableTypeActive(fd: FormData): Promise<void> {
  await setActive(fd, `update public.cable_types set is_active = $1 where id = $2::uuid`);
}

// =====================================================================
// AUFTRAG_6 – Gewerke (public.trades)
// =====================================================================
export async function saveTrade(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireStaff();
  if (!session) return { ok: false, error: STAFF_ONLY };
  const id = strOrNull(fd, "id");
  const label = str(fd, "label");
  if (!label) return { ok: false, error: "Bezeichnung ist erforderlich." };
  if (id && !isUuid(id)) return { ok: false, error: SAVE_FAILED };
  const payload = { label, is_active: str(fd, "is_active") !== "false" };
  try {
    await withUserTransaction(session.userId, async (client) => {
      if (id) {
        await client.query(
          `update public.trades set label = $1, is_active = $2 where id = $3::uuid`,
          [payload.label, payload.is_active, id],
        );
      } else {
        await client.query(
          `insert into public.trades (label, is_active) values ($1, $2)`,
          [payload.label, payload.is_active],
        );
      }
    });
  } catch (error) {
    if (isPgError(error, PG_UNIQUE_VIOLATION))
      return { ok: false, error: "Dieses Gewerk ist bereits vergeben." };
    return saveErr(error);
  }
  revalidateMaster();
  return { ok: true, error: null };
}

export async function setTradeActive(fd: FormData): Promise<void> {
  await setActive(fd, `update public.trades set is_active = $1 where id = $2::uuid`);
}

// =====================================================================
// AUFTRAG_6 – Funktionen des Anrufenden/Ansprechpartners
// (public.contact_functions)
// =====================================================================
export async function saveContactFunction(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireStaff();
  if (!session) return { ok: false, error: STAFF_ONLY };
  const id = strOrNull(fd, "id");
  const label = str(fd, "label");
  if (!label) return { ok: false, error: "Bezeichnung ist erforderlich." };
  if (id && !isUuid(id)) return { ok: false, error: SAVE_FAILED };
  const payload = { label, is_active: str(fd, "is_active") !== "false" };
  try {
    await withUserTransaction(session.userId, async (client) => {
      if (id) {
        await client.query(
          `update public.contact_functions set label = $1, is_active = $2 where id = $3::uuid`,
          [payload.label, payload.is_active, id],
        );
      } else {
        await client.query(
          `insert into public.contact_functions (label, is_active) values ($1, $2)`,
          [payload.label, payload.is_active],
        );
      }
    });
  } catch (error) {
    if (isPgError(error, PG_UNIQUE_VIOLATION))
      return { ok: false, error: "Diese Funktion ist bereits vergeben." };
    return saveErr(error);
  }
  revalidateMaster();
  return { ok: true, error: null };
}

export async function setContactFunctionActive(fd: FormData): Promise<void> {
  await setActive(fd, `update public.contact_functions set is_active = $1 where id = $2::uuid`);
}

// =====================================================================
// AUFTRAG_6 – Objektarten (Anlagen, inkl. LST-Elemente) (public.object_types)
// =====================================================================
export async function saveObjectType(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireStaff();
  if (!session) return { ok: false, error: STAFF_ONLY };
  const id = strOrNull(fd, "id");
  const label = str(fd, "label");
  if (!label) return { ok: false, error: "Bezeichnung ist erforderlich." };
  if (id && !isUuid(id)) return { ok: false, error: SAVE_FAILED };
  const payload = { label, is_active: str(fd, "is_active") !== "false" };
  try {
    await withUserTransaction(session.userId, async (client) => {
      if (id) {
        await client.query(
          `update public.object_types set label = $1, is_active = $2 where id = $3::uuid`,
          [payload.label, payload.is_active, id],
        );
      } else {
        await client.query(
          `insert into public.object_types (label, is_active) values ($1, $2)`,
          [payload.label, payload.is_active],
        );
      }
    });
  } catch (error) {
    if (isPgError(error, PG_UNIQUE_VIOLATION))
      return { ok: false, error: "Diese Objektart ist bereits vergeben." };
    return saveErr(error);
  }
  revalidateMaster();
  return { ok: true, error: null };
}

export async function setObjectTypeActive(fd: FormData): Promise<void> {
  await setActive(fd, `update public.object_types set is_active = $1 where id = $2::uuid`);
}

// =====================================================================
// App-Einstellungen (Singleton id = 1)
// =====================================================================
export async function saveSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireStaff();
  if (!session) return { ok: false, error: STAFF_ONLY };
  // Beide Vorgaben dürfen NULL sein; ein gesetzter, aber unbrauchbarer Wert
  // wird vor dem SQL abgelehnt.
  const defaultCustomerId = optionalUuid(fd, "default_customer_id");
  const defaultOnCallNumberId = optionalUuid(fd, "default_on_call_number_id");
  if (defaultCustomerId === "invalid") return { ok: false, error: SAVE_FAILED };
  if (defaultOnCallNumberId === "invalid") return { ok: false, error: SAVE_FAILED };
  try {
    await withUserTransaction(session.userId, async (client) => {
      // Singletonzeile existiert aus der Migration; der Upsert sichert
      // Robustheit ab. id = 1 ist die Singletonbedingung und kein Eingabewert.
      await client.query(
        `insert into public.app_settings (id, default_customer_id, default_on_call_number_id)
         values (1, $1::uuid, $2::uuid)
         on conflict (id) do update
            set default_customer_id = excluded.default_customer_id,
                default_on_call_number_id = excluded.default_on_call_number_id`,
        [defaultCustomerId, defaultOnCallNumberId],
      );
    });
  } catch (error) {
    return saveErr(error);
  }
  revalidateMaster();
  return { ok: true, error: null };
}
