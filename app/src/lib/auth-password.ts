// AP14/B: Argon2id-Passwortverfahren gemaess ADR-011 / 2.3.
//
// Bewusst ohne "server-only": das Modul haelt ausschliesslich Kryptografie und
// bleibt damit isoliert testbar (app/test/ap14b-auth.test.mjs). Es wird
// serverseitig ausschliesslich von auth-service.ts verwendet.
//
// Kein Pepper: ADR-011 sieht kein zusaetzliches Geheimnis im Hash vor. Ein
// Pepper waere nur mit einem dokumentierten Schluesselwechselverfahren
// vertretbar; das ist eine gesonderte Entscheidung und wird hier nicht
// vorweggenommen.

import { randomBytes } from "node:crypto";
import { hash as argon2Hash, verify as argon2Verify, type Options } from "@node-rs/argon2";

/**
 * Algorithmuskennung aus `@node-rs/argon2` (Algorithm.Argon2id === 2).
 *
 * Der Wert wird nicht als `const enum` importiert: bei `isolatedModules` darf
 * auf einen ambienten `const enum` nicht zugegriffen werden.
 */
const ARGON2ID = 2 as NonNullable<Options["algorithm"]>;

/**
 * Parametersatz nach aktueller OWASP-Empfehlung fuer Argon2id
 * (mindestens 19 MiB Speicher, 2 Durchlaeufe, 1 Grad Parallelitaet).
 *
 * Zentral konfiguriert und ueber PASSWORD_HASH_VERSION versionierbar: wird der
 * Satz spaeter verschaerft, erkennt die Anmeldung die aeltere Version und
 * erneuert den Hash beim naechsten erfolgreichen Login.
 */
export const ARGON2_OPTIONS: Options = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

/**
 * Fachliche Version des Parametersatzes. Entspricht der Spalte
 * `public.auth_accounts.password_hash_version` (Migration `0012`, Default 1).
 * Bei jeder Aenderung von ARGON2_OPTIONS um eins erhoehen.
 */
export const PASSWORD_HASH_VERSION = 1;

/** Praefix eines gueltigen, kodierten Argon2id-Hashes. */
const ARGON2ID_PREFIX = "$argon2id$";

// ---------------------------------------------------------------------------
// Zentrale Passwortregeln (ADR-011 / 5, offener Punkt 5)
//
// Sie stehen hier und nicht in einem der Aufrufer, weil sie fuer JEDEN Weg
// gelten muessen, auf dem ein Passwort entsteht: das Bootstrap des ersten
// Administrators (`scripts/bootstrap-admin.mjs`) und der Passwortwechsel des
// angemeldeten Benutzers. Zwei Regelsaetze wuerden zwangslaeufig auseinander
// laufen.
//
// Die Meldungstexte kommen bewusst ebenfalls von hier und enthalten bewusst
// KEINE Umlaute: derselbe Text erscheint im Browser und auf der Windows-Konsole
// des Betreiberwerkzeugs, und dort ist die Codepage nicht verlaesslich UTF-8.
// ---------------------------------------------------------------------------

/** Mindestlaenge eines Passworts. */
export const MIN_PASSWORD_LENGTH = 12;

/** Obergrenze gegen unnoetigen Argon2-Aufwand bei einer Fehleingabe. */
export const MAX_PASSWORD_LENGTH = 1024;

/** Verletzte Regel; die Reihenfolge der Pruefung ist festgelegt. */
export type PasswordRuleViolation = "too_short" | "too_long" | "blank";

/**
 * Prueft die zentralen Passwortregeln.
 *
 * Rueckgabe `null` bedeutet "zulaessig". Die Funktion ist rein und beruehrt
 * weder Datenbank noch Protokoll - das Passwort verlaesst sie nicht.
 */
export function checkPasswordRules(password: string): PasswordRuleViolation | null {
  if (password.length < MIN_PASSWORD_LENGTH) return "too_short";
  if (password.length > MAX_PASSWORD_LENGTH) return "too_long";
  if (password.trim() === "") return "blank";
  return null;
}

/** Benutzernahe Meldung zu einer verletzten Regel. Nennt nie den Eingabewert. */
export function passwordRuleMessage(violation: PasswordRuleViolation): string {
  switch (violation) {
    case "too_short":
      return `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`;
    case "too_long":
      return `Das Passwort darf maximal ${MAX_PASSWORD_LENGTH} Zeichen lang sein.`;
    case "blank":
      return "Das Passwort darf nicht nur aus Leerzeichen bestehen.";
  }
}

/**
 * Platzhalter fuer Konten, die aus der endlichen Kompatibilitaetsschicht
 * uebernommen wurden (Migration `0012`). Absichtlich kein gueltiger Hash: das
 * Konto kann sich erst nach einem administrativen Passwort-Reset anmelden.
 */
export const MIGRATED_PASSWORD_MARKER = "!MIGRATED-ACCOUNT-REQUIRES-RESET!";

/** True, wenn der gespeicherte Wert ueberhaupt pruefbar ist. */
export function isVerifiableHash(storedHash: string): boolean {
  return storedHash !== MIGRATED_PASSWORD_MARKER && storedHash.startsWith(ARGON2ID_PREFIX);
}

export async function hashPassword(password: string): Promise<string> {
  return argon2Hash(password, ARGON2_OPTIONS);
}

/**
 * Prueft ein Passwort gegen einen kodierten Argon2-Hash.
 *
 * Die Parameter stehen im Hash selbst; aeltere Parametersaetze bleiben deshalb
 * pruefbar. Ein Fehler (unlesbarer Hash) gilt als "nicht gueltig" und wird
 * nicht nach aussen gemeldet.
 */
export async function verifyPassword(
  storedHash: string,
  password: string,
): Promise<boolean> {
  if (!isVerifiableHash(storedHash)) return false;
  try {
    return await argon2Verify(storedHash, password);
  } catch {
    return false;
  }
}

/**
 * Wird der Hash mit einem veralteten Parametersatz gebildet, soll er beim
 * naechsten erfolgreichen Login erneuert werden.
 */
export function needsRehash(storedHashVersion: number): boolean {
  return storedHashVersion < PASSWORD_HASH_VERSION;
}

let dummyHash: Promise<string> | null = null;

function getDummyHash(): Promise<string> {
  // Einmalig erzeugt, aus einem Zufallswert. Kein Geheimnis, kein fester Wert
  // im Quelltext, kein zusaetzlicher Angriffspunkt.
  dummyHash ??= argon2Hash(randomBytes(32).toString("hex"), ARGON2_OPTIONS);
  return dummyHash;
}

/**
 * Verbraucht denselben Rechenaufwand wie eine echte Passwortpruefung.
 *
 * Notwendig gegen Benutzeraufzaehlung: ohne diesen Schritt antwortet die
 * Anmeldung fuer eine unbekannte E-Mail-Adresse messbar schneller als fuer eine
 * bekannte, weil kein Argon2-Lauf stattfindet.
 */
export async function equalizeVerifyCost(password: string): Promise<void> {
  try {
    await argon2Verify(await getDummyHash(), password);
  } catch {
    // Ergebnis und Fehler sind ohne Bedeutung; es zaehlt nur der Aufwand.
  }
}
