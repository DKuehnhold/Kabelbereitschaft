// AP14/B: Schutz des Transaktions-Wrappers gegen Kontrollanweisungen.
//
// ADR-011 / 2.5 verlangt, dass der Wrapper der einzige Weg zu einer Verbindung
// ist und die transaktionslokale Identitaet nicht umgangen werden kann. Der
// Wrapper setzt "app.user_id" per SET LOCAL; die Einstellung endet mit der
// Transaktion. Wuerde eine fachliche Abfrage selbst "commit", "rollback" oder
// "reset" ausfuehren, liefe der Rest der Arbeit ohne Identitaet weiter - genau
// die Ausblutung, die SET LOCAL verhindern soll.
//
// Diese Datei enthaelt bewusst KEINE Laufzeitabhaengigkeit (kein "server-only",
// kein "pg"), damit die Regel isoliert testbar bleibt.
//
// Zwei getrennte Regeln:
//   1. Das erste Schluesselwort darf die Transaktions- oder Sitzungsumgebung
//      nicht veraendern.
//   2. Die Anweisung darf nur EINE Anweisung sein. Ohne diese zweite Regel
//      genuegte die erste nicht: `select 1; set app.user_id = ...` besteht die
//      Schluesselwortpruefung, weil nur `select` gelesen wird.
//
// Warum Regel 2 zusaetzlich zum erzwungenen Extended-Query-Protokoll
// (`queryMode: "extended"` in ./index.ts) besteht: PostgreSQL weist mehrere
// Anweisungen in einer vorbereiteten Anweisung selbst ab. Der Wrapper soll aber
// nicht davon abhaengen, dass diese Protokollwahl an jeder Aufrufstelle und in
// jeder kuenftigen `pg`-Fassung erhalten bleibt. Die strukturelle Sperre wirkt
// unabhaengig davon und VOR dem Verbindungsaufbau.
//
// Grenze der Pruefung (bewusst benannt, nicht verschwiegen): geprueft werden
// Anweisungsstruktur und erstes Schluesselwort. Ein Schutz gegen SQL-Injektion
// ist das nicht und soll es nicht sein - dafuer gilt ausschliesslich die
// Parametrisierung ($1, $2, ...), die der Wrapper erzwingt.

/** Anweisungen, die die Transaktions- oder Sitzungsumgebung veraendern. */
const FORBIDDEN_LEADING_KEYWORDS = [
  "begin",
  "start",
  "commit",
  "end",
  "rollback",
  "savepoint",
  "release",
  "prepare",
  "abort",
  "set",
  "reset",
  "discard",
  "listen",
  "unlisten",
  "notify",
] as const;

/**
 * Entfernt fuehrende Leerzeichen sowie Zeilen- und Blockkommentare, damit die
 * Pruefung nicht durch ein vorangestelltes `-- Kommentar` umgangen wird.
 */
export function leadingKeyword(statement: string): string {
  let rest = statement;
  for (;;) {
    const trimmed = rest.replace(/^\s+/, "");
    if (trimmed.startsWith("--")) {
      const lineEnd = trimmed.indexOf("\n");
      if (lineEnd === -1) return "";
      rest = trimmed.slice(lineEnd + 1);
      continue;
    }
    if (trimmed.startsWith("/*")) {
      const blockEnd = trimmed.indexOf("*/");
      if (blockEnd === -1) return "";
      rest = trimmed.slice(blockEnd + 2);
      continue;
    }
    const match = /^[A-Za-z_]+/.exec(trimmed);
    return match ? match[0].toLowerCase() : "";
  }
}

/** Ende eines Zeilenkommentars; ohne Zeilenumbruch das Ende der Zeichenkette. */
function afterLineComment(text: string, index: number): number {
  const lineEnd = text.indexOf("\n", index);
  return lineEnd === -1 ? text.length : lineEnd + 1;
}

/** Ende eines - in PostgreSQL schachtelbaren - Blockkommentars. */
function afterBlockComment(text: string, index: number): number {
  let depth = 0;
  let cursor = index;
  while (cursor < text.length) {
    if (text.startsWith("/*", cursor)) {
      depth += 1;
      cursor += 2;
      continue;
    }
    if (text.startsWith("*/", cursor)) {
      depth -= 1;
      cursor += 2;
      if (depth === 0) return cursor;
      continue;
    }
    cursor += 1;
  }
  return text.length;
}

/**
 * Ende einer in Anfuehrungszeichen eingeschlossenen Zeichenkette bzw. eines
 * begrenzten Bezeichners. Ein verdoppeltes Anfuehrungszeichen beendet nicht.
 * `allowBackslash` gilt fuer Escape-Zeichenketten (`E'...'`).
 */
function afterQuoted(
  text: string,
  index: number,
  quote: string,
  allowBackslash: boolean,
): number {
  let cursor = index + 1;
  while (cursor < text.length) {
    const character = text[cursor];
    if (allowBackslash && character === "\\") {
      cursor += 2;
      continue;
    }
    if (character === quote) {
      if (text[cursor + 1] === quote) {
        cursor += 2;
        continue;
      }
      return cursor + 1;
    }
    cursor += 1;
  }
  return text.length;
}

/** Beginn eines Dollar-Quotes; `$1` ist ein Parameter und kein Quote. */
const DOLLAR_QUOTE_TAG = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/;

/** Ende eines Dollar-Quotes, oder -1 wenn an dieser Stelle keines beginnt. */
function afterDollarQuoted(text: string, index: number): number {
  const match = DOLLAR_QUOTE_TAG.exec(text.slice(index));
  if (!match) return -1;
  const tag = match[0];
  const closing = text.indexOf(tag, index + tag.length);
  return closing === -1 ? text.length : closing + tag.length;
}

/**
 * True, wenn die Zeichenkette mehr als eine Anweisung enthaelt.
 *
 * Ohne diese Pruefung genuegte die Schluesselwortpruefung nicht: bei
 * `select 1; set app.user_id = '...'` wird nur `select` gelesen. Ein
 * abschliessendes Semikolon ohne folgenden Inhalt ist zulaessig.
 *
 * Zeichenketten, begrenzte Bezeichner, Dollar-Quotes sowie Zeilen- und
 * Blockkommentare werden uebersprungen, damit ein Semikolon INNERHALB eines
 * Literals nicht faelschlich als Trennzeichen gilt.
 */
export function hasMultipleStatements(statement: string): boolean {
  let cursor = 0;
  let separatorSeen = false;

  while (cursor < statement.length) {
    const character = statement[cursor];

    if (/\s/.test(character)) {
      cursor += 1;
      continue;
    }
    if (statement.startsWith("--", cursor)) {
      cursor = afterLineComment(statement, cursor);
      continue;
    }
    if (statement.startsWith("/*", cursor)) {
      cursor = afterBlockComment(statement, cursor);
      continue;
    }
    if (character === ";") {
      separatorSeen = true;
      cursor += 1;
      continue;
    }
    // Ab hier beginnt echter Anweisungsinhalt. Steht davor ein Semikolon, ist
    // es eine zweite Anweisung.
    if (separatorSeen) return true;

    if (character === "'") {
      const isEscapeString =
        cursor > 0 &&
        /[eE]/.test(statement[cursor - 1]) &&
        !/[A-Za-z0-9_$]/.test(statement[cursor - 2] ?? " ");
      cursor = afterQuoted(statement, cursor, "'", isEscapeString);
      continue;
    }
    if (character === '"') {
      cursor = afterQuoted(statement, cursor, '"', false);
      continue;
    }
    if (character === "$") {
      const end = afterDollarQuoted(statement, cursor);
      cursor = end === -1 ? cursor + 1 : end;
      continue;
    }
    cursor += 1;
  }

  return false;
}

/**
 * Grund der Ablehnung, oder NULL wenn die Anweisung zulaessig ist.
 *
 * Die Meldung nennt ausschliesslich das beanstandete Schluesselwort bzw. die
 * verletzte Regel - niemals die vollstaendige Anweisung oder Werte.
 */
function rejectionReason(statement: string): string | null {
  const keyword = leadingKeyword(statement);
  if (keyword === "") {
    return "Leere oder unlesbare SQL-Anweisung im Transaktions-Wrapper.";
  }
  if ((FORBIDDEN_LEADING_KEYWORDS as readonly string[]).includes(keyword)) {
    return (
      `Anweisung "${keyword}" ist im Transaktions-Wrapper nicht erlaubt. ` +
      "Transaktions- und Sitzungssteuerung liegt ausschliesslich beim Wrapper."
    );
  }
  if (hasMultipleStatements(statement)) {
    return (
      "Mehrere Anweisungen in einem Aufruf sind im Transaktions-Wrapper nicht " +
      "erlaubt. Je Aufruf genau eine parametrisierte Anweisung."
    );
  }
  return null;
}

/** True, wenn die Anweisung im Wrapper ausgefuehrt werden darf. */
export function isAllowedStatement(statement: string): boolean {
  return rejectionReason(statement) === null;
}

/**
 * Bricht mit klarer Meldung ab, wenn die Anweisung die Transaktions- oder
 * Sitzungsumgebung veraendern wuerde oder mehrere Anweisungen enthaelt.
 */
export function assertAllowedStatement(statement: string): void {
  const reason = rejectionReason(statement);
  if (reason === null) return;
  throw new Error(reason);
}
