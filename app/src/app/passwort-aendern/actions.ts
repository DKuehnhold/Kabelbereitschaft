"use server";

import { redirect } from "next/navigation";

import { signOut } from "@/auth";
import { getSessionProfileForPasswordChange } from "@/lib/auth";
import { checkPasswordRules, passwordRuleMessage } from "@/lib/auth-password";
import { changeOwnPassword } from "@/lib/auth-service";
import { isPlatformConfigured } from "@/lib/platform-config";

// AP14/B: Passwortwechsel des angemeldeten Benutzers (ADR-011 / 2.3).
//
// Die Server Action ist selbst serverseitig abgesichert und verlaesst sich nicht
// darauf, dass die Seite den Zugriff schon geprueft hat: sie ist ein eigener
// Einstiegspunkt und muss eigenstaendig fail-closed sein.
//
// Kein Klartext verlaesst diese Datei: die drei Eingaben werden ausschliesslich
// an `changeOwnPassword()` uebergeben, nie protokolliert, nie in eine Meldung
// eingesetzt und nie in den Zustand des Formulars zurueckgeschrieben.

export type PasswordChangeState = { error: string | null };

/**
 * Eine gemeinsame Meldung fuer jeden abgewiesenen Wechsel.
 *
 * Zusammengefasst sind: falsches aktuelles Passwort, deaktiviertes Konto,
 * inaktives Profil. Unterschiedliche Texte waeren eine Aussage ueber den
 * Kontozustand.
 */
const REJECTED = "Passwortwechsel nicht möglich. Bitte das aktuelle Passwort prüfen.";

/** Technischer Fehlschlag (z. B. Datenbank nicht erreichbar): fail-closed. */
const UNAVAILABLE =
  "Passwortwechsel derzeit nicht möglich. Bitte später erneut versuchen.";

export async function changePassword(
  _prev: PasswordChangeState,
  formData: FormData,
): Promise<PasswordChangeState> {
  if (!isPlatformConfigured()) {
    return {
      error:
        "Die Anwendung ist noch nicht vollständig konfiguriert. " +
        "Passwortwechsel erst nach Eintrag der Laufzeitvariablen möglich.",
    };
  }

  const session = await getSessionProfileForPasswordChange();
  if (!session) redirect("/login");

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "Bitte alle drei Felder ausfüllen." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Das neue Passwort und die Bestätigung stimmen nicht überein." };
  }
  const violation = checkPasswordRules(newPassword);
  if (violation !== null) {
    return { error: passwordRuleMessage(violation) };
  }

  // Ausdruecklich getrennt vom Erfolgsweg: `redirect()` wirkt ueber eine
  // Ausnahme und darf nicht in diesen `catch`-Zweig geraten.
  let outcome;
  try {
    outcome = await changeOwnPassword(session.userId, currentPassword, newPassword);
  } catch (error) {
    // Die Meldung nennt weder Passwort noch Kennung. Der Betrieb erhaelt die
    // technische Ursache im Serverprotokoll.
    console.error(
      "Passwortwechsel fehlgeschlagen",
      error instanceof Error ? error.message : "unbekannter Fehler",
    );
    return { error: UNAVAILABLE };
  }

  if (outcome.kind === "rule") {
    return { error: passwordRuleMessage(outcome.violation) };
  }
  if (outcome.kind === "unchanged") {
    return {
      error: "Das neue Passwort muss sich vom aktuellen Passwort unterscheiden.",
    };
  }
  if (outcome.kind !== "changed") {
    return { error: REJECTED };
  }

  // Alle Sitzungen des Kontos sind serverseitig widerrufen - auch die eigene.
  // Der naechste Request waere ohnehin abgewiesen; das Cookie wird zusaetzlich
  // sofort geloescht, damit der Browser nicht mit einer toten Sitzung
  // weiterarbeitet.
  try {
    await signOut({ redirect: false });
  } catch (error) {
    // Kein Abbruch: der Widerruf ist bereits wirksam, die Sitzung also nicht
    // mehr nutzbar. Der Fehlschlag wird nur protokolliert.
    console.error(
      "Passwortwechsel: Sitzungscookie konnte nicht geloescht werden",
      error instanceof Error ? error.message : "unbekannter Fehler",
    );
  }

  redirect("/login?geaendert=1");
}
