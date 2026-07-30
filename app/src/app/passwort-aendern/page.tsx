import { redirect } from "next/navigation";

import { getSessionProfileForPasswordChange } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-password";
import { PasswordChangeForm } from "./PasswordChangeForm";

// AP14/B: Passwortwechselpfad (ADR-011 / 2.3).
//
// Bewusst AUSSERHALB der Routengruppe `(app)`: deren Layout ruft
// `requireSession()`, und das leitet ein Konto mit Wechselzwang genau hierher um.
// Innerhalb der Gruppe entstuende eine Umleitungsschleife.
//
// Der Zugriffsschutz liegt hier in der Server-Komponente und nicht im Proxy: die
// Seite ist ohne gueltige Sitzung nicht benutzbar, unabhaengig davon, ob der
// Proxy laeuft.
export const dynamic = "force-dynamic";

export default async function PasswordChangePage() {
  const session = await getSessionProfileForPasswordChange();
  if (!session) redirect("/login");

  return (
    <PasswordChangeForm
      email={session.email}
      forced={session.mustChangePassword}
      minLength={MIN_PASSWORD_LENGTH}
    />
  );
}
