import "server-only";

// AP14/B: fachliche Auswertung von PostgreSQL-Fehlern (ADR-011 / 2.5).
//
// Verbindliche Regel dieses Moduls:
//   Eine Datenbankmeldung gelangt NIEMALS in eine HTTP-Antwort oder in das
//   Ergebnis einer Server Action. `error.message`, `error.detail` und
//   `error.hint` bleiben serverseitig; sie nennen Tabellen-, Spalten- und
//   Constraint-Namen, Teile von Abfragen und im Zweifel auch Werte. Aufrufer
//   bilden ausschliesslich den SQLSTATE auf eine EIGENE fachliche Meldung ab.
//   Dieses Modul gibt deshalb bewusst nur den Code heraus und keinen Text.
//
// Das Modul ist absichtlich abhaengigkeitsfrei: es erzwingt keine `pg`-Typen und
// bleibt damit auch in Tests ohne Datenbank ladbar. Der Fehlerwert wird als
// `unknown` angenommen und defensiv verengt - eine `catch`-Bindung ist in
// TypeScript `unknown`, und ein Fehler kann aus jeder Schicht stammen.

/**
 * SQLSTATEs, die die Fachfunktionen aus 0010/0011 erwartbar werfen bzw. die
 * unter Last auftreten. Benannt, damit an der Aufrufstelle kein nackter
 * Zahlenstring steht.
 */
/** Verletzung einer Eindeutigkeit (unique_violation). */
export const PG_UNIQUE_VIOLATION = "23505";
/** Verletzung eines Fremdschluessels (foreign_key_violation). */
export const PG_FOREIGN_KEY_VIOLATION = "23503";
/** Verletzung einer Check-Bedingung (check_violation). */
export const PG_CHECK_VIOLATION = "23514";
/** Fehlendes Recht bzw. Ablehnung durch Guard oder RLS (insufficient_privilege). */
export const PG_INSUFFICIENT_PRIVILEGE = "42501";
/** Unbrauchbarer Parameterwert (invalid_parameter_value). */
export const PG_INVALID_PARAMETER_VALUE = "22023";
/** Pflichtwert fehlt (null_value_not_allowed). */
export const PG_NULL_VALUE_NOT_ALLOWED = "22004";
/** Serialisierungskonflikt, der Aufruf ist wiederholbar (serialization_failure). */
export const PG_SERIALIZATION_FAILURE = "40001";
/** Sperre nicht verfuegbar (lock_not_available). */
export const PG_LOCK_NOT_AVAILABLE = "55P03";
/** Abbruch durch statement_timeout oder Abbruchanforderung (query_canceled). */
export const PG_QUERY_CANCELED = "57014";

/**
 * Der SQLSTATE eines Fehlerwerts, oder NULL wenn keiner lesbar ist.
 *
 * Bewusst ohne `any` und ohne Typzusicherung: der Wert wird verengt, damit ein
 * Fehler aus einer anderen Schicht (etwa ein einfaches `Error`, ein
 * abgewiesener Fetch oder ein geworfener String) hier nicht zu einem
 * Laufzeitfehler in der Fehlerbehandlung fuehrt.
 */
export function pgErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  // `in` verengt den Typ; deshalb ist hier keine Typzusicherung noetig.
  if (!("code" in error)) return null;
  const code: unknown = error.code;
  return typeof code === "string" && code !== "" ? code : null;
}

/** True, wenn der Fehler genau den erwarteten SQLSTATE traegt. */
export function isPgError(error: unknown, code: string): boolean {
  return pgErrorCode(error) === code;
}
