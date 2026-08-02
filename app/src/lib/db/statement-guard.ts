// AP14/B: Schutz des Transaktions-Wrappers gegen Kontroll- und
// Sitzungsanweisungen.
//
// ADR-011 / 2.5 verlangt, dass der Wrapper der einzige Weg zu einer Verbindung
// ist und die transaktionslokale Identitaet nicht umgangen werden kann. Der
// Wrapper setzt "app.user_id" per SET LOCAL; die Einstellung endet mit der
// Transaktion. Wuerde eine fachliche Abfrage selbst "commit", "rollback",
// "reset" oder ein eigenes `set_config('app.user_id', ...)` ausfuehren, liefe
// der Rest der Arbeit ohne oder mit FREMDER Identitaet weiter - genau die
// Ausblutung, die SET LOCAL verhindern soll.
//
// Diese Datei enthaelt bewusst KEINE Laufzeitabhaengigkeit (kein "server-only",
// kein "pg"), damit die Regel isoliert testbar bleibt.
//
// WAS GEPRUEFT WIRD (drei Zusagen mit UNTERSCHIEDLICHER Tragweite - der
// Unterschied ist wichtig und wird hier ausdruecklich benannt):
//   1. STRUKTURELL VOLLSTAENDIG: Das fuehrende Kommando steht in einer
//      ALLOW-Liste (select, insert, update, delete, with). Alles andere - auch
//      jedes kuenftige PostgreSQL-Kommando - ist abgewiesen. Diese Zusage
//      braucht keine Pflege.
//   2. STRUKTURELL VOLLSTAENDIG: Die Zeichenkette ist genau EINE, vollstaendig
//      lesbare Anweisung. Ein unbeendetes Literal, ein unbeendeter Kommentar,
//      ein unbeendeter Bezeichner oder ein Zahlenliteral mit angehaengtem Text
//      ist ein Abweisungsgrund und kein stilles Textende: die Schranke darf ihr
//      Urteil nicht auf einen Text stuetzen, den sie nicht vollstaendig bzw.
//      nicht als das gelesen hat, was er zu sein vorgibt (fail-closed).
//   3. NAMENTLICH UND OHNE VOLLSTAENDIGKEITSANSPRUCH: Bestimmte Bezeichner sind
//      an JEDER Position verboten - nicht nur als erstes Wort. Ohne diese Regel
//      genuegte 1. nicht: `set_config` steht in einem zulaessigen `select` und
//      setzt jede Sitzungsvariable, also auch "app.user_id". Eine Namensliste
//      ist naturgemaess offen; sie sperrt NAMEN, nicht WIRKUNGEN. Siehe die
//      ausdrueckliche Grenze bei FORBIDDEN_IDENTIFIERS.
//
// WAS AUSDRUECKLICH NICHT GEPRUEFT WIRD:
//   - Kein Schutz gegen SQL-Injektion. Dafuer gilt ausschliesslich die
//     Parametrisierung ($1, $2, ...), die die Fassade in ./index.ts erzwingt.
//     Eine per Zeichenkettenverkettung gebaute Anweisung bleibt gefaehrlich,
//     auch wenn sie diese Schranke besteht.
//   - Keine Rechte- oder Zeilenpruefung. RLS bleibt die zweite, unabhaengige
//     Verteidigungslinie.
//
// WAS BEWUSST VORBEI LAEUFT: die wrappereigenen Aufrufe `begin`, `commit`,
// `rollback` und das Setzen der drei transaktionslokalen Parameter
// (statement_timeout, idle_in_transaction_session_timeout, app.user_id) laufen
// in ./index.ts am ROHEN `pg`-Client und damit an dieser Schranke vorbei. Das
// ist Absicht: der Wrapper ist die Instanz, die die Identitaet setzt. Wuerden
// diese Aufrufe durch die Fassade laufen, wuerde die Schranke sie abweisen und
// der Wrapper koennte seine Aufgabe nicht erfuellen.
//
// Warum Regel 2 zusaetzlich zum erzwungenen Extended-Query-Protokoll
// (`queryMode: "extended"` in ./index.ts) besteht: PostgreSQL weist mehrere
// Anweisungen in einer vorbereiteten Anweisung selbst ab. Der Wrapper soll aber
// nicht davon abhaengen, dass diese Protokollwahl an jeder Aufrufstelle und in
// jeder kuenftigen `pg`-Fassung erhalten bleibt. Die strukturelle Sperre wirkt
// unabhaengig davon und VOR dem Verbindungsaufbau.

/**
 * Erlaubte fuehrende Kommandos - eine ALLOW-Liste, keine Verbotsliste.
 *
 * Eine Verbotsliste ist gegen kuenftige und gegen selten bedachte
 * PostgreSQL-Kommandos strukturell blind. Der Vorgaengerstand verbot nur
 * Transaktions- und Sitzungskommandos; ihm fehlten belegt: `do` (beliebiges
 * PL/pgSQL, damit `perform set_config(...)`), `explain (analyze)` (fuehrt die
 * Abfrage aus), `create temp table ... as select ...`, `copy (...) to stdout`,
 * `declare ... cursor with hold`, `fetch`, `move`, `close`, `execute`,
 * `deallocate`, `alter role ... set`, `call`, `values`, `table`, `lock`,
 * `truncate`, `grant`, `revoke`, `drop` und `security label`. Eine Allow-Liste
 * weist all das und jedes kuenftige Kommando ohne Pflege ab.
 *
 * Nachweis, dass diese fuenf genuegen: saemtliche Aufrufstellen der Fassade
 * beginnen mit einem dieser fuenf Woerter - `select`, `insert`, `update`,
 * `delete` sowie genau ein `with` (in ../auth-service.ts, `validateSession`).
 * `values` und `table` sind fachlich nicht in Gebrauch und bleiben deshalb
 * ausdruecklich draussen.
 */
const ALLOWED_LEADING_KEYWORDS = [
  "select",
  "insert",
  "update",
  "delete",
  "with",
] as const;

/**
 * Bezeichner, die an JEDER Position verboten sind.
 *
 * Angewandt wird die Liste ausschliesslich auf Wort-Token und auf entquotete
 * begrenzte Bezeichner - NIEMALS auf Zeichenketteninhalte oder Kommentartext.
 * Sonst muesste die Schranke fachlich gueltige Abfragen abweisen, in denen
 * eines dieser Woerter nur als Datenwert vorkommt.
 *
 * GRENZE DIESER LISTE - ausdruecklich benannt, damit niemand mehr aus ihr
 * liest, als sie leistet: sie sperrt NAMEN, nicht WIRKUNGEN. Sobald fremder
 * Text in einen Anweisungstext gelangt, ist dieselbe Wirkung ueber einen nicht
 * gelisteten Namen erreichbar - `query_to_xml` und Verwandte fuehren ihr
 * Textargument aus, ohne dass das Wort `set_config` je als Token erscheint.
 * Diese Familie ist deshalb unten mit aufgenommen, aber die Aufzaehlung bleibt
 * offen. Die einzige strukturell vollstaendige Zusage ist die Allow-Liste der
 * fuehrenden Kommandos; alles hier ist Tiefenschutz gegen einen kuenftigen
 * Injektionsfehler und ersetzt die Parametrisierung nicht.
 */
const FORBIDDEN_IDENTIFIERS = [
  // Setzt jede GUC, also auch "app.user_id" - der Kern der Umgehung.
  "set_config",
  // Die Katalogsicht ist ueber eine Regel aktualisierbar und wirkt wie SET,
  // also SITZUNGSWEIT: ueber die Transaktion und damit ueber die
  // Poolverbindung hinaus. Von der Allow-Liste nicht erfasst, weil `update`
  // fachlich noetig ist.
  "pg_settings",
  // Sitzungsweite Sperren ueberleben die Transaktion; ein gehaltener Lock auf
  // demselben Schluessel laesst den `pg_advisory_xact_lock`-Aufruf im
  // Schutztrigger (Migration 0017, SQLSTATE KB002) in das statement_timeout
  // laufen. Die `_xact_`-Formen sind ABSICHTLICH nicht gelistet: sie enden mit
  // der Transaktion und sind genau der Weg, den der Schutztrigger selbst geht.
  "pg_advisory_lock",
  "pg_advisory_lock_shared",
  "pg_try_advisory_lock",
  "pg_try_advisory_lock_shared",
  "pg_advisory_unlock",
  "pg_advisory_unlock_shared",
  "pg_advisory_unlock_all",
  // Abbruch bzw. Unterbrechung fremder Sitzungen derselben Rolle - alle
  // Anwendungssitzungen laufen unter derselben Anmelderolle.
  "pg_terminate_backend",
  "pg_cancel_backend",
  // Heute Superusern vorbehalten, hier als Tiefenschutz.
  "pg_reload_conf",
  // Fuehren ihr Textargument ueber SPI aus. Damit waere die Wirkung von
  // `set_config` ohne das Token `set_config` erreichbar.
  "query_to_xml",
  "query_to_xmlschema",
  "query_to_xml_and_xmlschema",
  // Heute ist keine dblink-Extension vorhanden; die Schranke soll einen
  // kuenftigen Aufruf nicht erst zulassen.
  "dblink",
  "dblink_exec",
  "dblink_connect",
  "dblink_connect_u",
  "dblink_open",
  "dblink_send_query",
  "dblink_fetch",
] as const;

// AUSDRUECKLICH NICHT in FORBIDDEN_IDENTIFIERS, weil ein positionsunabhaengiges
// Verbot dieser Woerter den Fachbetrieb brechen wuerde:
//   `set`     - steht in JEDEM `update ... set ...`
//   `values`  - steht in JEDEM `insert ... values (...)`
//   `end`     - steht in `case ... end` (z. B. Fehlversuchszaehlung in
//               ../auth-service.ts)
//   `release`, `start`, `prepare`, `role` - unauffaellige Namensbestandteile
//               bzw. Schluesselwoerter, die als FUEHRENDES Wort ohnehin schon
//               an der Allow-Liste scheitern.

/**
 * Wohlgeformte Zahl - bewusst grob und ausdruecklich KEIN Zahlenparser.
 *
 * Beurteilt wird ausschliesslich der Zug, der ab einer Ziffer bis zum naechsten
 * Zeichen laeuft, das nicht zu einem Bezeichner gehoert. Der Dezimalpunkt
 * beendet den Zug; `1.5` besteht deshalb aus den Zuegen `1` und `5`. Der
 * Exponent darf mit `e` enden, weil bei `1e-3` das Minus den Zug beendet und
 * Vorzeichen und Ziffern erst danach folgen. Erfasst sind die Formen, die
 * PostgreSQL 18 kennt: Dezimal mit Unterstrichen, Exponent sowie 0x/0o/0b.
 */
const WELL_FORMED_NUMBER = /^(?:[0-9][0-9_]*(?:e[+-]?[0-9_]*)?|0[xob][0-9a-f_]+)$/;

/** Sentinel: das Konstrukt beginnt hier, endet aber nicht mehr. */
const UNTERMINATED = -1;

const UNTERMINATED_STRING =
  "Unlesbare SQL-Anweisung im Transaktions-Wrapper: unbeendete Zeichenkette.";
const UNTERMINATED_BLOCK_COMMENT =
  "Unlesbare SQL-Anweisung im Transaktions-Wrapper: unbeendeter Blockkommentar.";
const UNTERMINATED_IDENTIFIER =
  "Unlesbare SQL-Anweisung im Transaktions-Wrapper: unbeendeter begrenzter Bezeichner.";
const NUMERIC_LITERAL_JUNK =
  "Unlesbare SQL-Anweisung im Transaktions-Wrapper: Zahlenliteral mit " +
  "angehaengtem Text.";
const DOLLAR_QUOTE =
  "Dollar-Quotes ($$...$$) sind im Transaktions-Wrapper nicht erlaubt.";
const UNICODE_IDENTIFIER =
  'Begrenzte Bezeichner mit Unicode-Escapes (U&"...") sind im ' +
  "Transaktions-Wrapper nicht erlaubt.";

/** Ein Wort-Token bzw. ein entquoteter begrenzter Bezeichner, kleingeschrieben. */
type StatementToken = {
  readonly kind: "word" | "identifier";
  readonly value: string;
};

/** Ergebnis EINES lexikalischen Durchlaufs. */
type StatementScan = {
  /** Bezeichnerartige Token in Reihenfolge; ohne Literale und Kommentare. */
  readonly tokens: readonly StatementToken[];
  /** True, wenn nach einem Semikolon noch Anweisungsinhalt folgt. */
  readonly multipleStatements: boolean;
  /** Grund, wenn die Anweisung strukturell nicht lesbar ist. */
  readonly structuralViolation: string | null;
};

/**
 * Leerraum - ausdruecklich NUR die sechs ASCII-Zeichen.
 *
 * `/\s/` waere hier falsch: es erfasst auch U+00A0, U+2028 und U+3000, die in
 * PostgreSQL Bezeichnerzeichen sind (ident_start ist `[A-Za-z\200-\377_]`).
 * Derselbe Codepunkt haette dann im Hauptdurchlauf als Trenner und im Wortscan
 * als Bezeichnerbestandteil gegolten - ein Widerspruch, aus dem sich zwar kein
 * Umgehungspfad ergab, der aber jede kuenftige Aenderung schwer beurteilbar
 * macht. Mit dieser Klasse sind beide Mengen disjunkt und deckungsgleich mit
 * dem Lexer des Servers.
 */
function isWhitespace(character: string): boolean {
  return character === " " ||
    character === "\t" ||
    character === "\n" ||
    character === "\r" ||
    character === "\f" ||
    character === "\v";
}

function isIdentifierStart(character: string): boolean {
  // Nicht-ASCII gehoert in PostgreSQL zu einem unquotierten Bezeichner.
  return /[A-Za-z_]/.test(character) || character.charCodeAt(0) > 127;
}

function isIdentifierPart(character: string): boolean {
  return /[A-Za-z0-9_$]/.test(character) || character.charCodeAt(0) > 127;
}

function isDigit(character: string): boolean {
  return character >= "0" && character <= "9";
}

/**
 * Bestandteil eines mit einer Ziffer beginnenden Zuges.
 *
 * Wie `isIdentifierPart`, aber OHNE `$`: sonst verschluckte `select 1$$a;b$$`
 * den Beginn eines Dollar-Quotes, den der eigene Zweig abweisen soll. Alles
 * andere (Buchstaben, Ziffern, Unterstrich, Nicht-ASCII) gehoert zum Zug, damit
 * genau die Verklebung sichtbar wird, um die es hier geht.
 */
function isNumericRunPart(character: string): boolean {
  return isIdentifierPart(character) && character !== "$";
}

/**
 * Ende eines Zeilenkommentars.
 *
 * Der Kommentar endet am naechsten `\n` ODER `\r`; PostgreSQLs Lexer liest
 * `--[^\n\r]*`. Wurde ausschliesslich `\n` gesucht, verschluckte
 * `select 1 --x\r;select set_config(...)` (echtes CR ohne LF) den Rest als
 * Kommentar, waehrend der Server ZWEI Anweisungen sieht.
 */
function afterLineComment(text: string, index: number): number {
  let cursor = index + 2;
  while (cursor < text.length) {
    const character = text[cursor];
    // Das Zeilenende selbst ist Leerraum und wird vom Aufrufer uebersprungen.
    if (character === "\n" || character === "\r") return cursor;
    cursor += 1;
  }
  return text.length;
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
  return UNTERMINATED;
}

/**
 * Ende einer in Anfuehrungszeichen eingeschlossenen Zeichenkette bzw. eines
 * begrenzten Bezeichners. Ein verdoppeltes Anfuehrungszeichen beendet nicht.
 * `allowBackslash` gilt ausschliesslich fuer Escape-Zeichenketten (`E'...'`).
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
  return UNTERMINATED;
}

/**
 * Beginn eines Dollar-Quotes; `$1` ist ein Parameter und kein Quote.
 *
 * `$1`, `$2`, ... passen NICHT: nach dem `$` steht dort eine Ziffer, das Muster
 * verlangt aber entweder sofort ein zweites `$` oder einen Bezeichner-Tag.
 */
const DOLLAR_QUOTE_TAG = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/;

/**
 * EIN lexikalischer Durchlauf fuer alle Regeln.
 *
 * Kein Substring-Check, kein `includes` auf dem Rohtext, keine Regex ueber die
 * ganze Anweisung: nur so ist unterscheidbar, ob ein Wort ein aufrufbarer Name
 * oder blosser Inhalt eines Literals bzw. Kommentars ist.
 *
 * Bei einer strukturellen Verletzung bricht der Durchlauf ab. Die bis dahin
 * gelesenen Token bleiben erhalten - `leadingKeyword` braucht sie, und die
 * Reihenfolge der Ablehnungsgruende meldet das fuehrende Wort zuerst.
 */
function scanStatement(statement: string): StatementScan {
  const tokens: StatementToken[] = [];
  let multipleStatements = false;
  let structuralViolation: string | null = null;
  let separatorSeen = false;
  let cursor = 0;

  while (cursor < statement.length) {
    const character = statement[cursor];

    // 1. Leerraum
    if (isWhitespace(character)) {
      cursor += 1;
      continue;
    }

    // 2. Zeilenkommentar
    if (statement.startsWith("--", cursor)) {
      cursor = afterLineComment(statement, cursor);
      continue;
    }

    // 3. Blockkommentar
    if (statement.startsWith("/*", cursor)) {
      const end = afterBlockComment(statement, cursor);
      if (end === UNTERMINATED) {
        structuralViolation = UNTERMINATED_BLOCK_COMMENT;
        break;
      }
      cursor = end;
      continue;
    }

    // 11. Semikolon: ein abschliessendes ist zulaessig; folgt danach echter
    //     Anweisungsinhalt, sind es mehrere Anweisungen.
    if (character === ";") {
      separatorSeen = true;
      cursor += 1;
      continue;
    }

    // Ab hier beginnt echter Anweisungsinhalt.
    if (separatorSeen) {
      multipleStatements = true;
      separatorSeen = false;
    }

    // 4. Zeichenkette. Ein Praefix (E, B, X, N) ist im Wort-Zweig behandelt;
    //    hier gilt kein Backslash-Escape (standard_conforming_strings).
    if (character === "'") {
      const end = afterQuoted(statement, cursor, "'", false);
      if (end === UNTERMINATED) {
        structuralViolation = UNTERMINATED_STRING;
        break;
      }
      cursor = end;
      continue;
    }

    // 8. Begrenzter Bezeichner: NICHT einfach ueberspringen. `""` wird zu `"`
    //    aufgeloest und der entquotete Inhalt geprueft - sonst blieben
    //    `select "set_config"(...)` und `select pg_catalog."set_config"(...)`
    //    offen.
    if (character === '"') {
      const end = afterQuoted(statement, cursor, '"', false);
      if (end === UNTERMINATED) {
        structuralViolation = UNTERMINATED_IDENTIFIER;
        break;
      }
      const raw = statement.slice(cursor + 1, end - 1).replace(/""/g, '"');
      tokens.push({ kind: "identifier", value: raw.toLowerCase() });
      cursor = end;
      continue;
    }

    // 5.-7. Wort-Token, Literalpraefix und die U&"..."-Form.
    if (isIdentifierStart(character)) {
      let end = cursor + 1;
      while (end < statement.length && isIdentifierPart(statement[end])) {
        end += 1;
      }
      const word = statement.slice(cursor, end).toLowerCase();

      // 6. U&"..." ist ein Bezeichner mit Unicode-Escapes und damit ein
      //    Abweisungsgrund: `select U&"\0073et_config"(...)` enthaelt die
      //    Zeichenfolge `set_config` nicht und wuerde jede Namenspruefung
      //    unterlaufen. Es gibt keine fachliche Verwendung.
      //
      //    U&'...' braucht KEINEN eigenen Zweig: es ist eine Zeichenkette und
      //    kann keinen Code einschleusen. Ohne Sonderbehandlung entsteht das
      //    Token `u`, das `&` faellt in den Restzweig und die Zeichenkette wird
      //    unten wie jede andere uebersprungen - identisches Ergebnis.
      if (word === "u" && statement[end] === "&" && statement[end + 1] === '"') {
        structuralViolation = UNICODE_IDENTIFIER;
        break;
      }

      // 5. Praefixiertes Literal. Nur `E'...'`: allein diese Form kennt
      //    Backslash-Escapes und kann deshalb ein anderes Ende haben als eine
      //    gewoehnliche Zeichenkette; sie ist im Fachcode in Gebrauch
      //    (`escape E'\\'` in ../incidents.ts). `B`, `X` und `N` brauchen
      //    KEINEN eigenen Zweig: ohne ihn entsteht ein zusaetzliches Wort-Token
      //    `b`/`x`/`n` - keines steht auf der Verbotsliste - und danach dieselbe
      //    uebersprungene Zeichenkette; das Ergebnis ist identisch. Ein
      //    laengeres Wort vor dem Anfuehrungszeichen ist in PostgreSQL ein
      //    eigener Bezeichner und wird deshalb unten als Token GEPRUEFT (sonst
      //    waere `select set_config'x'(...)` ein Freibrief).
      if (statement[end] === "'" && word === "e") {
        const end2 = afterQuoted(statement, end, "'", true);
        if (end2 === UNTERMINATED) {
          structuralViolation = UNTERMINATED_STRING;
          break;
        }
        cursor = end2;
        continue;
      }

      tokens.push({ kind: "word", value: word });
      cursor = end;
      continue;
    }

    // 10. Zahlenliteral: der gesamte Zug wird in EINEM Schritt uebersprungen
    //     und erzeugt KEIN Token.
    //
    //     BELEGTE LAXHEIT DES VORGAENGERSTANDS: der Scanner kannte keine
    //     Tokenklasse fuer Zahlen. Jede Ziffer fiel einzeln in den Restzweig,
    //     und das Wort-Token begann erst am ersten BUCHSTABEN. Enthielt ein
    //     Zahlenliteral einen Buchstaben, verklebte dessen Rest mit einem
    //     unmittelbar folgenden Bezeichner zu EINEM Token und maskierte damit
    //     einen verbotenen Namen:
    //       `select 1 where 1e0set_config('app.user_id','...',true) is not null`
    //     ergab die Token `select`, `where`, `e0set_config`, `is`, `not`,
    //     `null` - `set_config` erschien nirgends und die Anweisung passierte.
    //
    //     Ist der Zug KEINE wohlgeformte Zahl, ist er ein Abweisungsgrund und
    //     kein stilles Ueberspringen: die Schranke darf ihr Urteil nicht auf
    //     einen Text stuetzen, den sie nicht als das lesen kann, was er zu sein
    //     vorgibt (dieselbe fail-closed-Regel wie bei unbeendeten Konstrukten).
    //     TIEFENSCHUTZ, nicht Ersatz: PostgreSQL weist solche Texte ab Fassung
    //     16 ohnehin mit "trailing junk after numeric literal" ab. Die Regel
    //     sorgt dafuer, dass die Schranke nicht LAXER urteilt als der Server -
    //     sie ist deshalb bewusst klein und kein Zahlenparser.
    if (isDigit(character)) {
      let end = cursor + 1;
      while (end < statement.length && isNumericRunPart(statement[end])) {
        end += 1;
      }
      if (!WELL_FORMED_NUMBER.test(statement.slice(cursor, end).toLowerCase())) {
        structuralViolation = NUMERIC_LITERAL_JUNK;
        break;
      }
      cursor = end;
      continue;
    }

    // 9. Dollar-Quote: ABGEWIESEN, nicht uebersprungen.
    //
    //    Der Vorgaengerstand las Dollar-Quotes exakt wie PostgreSQL, um sie zu
    //    ERLAUBEN - inklusive einer Sonderregel dafuer, dass in
    //    `select 1 as a$b$; select set_config(...)` das `a$b$` ein Bezeichner
    //    und kein Quote-Beginn ist. Dieser Aufwand war unbelegt: kein einziger
    //    Anweisungstext des Fachcodes enthaelt ein Dollar-Quote (die Form
    //    `$${n}` in ../incidents.ts, ../incident-actions.ts und
    //    ../task-actions.ts ist eine Template-Zeichenkette von TypeScript und
    //    erzeugt den Parameter `$5`, kein `$$`). Eine Abweisung ist deshalb
    //    strikt STRENGER als das getreue Nachbilden und kommt ohne die
    //    Sonderregel aus: `$1`, `$2` passen nicht auf das Tag-Muster und
    //    bleiben unberuehrt.
    if (character === "$" && DOLLAR_QUOTE_TAG.test(statement.slice(cursor))) {
      structuralViolation = DOLLAR_QUOTE;
      break;
    }

    cursor += 1;
  }

  return { tokens, multipleStatements, structuralViolation };
}

/**
 * Das fuehrende Kommando in Kleinschreibung, oder "" wenn keines lesbar ist.
 *
 * Leerraum sowie Zeilen- und Blockkommentare davor werden uebersprungen, damit
 * die Pruefung nicht durch ein vorangestelltes `-- Kommentar` umgangen wird.
 * Beginnt die Anweisung mit einem begrenzten Bezeichner, einer Zahl oder einem
 * Literal, ist das Ergebnis "" - das ist kein Kommando.
 */
export function leadingKeyword(statement: string): string {
  const first = scanStatement(statement).tokens[0];
  return first !== undefined && first.kind === "word" ? first.value : "";
}

/**
 * True, wenn die Zeichenkette mehr als eine Anweisung enthaelt.
 *
 * Ohne diese Pruefung genuegte die Kommandopruefung nicht: bei
 * `select 1; set app.user_id = '...'` wird nur `select` gelesen. Ein
 * abschliessendes Semikolon ohne folgenden Inhalt ist zulaessig.
 *
 * Zeichenketten, begrenzte Bezeichner sowie Zeilen- und Blockkommentare werden
 * uebersprungen, damit ein Semikolon INNERHALB eines Literals nicht
 * faelschlich als Trennzeichen gilt. Ein Dollar-Quote wird stattdessen
 * abgewiesen; die Frage nach einem Semikolon darin stellt sich nicht.
 *
 * Grenze dieser Auskunft: bei einem strukturell unlesbaren Text (unbeendetes
 * Literal oder Kommentar) bricht der Durchlauf ab, das Ergebnis ist dann keine
 * verlaessliche Aussage. Deshalb weist `rejectionReason` die strukturelle
 * Verletzung VOR der Mehrfachanweisung ab.
 */
export function hasMultipleStatements(statement: string): boolean {
  return scanStatement(statement).multipleStatements;
}

/**
 * Grund der Ablehnung, oder NULL wenn die Anweisung zulaessig ist.
 *
 * Die Meldung nennt ausschliesslich das beanstandete Wort bzw. die verletzte
 * Regel - niemals die vollstaendige Anweisung und niemals einen Wert.
 *
 * Die Reihenfolge ist verbindlich, damit die Meldung stabil bleibt und immer
 * den konkretesten Grund nennt:
 *   1. leere oder unlesbare Anweisung,
 *   2. fuehrendes Kommando nicht in der Allow-Liste,
 *   3. strukturelle Verletzung,
 *   4. mehrere Anweisungen,
 *   5. verbotener Bezeichner.
 */
function rejectionReason(statement: string): string | null {
  const scan = scanStatement(statement);
  const first = scan.tokens[0];
  const keyword = first !== undefined && first.kind === "word" ? first.value : "";

  if (keyword === "") {
    return "Leere oder unlesbare SQL-Anweisung im Transaktions-Wrapper.";
  }
  if (!(ALLOWED_LEADING_KEYWORDS as readonly string[]).includes(keyword)) {
    return (
      `Anweisung "${keyword}" ist im Transaktions-Wrapper nicht erlaubt. ` +
      "Transaktions- und Sitzungssteuerung liegt ausschliesslich beim Wrapper."
    );
  }
  if (scan.structuralViolation !== null) {
    return scan.structuralViolation;
  }
  if (scan.multipleStatements) {
    return (
      "Mehrere Anweisungen in einem Aufruf sind im Transaktions-Wrapper nicht " +
      "erlaubt. Je Aufruf genau eine parametrisierte Anweisung."
    );
  }
  for (const token of scan.tokens) {
    // Der Vergleich ignoriert Gross-/Kleinschreibung auch bei begrenzten
    // Bezeichnern. PostgreSQL waere dort genau, die Schranke ist bewusst
    // strenger: `"Set_Config"` soll gar nicht erst durchgehen.
    if ((FORBIDDEN_IDENTIFIERS as readonly string[]).includes(token.value)) {
      return (
        `Bezeichner "${token.value}" ist im Transaktions-Wrapper nicht erlaubt. ` +
        "Sitzungs- und Verbindungssteuerung liegt ausschliesslich beim Wrapper."
      );
    }
  }
  return null;
}

/** True, wenn die Anweisung im Wrapper ausgefuehrt werden darf. */
export function isAllowedStatement(statement: string): boolean {
  return rejectionReason(statement) === null;
}

/**
 * Bricht mit klarer Meldung ab, wenn die Anweisung die Transaktions- oder
 * Sitzungsumgebung veraendern wuerde, strukturell nicht lesbar ist, mehrere
 * Anweisungen enthaelt oder einen verbotenen Bezeichner nennt.
 */
export function assertAllowedStatement(statement: string): void {
  const reason = rejectionReason(statement);
  if (reason === null) return;
  throw new Error(reason);
}
