"use client";

import { useState, useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/shadcn/button";
import {
  assignOnCall, assignDispo, removeOnCall, moveOnCallEntry, assignOnCallRange,
  type OnCallPlanActionResult, type OnCallPlanRangeResult, type OnCallRangeTarget,
} from "@/lib/on-call-plan-actions";
import { MAX_RANGE_DAYS } from "@/lib/on-call-plan-limits";
import {
  addDaysToIsoDate, addMonthsToIsoDate, mondayOfWeekBerlinIso, startOfMonthBerlinIso,
} from "@/lib/date-local";
import type {
  OnCallWeek, OnCallMonth, OnCallPlanEntry, OnCallStageOption,
} from "@/lib/on-call-plan";
import type { TechnicianWithColor } from "@/lib/masterdata";
import { qualificationColorVars } from "@/lib/qualifications";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/shadcn/dialog";

// =====================================================================
// AUFTRAG_14 – Dispo-Board: Wochen-/Monatsumschalter, rechte Monteurliste
// (farbig nach höchster Qualifikation), Drag & Drop (HTML5-Drag-API, KEINE
// neue Abhängigkeit) MIT Klick-Rückfallebene (Pflicht laut Auftrag), und die
// eigene Zeile "Dispo/Bereitschaftstelefon" oberhalb der Bauabschnittszeilen.
//
// BEDIENABLAUF (siehe MELDUNG_14.md für die ausführliche Fassung):
//   DRAG & DROP (Desktop): einen Monteur-Chip aus der rechten Liste auf eine
//   Zelle ziehen (neue Zuweisung) ODER einen bestehenden Zuweisungs-Chip auf
//   eine ANDERE Zelle ziehen (Verschieben, eine Transaktion über
//   moveOnCallEntry()) ODER auf den "Entfernen"-Bereich/zurück in die Liste
//   ziehen (Löschen).
//   KLICK-EBENE (Touch/Barrierefreiheit, Pflicht): einen Monteur-Chip
//   ANTIPPEN wählt ihn aus (visuell hervorgehoben); eine Zelle ANTIPPEN
//   weist den ausgewählten Monteur dieser Zelle zu und hebt die Auswahl
//   wieder auf. Eine bestehende Zuweisung hat zusätzlich ein "×" zum
//   direkten Entfernen - unabhängig von einer laufenden Auswahl.
//
// MEHRERE TAGE AUF EINMAL (Punkt 4 des ursprünglichen AUFTRAG_14, "nur wenn
// ohne Umbau möglich"): dort bewusst weggelassen (eine Mehrfachauswahl von
// Zellen wäre ein struktureller Umbau gewesen). AUFTRAG_18 (Entscheidung
// Dennis 2026-08-18) schließt diese Lücke stattdessen über einen
// "von-bis"-Dialog: JEDE Neuzuweisung (Drop, Klick Woche, Klickpfad Monat)
// öffnet vor dem Schreiben den Dialog aus AssignRangeDialog() unten - "Von"
// ist die angeklickte Zelle (fest), "Bis" ein <input type="date">
// (vorbelegt mit "Von"). "Nur diesen Tag" (vorbelegt, per Enter) entspricht
// weiterhin genau dem bisherigen Tag-für-Tag-Verhalten; "Zeitraum
// eintragen" ruft die neue Server-Action assignOnCallRange() (siehe
// on-call-plan-actions.ts) EINMAL für den ganzen Zeitraum auf. Verschieben
// (bestehender Chip auf eine andere Zelle gezogen) bleibt bewusst
// einzeltägig OHNE Dialog - Punkt 6 des Auftrags.
//
// DnD NUR IN DER WOCHENMATRIX: sie hat natürliche Bauabschnitt×Tag-Zellen
// als Drop-Ziele. Die Monatsansicht zeigt kompakte Tageszellen ohne
// Bauabschnittsspalten (Punkt 11: "Kalendermatrix des Monats") - ein
// Drop dort hätte kein eindeutiges Ziel (welcher Bauabschnitt?). Sie bietet
// deshalb ausschließlich die Klick-Ebene (Monteur wählen, Tag antippen,
// Bauabschnitt/Dispo im Anschluss auswählen) sowie das Entfernen per "×".
// =====================================================================

const touchStyle = { minHeight: "44px" } as const;
const DISPO_ROW_LABEL = "Dispo / Bereitschaftstelefon";
const DND_MIME = "application/x-oncall-drag";

// AUFTRAG_17 Punkt 1 (Entscheidung Dennis 2026-08-18, wörtlich: "standart ist
// zwei monteure pro angelegtem Bauabschnitt"): Sollwert je Bauabschnitt und
// Tag - AUSSCHLIESSLICH eine Anzeige ("1/2", "2/2", "3/2"), KEINE harte
// Grenze. Weder eine dritte Zuweisung noch eine Unterbesetzung wird
// verhindert. Die Dispo-Zeile hat laut Auftrag ausdruecklich KEINEN Sollwert.
const SOLL_BESETZUNG_BEREITSCHAFT = 2;

// AUFTRAG_17 Punkt 2: Anzeigeklassen ausschliesslich ueber die bestehenden
// AP8-Badge-Utilities (globals.css: .badge, .badge-success/-warning/-info) -
// keine neuen Farbwerte, kein Hex, keine harten Tailwind-Farbklassen. Eine
// Unterbesetzung (< Soll) ist "warning" (Aufmerksamkeit noetig), eine
// Ueberbesetzung (> Soll) ist bewusst "info" statt "warning"/"danger" - sie
// ist kein Fehler, nur ein von der Norm abweichender, aber zulaessiger Stand.
function occupancyBadgeClass(count: number): string {
  if (count === SOLL_BESETZUNG_BEREITSCHAFT) return "badge badge-success";
  if (count < SOLL_BESETZUNG_BEREITSCHAFT) return "badge badge-warning";
  return "badge badge-info";
}

function formatIsoDateDe(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

type DragPayload =
  | { kind: "new"; technicianId: string }
  | { kind: "move"; entryId: string; technicianId: string };

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function formatDayLabel(iso: string, index: number): string {
  const [, month, day] = iso.split("-");
  return `${WEEKDAY_LABELS[index]} ${day}.${month}.`;
}
function formatDayShort(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}.${month}.`;
}

function cellKey(rowId: string, date: string): string {
  return `${rowId}|${date}`;
}

type TargetCell =
  | { kind: "dispo"; dateIso: string }
  | { kind: "bereitschaft"; stageId: string; dateIso: string };

function TechnicianChip({
  technician, selected, canEdit, assignedDaysCount, onSelect,
}: {
  technician: TechnicianWithColor;
  selected: boolean;
  canEdit: boolean;
  /** AUFTRAG_17 Punkt 4: Anzahl Tage, an denen dieser Monteur im aktuell
   * sichtbaren Zeitraum (Woche bzw. Monat) bereits eingeplant ist. 0 = keine
   * Markierung. Die Liste selbst bleibt VOLLSTAENDIG - dies ist NUR eine
   * zusaetzliche, sachliche Kennzeichnung neben dem Namen, kein Filter. */
  assignedDaysCount: number;
  onSelect: () => void;
}) {
  const vars = qualificationColorVars(technician.color);
  return (
    <div
      role="button"
      tabIndex={0}
      draggable={canEdit}
      onDragStart={(e) => {
        const payload: DragPayload = { kind: "new", technicianId: technician.id };
        e.dataTransfer.setData(DND_MIME, JSON.stringify(payload));
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); }
      }}
      className="cursor-pointer select-none rounded-md border px-2 py-1 text-sm"
      style={{
        backgroundColor: vars.bg,
        color: vars.fg,
        borderColor: selected ? "var(--ring)" : "transparent",
        borderWidth: selected ? 2 : 1,
        minHeight: "44px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.5rem",
      }}
      aria-pressed={selected}
      aria-label={`${technician.first_name} ${technician.last_name}${selected ? " (ausgewählt)" : ""}${
        assignedDaysCount > 0 ? ` (an ${assignedDaysCount} Tag(en) im sichtbaren Zeitraum eingeplant)` : ""
      }`}
    >
      <span>{technician.first_name} {technician.last_name}</span>
      {assignedDaysCount > 0 ? (
        <span className="badge badge-info" aria-hidden="true">{assignedDaysCount}&nbsp;Tag{assignedDaysCount === 1 ? "" : "e"}</span>
      ) : null}
    </div>
  );
}

function AssignedChip({
  entry, canEdit, busy, onRemove, onDragStartEntry,
}: {
  entry: OnCallPlanEntry;
  canEdit: boolean;
  busy: boolean;
  onRemove: (id: string) => void;
  onDragStartEntry: (e: DragEvent, entry: OnCallPlanEntry) => void;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-sm"
      draggable={canEdit}
      onDragStart={(e) => onDragStartEntry(e, entry)}
    >
      {entry.technician_name}
      {canEdit ? (
        <button
          type="button"
          aria-label={`${entry.technician_name} entfernen`}
          // AUFTRAG_23 Punkt 6 (M6): touchStyle (minHeight: 44px) entfaellt hier
          // bewusst - es trieb jede Zuweisung in der dichten Wochenmatrix auf
          // mindestens 44px Zeilenhoehe, weil das "x" als Inline-Kind des Chips
          // dessen Layout-Beitrag mitbestimmte. Ersatz: Innenabstand plus exakt
          // gegenlaeufiger negativer Rand (px-2/-mx-2, py-4/-my-4) - die
          // Trefferflaeche (Button-Boxgroesse inkl. padding) bleibt vertikal bei
          // mindestens 44px (14px Text + 2*16px Padding = 46px), der negative
          // Rand nimmt dem Button aber exakt diesen Platzbedarf wieder aus dem
          // Fliesslayout, sodass die Chip-/Zeilenhoehe NICHT mehr davon
          // bestimmt wird (siehe MELDUNG_23.md fuer die Abwaegung/den Kompromiss
          // dieser Loesung).
          className="leading-none text-muted hover:text-destructive px-2 py-4 -mx-2 -my-4"
          disabled={busy}
          onClick={(ev) => {
            // AUFTRAG_17 Punkt 1 (Bugfix): ohne stopPropagation blubbert der
            // Klick auf das umschliessende <td onClick={onCellClick}> (Zeile
            // ~437) hoch. Ist gerade ein Monteur ausgewaehlt, entfernte das
            // "×" die Zuweisung UND legte im selben Klick eine neue an. Die
            // Monatsansicht macht es bereits richtig (siehe MonthGrid unten).
            ev.stopPropagation();
            onRemove(entry.id);
          }}
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

// =====================================================================
// AUFTRAG_17 Punkt 3 – Doppelbelegungspruefung.
//
// Prueft NUR gegen die BEREITS GELADENEN Plandaten (week.entries bzw.
// month.entries, ueber den React-Server-Component-Props hereingereicht -
// keine zusaetzliche Serverabfrage). GRENZE (ausdruecklich, siehe Auftrag
// Punkt 3 und MELDUNG_17.md): das ist eine Hilfe, KEINE Garantie. Steht die
// Person an einem Tag ausserhalb der aktuell sichtbaren Woche/des Monats
// bereits eingeplant, sieht diese Pruefung es nicht. Legt ein zweiter
// Bearbeiter gleichzeitig (in einer anderen Browser-Sitzung) etwas an, sieht
// diese Pruefung die neue Fremdzuweisung ebenfalls nicht (kein Locking, kein
// Realtime-Abgleich) - der serverseitige Datenbank-Unique-Index verhindert
// weiterhin nur die exakte Dublette je Bauabschnitt (0022_hlk_dispo_board.sql).
// =====================================================================

function isSameTarget(entry: OnCallPlanEntry, target: TargetCell): boolean {
  return target.kind === "dispo"
    ? entry.assignment_kind === "dispo"
    : entry.assignment_kind === "bereitschaft" && entry.construction_stage_id === target.stageId;
}

/** Liefert die erste andere Zuweisung desselben Monteurs am selben Kalendertag
 * (anderer Bauabschnitt ODER Dispo-Zeile), sofern vorhanden - sonst null. Bei
 * einem Verschieben wird der verschobene Eintrag selbst (excludeEntryId)
 * ausgenommen, damit er sich nicht selbst als Konflikt meldet. */
function findConflictingEntry(
  entries: OnCallPlanEntry[],
  technicianId: string,
  dateIso: string,
  target: TargetCell,
  excludeEntryId?: string,
): OnCallPlanEntry | null {
  return (
    entries.find(
      (e) =>
        e.technician_id === technicianId &&
        e.plan_date === dateIso &&
        e.id !== excludeEntryId &&
        !isSameTarget(e, target),
    ) ?? null
  );
}

function describeLocation(entry: OnCallPlanEntry, stages: OnCallStageOption[]): string {
  if (entry.assignment_kind === "dispo") return "Dispo";
  const stage = stages.find((s) => s.id === entry.construction_stage_id);
  if (!stage) return "einem anderen Bauabschnitt";
  return stage.code ? `${stage.code} – ${stage.name}` : stage.name;
}

export function OnCallPlanClient({
  view, week, month, technicians, canEdit,
}: {
  view: "woche" | "monat";
  week: OnCallWeek | null;
  month: OnCallMonth | null;
  technicians: TechnicianWithColor[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  // AUFTRAG_23 Punkt 1 (M1/M2): eine Rueckmeldung mit ART (Erfolg/Fehler)
  // statt nur eines Textes - vorher teilten sich Erfolg (Zeitraum-Anlage)
  // und Fehler dieselbe rot eingefaerbte Flaeche. `message` ist IMMER ein
  // Text (nie null), `kind` steuert ausschliesslich die AP8-Badge-Klasse
  // beim Rendern (siehe unten) - keine neue Farbe, kein Hex.
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState<string | null>(null);
  // Nur fuer die Monatsansicht: nach Tagesklick fehlt noch die Art
  // (Bauabschnitt oder Dispo) - eine kompakte Nachfrage je Tag.
  const [monthPromptDate, setMonthPromptDate] = useState<string | null>(null);
  const [monthPromptStage, setMonthPromptStage] = useState<string>("__dispo__");
  // AUFTRAG_23 Punkt 3 (M3): welche der beiden Ablegeflaechen der
  // Monteurliste ("list" = die Chip-Liste selbst, "trash" = der gestrichelte
  // Entfernen-Bereich) gerade waehrend eines Drag-Vorgangs ueberflogen wird -
  // ausschliesslich fuer die visuelle Hervorhebung, keine neue Ablageflaeche.
  const [dragOverZone, setDragOverZone] = useState<"list" | "trash" | null>(null);

  // AUFTRAG_18 Punkt 1: waehrend dieser State nicht null ist, steht der
  // "von-bis"-Dialog offen - VOR jedem Schreibvorgang, kein Zwischenzustand
  // mit bereits gespeichertem Tag und noch offenem Dialog. Ausschliesslich
  // im NEUZUWEISUNGSPFAD gesetzt (openAssignDialog unten), NIE im
  // Verschiebepfad (Punkt 6).
  const [pendingAssign, setPendingAssign] = useState<{ target: TargetCell; technicianId: string } | null>(null);
  // "Bis" - vorbelegt mit dem Von-Datum (Punkt 2), danach frei aenderbar.
  const [rangeToIso, setRangeToIso] = useState("");
  // Sachliche Meldung INNERHALB des Dialogs (Punkt 3/4: Bis vor Von bzw.
  // Obergrenze ueberschritten) - kein window.alert, bleibt bis zur naechsten
  // Eingabe sichtbar, Dialog bleibt offen, es wird nichts geschrieben.
  const [rangeDialogError, setRangeDialogError] = useState<string | null>(null);

  const runAction = async (fn: () => Promise<OnCallPlanActionResult>) => {
    setBusy(true);
    setFeedback(null);
    const result = await fn();
    setBusy(false);
    if (!result.ok) {
      // AUFTRAG_23 Punkt 1: jeder Fehlerpfad setzt weiterhin "error" - hier
      // ändert sich nur der Behälter (feedback statt error), nicht der
      // Wortlaut/die Herkunft der Fehlermeldung selbst.
      setFeedback({ kind: "error", message: result.error ?? "Unbekannter Fehler." });
      return;
    }
    setSelectedTechnician(null);
    startTransition(() => router.refresh());
  };

  // AUFTRAG_18 Punkt 8, ergaenzt durch AUFTRAG_23 Punkt 1: dieselbe,
  // bereits bestehende Meldungsflaeche der Komponente (jetzt State
  // `feedback` statt `error`, angezeigt im Kartenelement direkt unterhalb
  // des Ansichtsumschalters) - aber nun mit einer ART (Erfolg/Fehler), damit
  // eine gelungene Zeitraum-Anlage NICHT mehr wie ein Fehler aussieht.
  // Null angelegte Tage sind am Wortlaut "0 Tage eingeplant" erkennbar UND
  // werden jetzt ausdruecklich NICHT als Erfolg (kind "error") dargestellt -
  // Wortlaut/Inhalt bleibt gegenueber AUFTRAG_18 unveraendert (Punkt 8,
  // letzter Satz), nur die Einordnung als "kein Erfolg" ist neu.
  const runRangeAction = async (fn: () => Promise<OnCallPlanRangeResult>) => {
    setBusy(true);
    setFeedback(null);
    const result = await fn();
    setBusy(false);
    if (!result.ok) {
      setFeedback({ kind: "error", message: result.error ?? "Unbekannter Fehler." });
      return;
    }
    const created = result.createdCount ?? 0;
    const skipped = result.skippedCount ?? 0;
    if (created === 0) {
      setFeedback({
        kind: "error",
        message: `0 Tage eingeplant (alle ${skipped} Tag(e) im gewählten Zeitraum waren bereits vergeben).`,
      });
    } else {
      setFeedback({
        kind: "success",
        message: skipped > 0
          ? `${created} Tag(e) eingeplant, ${skipped} Tag(e) waren bereits vergeben.`
          : `${created} Tag(e) eingeplant.`,
      });
    }
    setSelectedTechnician(null);
    startTransition(() => router.refresh());
  };

  const openAssignDialog = (target: TargetCell, technicianId: string) => {
    setPendingAssign({ target, technicianId });
    setRangeToIso(target.dateIso);
    setRangeDialogError(null);
  };

  const closeAssignDialog = () => {
    setPendingAssign(null);
    setRangeToIso("");
    setRangeDialogError(null);
  };

  /** Anzahl Kalendertage von fromIso bis toIso EINSCHLIESSLICH beider Enden -
   * bricht fruehzeitig ab, sobald `limit` ueberschritten ist (AUFTRAG_20,
   * Korrektur zu AUFTRAG_18). Exaktes Muster von countDaysInclusive() in
   * on-call-plan-actions.ts: kein unbegrenztes Hochzaehlen bei einem grob
   * falschen Datum (z. B. einem Tippfehler im Jahr) - der Rueckgabewert ist
   * dann nur noch verlaesslich als "> limit" zu lesen, nicht mehr als exakte
   * Tagesanzahl. */
  const countDaysInRange = (fromIso: string, toIso: string, limit: number): number => {
    let count = 1;
    let cursor = fromIso;
    while (cursor < toIso) {
      cursor = addDaysToIsoDate(cursor, 1);
      count += 1;
      if (count > limit) return count;
    }
    return count;
  };

  /** Alle Kalendertage "YYYY-MM-DD" von fromIso bis toIso EINSCHLIESSLICH
   * beider Enden - fuer die Doppelbelegungspruefung ueber den ganzen
   * Zeitraum (Punkt 5). Aufrufer MUESSEN die Tagesanzahl vorher mit
   * countDaysInRange() gegen MAX_RANGE_DAYS pruefen (AUFTRAG_20 Punkt 1/2);
   * die Schranke unten ist NUR ein Sicherheitsnetz (Punkt 3), falls ein
   * kuenftiger Aufrufer diese Pruefung vergisst - die Funktion erzeugt dann
   * unter keinen Umstaenden mehr als MAX_RANGE_DAYS + 1 Eintraege. */
  const isoDatesInRange = (fromIso: string, toIso: string): string[] => {
    const days: string[] = [];
    let cursor = fromIso;
    for (;;) {
      days.push(cursor);
      if (cursor === toIso) break;
      // Sicherheitsnetz (AUFTRAG_20 Punkt 3): harte Obergrenze unabhaengig
      // von der vorgelagerten Pruefung in handleAssignRange().
      if (days.length > MAX_RANGE_DAYS) break;
      cursor = addDaysToIsoDate(cursor, 1);
    }
    return days;
  };

  // "Nur diesen Tag" (Punkt 2, vorbelegt): schreibt genau den Von-Tag,
  // entspricht dem bisherigen Tag-fuer-Tag-Verhalten inkl. derselben
  // Doppelbelegungs-Rueckfrage wie beim Verschieben.
  const handleAssignSingleDay = () => {
    if (!pendingAssign) return;
    const { target, technicianId } = pendingAssign;
    const conflict = findConflictingEntry(activeEntries, technicianId, target.dateIso, target);
    if (conflict) {
      const location = describeLocation(conflict, activeStages);
      const confirmed = window.confirm(
        `${conflict.technician_name} ist am ${formatIsoDateDe(target.dateIso)} bereits eingeplant (${location}). `
        + "Trotzdem zusätzlich hier einplanen?",
      );
      if (!confirmed) return;
    }
    closeAssignDialog();
    void runAction(() =>
      target.kind === "dispo"
        ? assignDispo(target.dateIso, technicianId)
        : assignOnCall(target.stageId, target.dateIso, technicianId),
    );
  };

  // "Zeitraum eintragen" (Punkt 2): Von bis Bis einschliesslich beider
  // Enden, EINE Server-Action (assignOnCallRange), Doppelbelegungspruefung
  // ueber ALLE Tage des Zeitraums (Punkt 5), gesammelt in EINER Rueckfrage.
  const handleAssignRange = () => {
    if (!pendingAssign) return;
    const { target, technicianId } = pendingAssign;
    const fromIso = target.dateIso;

    // Punkt 3: Bis vor Von ist unzulaessig - sichtbare Meldung im Dialog,
    // kein Schreibvorgang, Dialog bleibt offen.
    if (rangeToIso < fromIso) {
      setRangeDialogError("Das Bis-Datum darf nicht vor dem Von-Datum liegen.");
      return;
    }
    // Punkt 4: Obergrenze 92 Tage (ein Quartal), harter Fehler - Anzahl ZUERST
    // mit einem frueh abbrechenden Zaehler bestimmen (AUFTRAG_20), bevor die
    // vollstaendige Tagesliste ueberhaupt aufgebaut wird.
    if (countDaysInRange(fromIso, rangeToIso, MAX_RANGE_DAYS) > MAX_RANGE_DAYS) {
      setRangeDialogError(
        `Der Zeitraum darf höchstens ${MAX_RANGE_DAYS} Tage umfassen (Schutz gegen einen Tippfehler im Jahr).`,
      );
      return;
    }
    setRangeDialogError(null);
    const days = isoDatesInRange(fromIso, rangeToIso);

    // Punkt 5: GRENZE (wie bei findConflictingEntry oben, hier ausdruecklich
    // wiederholt) - geprueft wird nur gegen die bereits GELADENEN Plandaten
    // der sichtbaren Woche bzw. des sichtbaren Monats. Ein Zeitraum, der
    // ueber den angezeigten Zeitraum hinausreicht, kann ausserhalb liegende
    // Dubletten nicht sehen - das ist eine Hilfe, KEINE Garantie.
    const conflictDays = days.filter(
      (day) => findConflictingEntry(activeEntries, technicianId, day, target) !== null,
    );
    if (conflictDays.length > 0) {
      const firstConflict = findConflictingEntry(activeEntries, technicianId, conflictDays[0], target)!;
      const shown = conflictDays.slice(0, 5).map(formatIsoDateDe);
      const restCount = conflictDays.length - shown.length;
      const daysText = restCount > 0 ? `${shown.join(", ")}, … und ${restCount} weitere` : shown.join(", ");
      const confirmed = window.confirm(
        `${firstConflict.technician_name} ist im gewählten Zeitraum an ${conflictDays.length} Tag(en) `
        + `bereits andernorts eingeplant: ${daysText}. Trotzdem einplanen?`,
      );
      if (!confirmed) return;
    }

    const rangeTarget: OnCallRangeTarget =
      target.kind === "dispo" ? { kind: "dispo" } : { kind: "bereitschaft", stageId: target.stageId };
    closeAssignDialog();
    void runRangeAction(() => assignOnCallRange(rangeTarget, fromIso, rangeToIso, technicianId));
  };

  // AUFTRAG_17: Grundlage der Doppelbelegungspruefung UND der Markierung in
  // der Monteurliste ist derselbe, bereits ueber die Props geladene
  // Datensatz - je nach Ansicht week.entries/week.stages oder
  // month.entries/month.stages. Siehe Grenze im Kommentar oberhalb von
  // findConflictingEntry.
  const activeEntries: OnCallPlanEntry[] = view === "woche" ? (week?.entries ?? []) : (month?.entries ?? []);
  const activeStages: OnCallStageOption[] = view === "woche" ? (week?.stages ?? []) : (month?.stages ?? []);

  const handleRemove = (entryId: string) => runAction(() => removeOnCall(entryId));

  const handleDropOrClickAssign = (target: TargetCell, payload: DragPayload) => {
    // AUFTRAG_17 Punkt 2: Doppelbelegungspruefung VOR jeder Neuzuweisung UND
    // jedem Verschieben - ein gemeinsamer Pruefpunkt fuer beide
    // Schreibpfade. Erkennt die Pruefung eine bestehende Zuweisung am
    // selben Tag (anderer Bauabschnitt oder Dispo), fragt sie konkret nach;
    // bricht der Disponent ab, wird runAction in KEINEM der beiden Zweige
    // unten aufgerufen - der Zustand (insb. die Monteurauswahl) bleibt
    // unveraendert.
    const excludeEntryId = payload.kind === "move" ? payload.entryId : undefined;
    const conflict = findConflictingEntry(
      activeEntries, payload.technicianId, target.dateIso, target, excludeEntryId,
    );
    if (conflict) {
      const location = describeLocation(conflict, activeStages);
      const confirmed = window.confirm(
        `${conflict.technician_name} ist am ${formatIsoDateDe(target.dateIso)} bereits eingeplant (${location}). `
        + "Trotzdem zusätzlich hier einplanen?",
      );
      if (!confirmed) return;
    }
    if (payload.kind === "move") {
      void runAction(() =>
        target.kind === "dispo"
          ? moveOnCallEntry(payload.entryId, { kind: "dispo", dateIso: target.dateIso })
          : moveOnCallEntry(payload.entryId, { kind: "bereitschaft", stageId: target.stageId, dateIso: target.dateIso }),
      );
      return;
    }
    void runAction(() =>
      target.kind === "dispo"
        ? assignDispo(target.dateIso, payload.technicianId)
        : assignOnCall(target.stageId, target.dateIso, payload.technicianId),
    );
  };

  const onCellDrop = (target: TargetCell) => (e: DragEvent) => {
    e.preventDefault();
    // AUFTRAG_23 Punkt 4 (M4): faellt VOR jeder weiteren Pruefung/Aktion -
    // waehrend busy gilt (eine Schreibaktion laeuft bereits), loest ein Drop
    // keine zweite Aktion mehr aus (fail-closed am Anfang der Behandlung).
    if (!canEdit || busy) return;
    const raw = e.dataTransfer.getData(DND_MIME);
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as DragPayload;
      if (payload.kind === "move") {
        // Punkt 6: Verschieben bleibt einzeltägig, OHNE Dialog - unveränderter
        // Pfad über handleDropOrClickAssign wie vor AUFTRAG_18.
        handleDropOrClickAssign(target, payload);
      } else {
        // Punkt 1: Neuzuweisung öffnet den "von-bis"-Dialog VOR jedem Schreiben.
        openAssignDialog(target, payload.technicianId);
      }
    } catch {
      // unbrauchbare Nutzlast - fail-closed, keine Aktion.
    }
  };

  const onCellClick = (target: TargetCell) => () => {
    // AUFTRAG_23 Punkt 4 (M4): fail-closed am Anfang - ein zweiter Klick
    // waehrend busy (laufende Speicherung) erzeugt keine zweite Zuweisung.
    if (!canEdit || busy || !selectedTechnician) return;
    // Punkt 1: Klick-Ebene Woche ist ausschließlich Neuzuweisung - Dialog vor
    // jedem Schreiben, kein direkter assignOnCall/assignDispo-Aufruf mehr hier.
    openAssignDialog(target, selectedTechnician);
  };

  const onEntryDragStart = (e: DragEvent, entry: OnCallPlanEntry) => {
    const payload: DragPayload = { kind: "move", entryId: entry.id, technicianId: entry.technician_id };
    e.dataTransfer.setData(DND_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  };

  const onRemoveZoneDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOverZone(null);
    // AUFTRAG_23 Punkt 4 (M4): dieselbe fail-closed-Regel wie bei onCellDrop.
    if (!canEdit || busy) return;
    const raw = e.dataTransfer.getData(DND_MIME);
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as DragPayload;
      if (payload.kind === "move") handleRemove(payload.entryId);
    } catch {
      // nichts tun
    }
  };

  const selectTechnician = (id: string) => {
    setFeedback(null);
    setSelectedTechnician((prev) => (prev === id ? null : id));
  };

  // AUFTRAG_17 Punkt 4: Anzahl VERSCHIEDENER Kalendertage je Monteur im
  // aktuell sichtbaren Zeitraum (nicht Anzahl Zeilen - Dispo UND
  // Bereitschaft am selben Tag zaehlen als 1 Tag). Nur fuer die Markierung
  // in der Liste, KEIN Filter - die Liste (technicians.map weiter unten)
  // bleibt unveraendert vollstaendig.
  const daysByTechnician = new Map<string, Set<string>>();
  for (const e of activeEntries) {
    const days = daysByTechnician.get(e.technician_id) ?? new Set<string>();
    days.add(e.plan_date);
    daysByTechnician.set(e.technician_id, days);
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_240px]">
      <div className="space-y-3">
        <ViewSwitcher view={view} week={week} month={month} busy={busy} startTransition={startTransition} router={router} />

        {feedback ? (
          // AUFTRAG_23 Punkt 1 (M1/M2): ausschliesslich vorhandene AP8-Utilities
          // (card + badge/badge-success/badge-danger) - keine neue Farbe, kein
          // Hex, keine harte Tailwind-Farbklasse. Erfolg und Fehler sind ueber die
          // Badge-Farbe UND das Wort ("Erfolg"/"Fehler") unterscheidbar.
          <div className="card p-3 text-sm">
            <span className={feedback.kind === "success" ? "badge badge-success" : "badge badge-danger"}>
              {feedback.kind === "success" ? "Erfolg" : "Fehler"}
            </span>{" "}
            {feedback.message}
          </div>
        ) : null}

        {canEdit ? (
          <p className="text-xs text-muted">
            Bedienung: Monteur rechts antippen oder ziehen, dann eine Zelle antippen bzw. dort ablegen. Ein „×&rdquo; an
            einer Zuweisung entfernt sie.
          </p>
        ) : null}

        {view === "woche" && week ? (
          <WeekMatrix
            week={week}
            canEdit={canEdit}
            busy={busy}
            onCellDrop={onCellDrop}
            onCellClick={onCellClick}
            onRemove={handleRemove}
            onEntryDragStart={onEntryDragStart}
          />
        ) : null}

        {view === "monat" && month ? (
          <MonthGrid
            month={month}
            canEdit={canEdit}
            busy={busy}
            selectedTechnician={selectedTechnician}
            onRemove={handleRemove}
            monthPromptDate={monthPromptDate}
            setMonthPromptDate={setMonthPromptDate}
            monthPromptStage={monthPromptStage}
            setMonthPromptStage={setMonthPromptStage}
            onConfirmPrompt={(dateIso) => {
              if (!selectedTechnician) return;
              const target: TargetCell =
                monthPromptStage === "__dispo__"
                  ? { kind: "dispo", dateIso }
                  : { kind: "bereitschaft", stageId: monthPromptStage, dateIso };
              // Punkt 1: Klickpfad Monat ist ebenfalls ausschließlich
              // Neuzuweisung - Dialog vor jedem Schreiben (AUFTRAG_18).
              openAssignDialog(target, selectedTechnician);
              setMonthPromptDate(null);
            }}
          />
        ) : null}
      </div>

      {canEdit ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase text-muted">Monteure</div>
          <div
            // AUFTRAG_23 Punkt 3 (M3): Drag-Feedback ueber vorhandene Token-
            // Utilities (bg-surface-2, --ring) - kein neues Drop-Ziel, nur eine
            // Hervorhebung des bereits bestehenden.
            className={`flex flex-col gap-2 rounded-md${
              dragOverZone === "list" ? " bg-surface-2 ring-2 ring-[var(--ring)]" : ""
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={() => setDragOverZone("list")}
            onDragLeave={() => setDragOverZone((z) => (z === "list" ? null : z))}
            onDrop={onRemoveZoneDrop}
          >
            {technicians.map((t) => (
              <TechnicianChip
                key={t.id}
                technician={t}
                selected={selectedTechnician === t.id}
                canEdit={canEdit}
                assignedDaysCount={daysByTechnician.get(t.id)?.size ?? 0}
                onSelect={() => selectTechnician(t.id)}
              />
            ))}
            {technicians.length === 0 ? <p className="text-sm text-muted">Keine aktiven Monteure.</p> : null}
          </div>
          <div
            className={`mt-2 rounded-md border-2 border-dashed border-border p-3 text-center text-xs text-muted${
              dragOverZone === "trash" ? " bg-surface-2 ring-2 ring-[var(--ring)]" : ""
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={() => setDragOverZone("trash")}
            onDragLeave={() => setDragOverZone((z) => (z === "trash" ? null : z))}
            onDrop={onRemoveZoneDrop}
          >
            Hierher ziehen zum Entfernen
          </div>
        </div>
      ) : null}

      {pendingAssign ? (
        <AssignRangeDialog
          target={pendingAssign.target}
          technicianName={
            technicians.find((t) => t.id === pendingAssign.technicianId)
              ? `${technicians.find((t) => t.id === pendingAssign.technicianId)!.first_name} ${technicians.find((t) => t.id === pendingAssign.technicianId)!.last_name}`
              : ""
          }
          targetLabel={
            pendingAssign.target.kind === "dispo"
              ? DISPO_ROW_LABEL
              : (() => {
                  const stage = activeStages.find((s) => s.id === (pendingAssign.target as { kind: "bereitschaft"; stageId: string }).stageId);
                  if (!stage) return "einem Bauabschnitt";
                  return stage.code ? `${stage.code} – ${stage.name}` : stage.name;
                })()
          }
          rangeToIso={rangeToIso}
          setRangeToIso={(v) => { setRangeToIso(v); setRangeDialogError(null); }}
          rangeDialogError={rangeDialogError}
          busy={busy}
          onSingleDay={handleAssignSingleDay}
          onRange={handleAssignRange}
          onClose={closeAssignDialog}
        />
      ) : null}
    </div>
  );
}

function ViewSwitcher({
  view, week, month, busy, startTransition, router,
}: {
  view: "woche" | "monat";
  week: OnCallWeek | null;
  month: OnCallMonth | null;
  busy: boolean;
  startTransition: (fn: () => void) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const navigate = (params: Record<string, string>) => {
    const usp = new URLSearchParams(params);
    startTransition(() => router.push(`/bereitschaftsplan?${usp.toString()}`));
  };

  if (view === "woche" && week) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" style={touchStyle} disabled={busy} onClick={() => navigate({ ansicht: "monat" })}>
          Monatsansicht
        </Button>
        <span className="mx-1 text-muted">|</span>
        <Button
          variant="outline" style={touchStyle} disabled={busy}
          onClick={() => navigate({ ansicht: "woche", woche: addDaysToIsoDate(week.weekStart, -7) })}
        >
          ← Vorherige Woche
        </Button>
        <Button
          variant="outline" style={touchStyle} disabled={busy}
          onClick={() => navigate({ ansicht: "woche", woche: mondayOfWeekBerlinIso() })}
        >
          Heute
        </Button>
        <Button
          variant="outline" style={touchStyle} disabled={busy}
          onClick={() => navigate({ ansicht: "woche", woche: addDaysToIsoDate(week.weekStart, 7) })}
        >
          Nächste Woche →
        </Button>
        <span className="text-sm text-muted">Woche vom {week.weekStart} bis {week.days[6]}</span>
      </div>
    );
  }
  if (view === "monat" && month) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" style={touchStyle} disabled={busy} onClick={() => navigate({ ansicht: "woche" })}>
          Wochenansicht
        </Button>
        <span className="mx-1 text-muted">|</span>
        <Button
          variant="outline" style={touchStyle} disabled={busy}
          onClick={() => navigate({ ansicht: "monat", monat: addMonthsToIsoDate(month.monthStart, -1) })}
        >
          ← Vorheriger Monat
        </Button>
        <Button
          variant="outline" style={touchStyle} disabled={busy}
          onClick={() => navigate({ ansicht: "monat", monat: startOfMonthBerlinIso() })}
        >
          Heute
        </Button>
        <Button
          variant="outline" style={touchStyle} disabled={busy}
          onClick={() => navigate({ ansicht: "monat", monat: addMonthsToIsoDate(month.monthStart, 1) })}
        >
          Nächster Monat →
        </Button>
        <span className="text-sm text-muted">{month.monthStart.slice(0, 7)}</span>
      </div>
    );
  }
  return null;
}

function WeekMatrix({
  week, canEdit, busy, onCellDrop, onCellClick, onRemove, onEntryDragStart,
}: {
  week: OnCallWeek;
  canEdit: boolean;
  busy: boolean;
  onCellDrop: (target: TargetCell) => (e: DragEvent) => void;
  onCellClick: (target: TargetCell) => () => void;
  onRemove: (id: string) => void;
  onEntryDragStart: (e: DragEvent, entry: OnCallPlanEntry) => void;
}) {
  // AUFTRAG_23 Punkt 3 (M3): welche Zielzelle (cellKey) gerade waehrend eines
  // Drag-Vorgangs ueberflogen wird - ausschliesslich fuer die visuelle
  // Hervorhebung (onDragEnter setzt, onDragLeave/onDrop setzen zurueck). Kein
  // neues Drop-Ziel, dieselben Zellen wie bisher.
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const dispoEntries = week.entries.filter((e) => e.assignment_kind === "dispo");
  const bereitschaftEntries = week.entries.filter((e) => e.assignment_kind === "bereitschaft");
  const byCell = new Map<string, OnCallPlanEntry[]>();
  for (const e of bereitschaftEntries) {
    const key = cellKey(e.construction_stage_id ?? "", e.plan_date);
    const list = byCell.get(key) ?? [];
    list.push(e);
    byCell.set(key, list);
  }
  const dispoByDay = new Map<string, OnCallPlanEntry[]>();
  for (const e of dispoEntries) {
    const list = dispoByDay.get(e.plan_date) ?? [];
    list.push(e);
    dispoByDay.set(e.plan_date, list);
  }

  const renderCell = (target: TargetCell, entries: OnCallPlanEntry[]) => {
    const key = target.kind === "dispo" ? `dispo-${target.dateIso}` : `bereitschaft-${target.stageId}-${target.dateIso}`;
    // AUFTRAG_23 Punkt 3 (M3): sichtbare Hervorhebung der Zielzelle waehrend
    // eines Drags, ausschliesslich ueber vorhandene Token/Utilities.
    const isDragOver = canEdit && dragOverKey === key;
    return (
      <td
        key={key}
        className={`px-3 py-2 align-top${isDragOver ? " bg-surface-2 ring-2 ring-[var(--ring)]" : ""}`}
        // AUFTRAG_23 Punkt 4 (M4): waehrend busy verringerte Deckkraft +
        // aria-busy, DAMIT ERKENNBAR ist, dass gerade gespeichert wird - der
        // eigentliche fail-closed-Abbruch steht in onCellDrop/onCellClick
        // selbst (Reihenfolge dort: busy-Pruefung als erstes), hier nur die
        // sichtbare Rueckmeldung. minHeight bewusst entfernt (kein Einfluss
        // auf die Zeilenhoehe mehr noetig, die Zelle traegt bereits genug
        // Inhalt).
        aria-busy={busy || undefined}
        style={{
          ...(canEdit ? { cursor: busy ? "not-allowed" : "copy" } : undefined),
          opacity: busy ? 0.6 : 1,
        }}
        onDragOver={(e) => canEdit && !busy && e.preventDefault()}
        onDragEnter={canEdit && !busy ? () => setDragOverKey(key) : undefined}
        onDragLeave={canEdit ? () => setDragOverKey((prev) => (prev === key ? null : prev)) : undefined}
        onDrop={
          canEdit
            ? (e) => {
                setDragOverKey(null);
                onCellDrop(target)(e);
              }
            : undefined
        }
        onClick={canEdit ? onCellClick(target) : undefined}
      >
        <div className="flex flex-wrap items-center gap-1">
          {target.kind === "bereitschaft" ? (
            // AUFTRAG_17 Punkt 2: reine Anzeige, keine harte Grenze. Die
            // Dispo-Zeile (target.kind === "dispo") bekommt laut Auftrag
            // ausdruecklich KEINE Besetzungsanzeige.
            <span
              className={occupancyBadgeClass(entries.length)}
              title={`Soll ${SOLL_BESETZUNG_BEREITSCHAFT} Monteure je Bauabschnitt und Tag (Anzeige, keine Grenze)`}
            >
              {entries.length}/{SOLL_BESETZUNG_BEREITSCHAFT}
            </span>
          ) : null}
          {entries.map((e) => (
            <AssignedChip key={e.id} entry={e} canEdit={canEdit} busy={busy} onRemove={onRemove} onDragStartEntry={onEntryDragStart} />
          ))}
          {/* AUFTRAG_23 Punkt 5 (M5): Leerzustand-Platzhalter jetzt UNABHAENGIG
              von canEdit - vorher sahen Monteure (canEdit === false) in einer
              leeren Zelle gar nichts, sondern eine kommentarlose Luecke. */}
          {entries.length === 0 ? <span className="text-xs text-muted">—</span> : null}
        </div>
      </td>
    );
  };

  return (
    <div className="overflow-x-auto" aria-busy={busy || undefined}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="whitespace-nowrap border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase text-muted">
              Bauabschnitt
            </th>
            {week.days.map((d, i) => (
              <th key={d} className="whitespace-nowrap border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase text-muted">
                {formatDayLabel(d, i)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-border bg-surface-2 align-top">
            <td className="whitespace-nowrap px-3 py-2 font-semibold text-foreground">{DISPO_ROW_LABEL}</td>
            {week.days.map((day) => renderCell({ kind: "dispo", dateIso: day }, dispoByDay.get(day) ?? []))}
          </tr>
          {week.stages.map((stage) => (
            <tr key={stage.id} className="border-t border-border align-top">
              <td className="whitespace-nowrap px-3 py-2 font-medium text-foreground">
                {stage.code ? `${stage.code} – ${stage.name}` : stage.name}
              </td>
              {week.days.map((day) =>
                renderCell({ kind: "bereitschaft", stageId: stage.id, dateIso: day }, byCell.get(cellKey(stage.id, day)) ?? []),
              )}
            </tr>
          ))}
          {week.stages.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-3 py-6 text-center text-muted">Keine aktiven Bauabschnitte.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function MonthGrid({
  month, canEdit, busy, selectedTechnician, onRemove,
  monthPromptDate, setMonthPromptDate, monthPromptStage, setMonthPromptStage, onConfirmPrompt,
}: {
  month: OnCallMonth;
  canEdit: boolean;
  busy: boolean;
  selectedTechnician: string | null;
  onRemove: (id: string) => void;
  monthPromptDate: string | null;
  setMonthPromptDate: (d: string | null) => void;
  monthPromptStage: string;
  setMonthPromptStage: (s: string) => void;
  onConfirmPrompt: (dateIso: string) => void;
}) {
  const entriesByDay = new Map<string, OnCallPlanEntry[]>();
  for (const e of month.entries) {
    const list = entriesByDay.get(e.plan_date) ?? [];
    list.push(e);
    entriesByDay.set(e.plan_date, list);
  }
  const inMonthSet = new Set(month.daysInMonth);
  // AUFTRAG_23 Punkt 5 (M5): Leerzustand fuer den GESAMTEN Monat - vorher
  // zeigte ein Monat ganz ohne Zuweisung nur ein leeres Raster ohne
  // Erklaerung. Sachlicher Satz, fuer Monteure (canEdit === false) OHNE
  // Aufforderung zum Bedienen, fuer Staff (canEdit === true) mit kurzem
  // Bedienhinweis. Reine Textanzeige, kein neues Element mit Farbklasse.
  const monthIsEmpty = month.entries.length === 0;

  return (
    <div className="space-y-2" aria-busy={busy || undefined}>
      {monthIsEmpty ? (
        <p className="text-sm text-muted">
          {canEdit
            ? "Für diesen Monat ist noch keine Bereitschaft eingeplant. Monteur rechts auswählen, dann einen Tag antippen."
            : "Für diesen Monat ist noch keine Bereitschaft eingeplant."}
        </p>
      ) : null}
      <div className="grid grid-cols-7 gap-1 text-xs font-semibold uppercase text-muted">
        {WEEKDAY_LABELS.map((w) => <div key={w} className="px-1">{w}</div>)}
      </div>
      {month.weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 gap-1">
          {week.map((day) => {
            const entries = entriesByDay.get(day) ?? [];
            const inMonth = inMonthSet.has(day);
            return (
              <div
                key={day}
                className="min-h-24 rounded-md border border-border p-1"
                style={{
                  opacity: !inMonth ? 0.4 : busy ? 0.6 : 1,
                  cursor: canEdit && selectedTechnician ? (busy ? "not-allowed" : "copy") : undefined,
                }}
                onClick={() => {
                  // AUFTRAG_23 Punkt 4 (M4): fail-closed am Anfang - busy
                  // blockiert den Klickpfad der Monatsansicht genauso wie den
                  // der Wochenmatrix.
                  if (!canEdit || busy || !selectedTechnician) return;
                  setMonthPromptDate(day);
                }}
              >
                <div className="text-xs text-muted">{formatDayShort(day)}</div>
                <div className="mt-1 flex flex-col gap-0.5">
                  {entries.map((e) => (
                    <span key={e.id} className="flex items-center justify-between gap-1 rounded bg-surface-2 px-1 text-[11px]">
                      <span className="truncate">
                        {e.assignment_kind === "dispo" ? "Dispo: " : ""}
                        {e.technician_name}
                      </span>
                      {canEdit ? (
                        <button
                          type="button"
                          aria-label={`${e.technician_name} entfernen`}
                          className="text-muted hover:text-destructive"
                          disabled={busy}
                          onClick={(ev) => { ev.stopPropagation(); onRemove(e.id); }}
                        >
                          ×
                        </button>
                      ) : null}
                    </span>
                  ))}
                </div>
                {monthPromptDate === day ? (
                  <div className="mt-1 space-y-1 rounded border border-border bg-surface p-1" onClick={(e) => e.stopPropagation()}>
                    <select
                      className="input text-xs"
                      style={{ minHeight: "32px" }}
                      value={monthPromptStage}
                      onChange={(e) => setMonthPromptStage(e.target.value)}
                      aria-label="Bauabschnitt oder Dispo wählen"
                    >
                      <option value="__dispo__">Dispo/Bereitschaftstelefon</option>
                      {month.stages.map((s) => (
                        <option key={s.id} value={s.id}>{s.code ? `${s.code} – ${s.name}` : s.name}</option>
                      ))}
                    </select>
                    <div className="flex gap-1">
                      <Button size="sm" style={{ minHeight: "32px" }} disabled={busy} onClick={() => onConfirmPrompt(day)}>OK</Button>
                      <Button variant="outline" size="sm" style={{ minHeight: "32px" }} disabled={busy} onClick={() => setMonthPromptDate(null)}>Abbrechen</Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// =====================================================================
// AUFTRAG_18 – Der "von-bis"-Dialog (Entscheidung Dennis 2026-08-18, siehe
// Kopfkommentar dieser Datei). Nutzt den vorhandenen Copy-in-Baustein aus
// components/ui/shadcn/dialog.tsx UNVERÄNDERT (Stopppunkt-Regel des
// Auftrags: die Komponente steht nicht auf der Positivliste). "Nur diesen
// Tag" ist der vorbelegte Button (type="submit" in einem <form>, damit die
// Enter-Taste GENAU diesen Pfad auslöst - Punkt 2, letzter Satz); "Zeitraum
// eintragen" und "Abbrechen" sind bewusst type="button", damit sie NICHT
// auf Enter reagieren. Abbrechen/Schließen (onOpenChange bei Escape/Klick
// auf das X) ruft ausschließlich onClose() - schreibt nichts.
// =====================================================================
function AssignRangeDialog({
  target, technicianName, targetLabel, rangeToIso, setRangeToIso, rangeDialogError,
  busy, onSingleDay, onRange, onClose,
}: {
  target: TargetCell;
  technicianName: string;
  targetLabel: string;
  rangeToIso: string;
  setRangeToIso: (value: string) => void;
  rangeDialogError: string | null;
  busy: boolean;
  onSingleDay: () => void;
  onRange: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{technicianName} einplanen</DialogTitle>
          <DialogDescription>Ziel: {targetLabel}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3 text-sm"
          onSubmit={(e) => { e.preventDefault(); onSingleDay(); }}
        >
          <div>
            <span className="font-semibold">Von: </span>
            {formatIsoDateDe(target.dateIso)}
          </div>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Bis</span>
            <input
              type="date"
              className="input"
              style={touchStyle}
              value={rangeToIso}
              min={target.dateIso}
              onChange={(e) => setRangeToIso(e.target.value)}
              aria-label="Bis (letzter Tag des Zeitraums, einschließlich)"
            />
          </label>
          {rangeDialogError ? (
            <span className="badge badge-warning" role="alert">{rangeDialogError}</span>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" style={touchStyle} disabled={busy} onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="button" variant="outline" style={touchStyle} disabled={busy} onClick={onRange}>
              Zeitraum eintragen
            </Button>
            <Button type="submit" style={touchStyle} disabled={busy}>
              Nur diesen Tag
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
