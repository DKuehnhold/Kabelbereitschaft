// =====================================================================
// AUFTRAG_14 – Dispo-Board: Farbpalette der Qualifikationen.
//
// public.qualifications.color (0022_hlk_dispo_board.sql) speichert
// AUSSCHLIESSLICH einen dieser Palettenschlüssel, geprüft dort über
// qualifications_color_chk. Diese Konstante ist die EINZIGE Quelle der
// Palette für die Anwendung (Formular-Auswahl, Monteur-Karten im
// Dispo-Board) – die Schlüsselmenge MUSS mit dem Check-Constraint in der
// Migration übereinstimmen.
//
// Die Tokens selbst liegen additiv in globals.css (AUFTRAG_11/13-Bestand
// bleibt unverändert): sechs bis acht token-basierte Werte laut Auftrag,
// keine freien Hex-Werte im Formular. 'grau' ist zusätzlich die neutrale
// Standardfarbe für einen Monteur OHNE Qualifikation (Punkt 3 im Auftrag) –
// sie ist damit sowohl ein wählbarer Palettenwert als auch der
// Anwendungs-Default.
// =====================================================================

export const QUALIFICATION_COLOR_KEYS = [
  "rot",
  "blau",
  "gruen",
  "gelb",
  "orange",
  "violett",
  "tuerkis",
  "grau",
] as const;

export type QualificationColorKey = (typeof QUALIFICATION_COLOR_KEYS)[number];

/** Neutrale Standardfarbe für einen Monteur ohne (aktive) Qualifikation. */
export const DEFAULT_QUALIFICATION_COLOR: QualificationColorKey = "grau";

export function isQualificationColorKey(value: string): value is QualificationColorKey {
  return (QUALIFICATION_COLOR_KEYS as readonly string[]).includes(value);
}

const LABELS: Record<QualificationColorKey, string> = {
  rot: "Rot",
  blau: "Blau",
  gruen: "Grün",
  gelb: "Gelb",
  orange: "Orange",
  violett: "Violett",
  tuerkis: "Türkis",
  grau: "Grau (neutral)",
};

export function qualificationColorLabel(key: QualificationColorKey): string {
  return LABELS[key];
}

/** CSS-Variablennamen (globals.css) für Hintergrund/Text je Palettenschlüssel. */
export function qualificationColorVars(key: QualificationColorKey): {
  bg: string;
  fg: string;
} {
  return { bg: `var(--qual-${key}-bg)`, fg: `var(--qual-${key}-fg)` };
}

export type QualificationRow = {
  id: string;
  label: string;
  rank: number;
  color: string;
  is_active: boolean;
};

export type TechnicianQualificationRow = {
  id: string;
  technician_id: string;
  qualification_id: string;
};

/**
 * Höchste Qualifikation (größter `rank`) eines Technikers aus seiner Liste
 * zugeordneter Qualifikations-Kennungen. Ohne (aktive) Qualifikation liefert
 * die Funktion `null` – der Aufrufer setzt dann DEFAULT_QUALIFICATION_COLOR
 * ein. Nur AKTIVE Qualifikationen zählen (eine deaktivierte Qualifikation
 * bestimmt fachlich keine Farbe mehr).
 */
export function highestQualification(
  qualificationIds: readonly string[],
  catalog: readonly QualificationRow[],
): QualificationRow | null {
  let best: QualificationRow | null = null;
  for (const id of qualificationIds) {
    const q = catalog.find((c) => c.id === id && c.is_active);
    if (!q) continue;
    if (!best || q.rank > best.rank) best = q;
  }
  return best;
}

/** Farbschlüssel eines Technikers – höchste Qualifikation oder der neutrale Default. */
export function technicianColorKey(
  qualificationIds: readonly string[],
  catalog: readonly QualificationRow[],
): QualificationColorKey {
  const top = highestQualification(qualificationIds, catalog);
  if (top && isQualificationColorKey(top.color)) return top.color;
  return DEFAULT_QUALIFICATION_COLOR;
}
