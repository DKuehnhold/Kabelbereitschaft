import { isPlatformConfigured } from "@/lib/platform-config";
import { LoginForm } from "./LoginForm";

// Der Konfigurationszustand wird zur Laufzeit gelesen, nicht beim Build:
// DATABASE_URL und AUTH_SECRET sind serverseitige Geheimnisse und werden
// niemals in ein Client-Bundle eingesetzt.
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Ein erfolgreicher Passwortwechsel widerruft alle Sitzungen und landet hier.
  // Ohne diesen Hinweis blieben Erfolg und Fehlschlag ununterscheidbar.
  const sp = await searchParams;
  const passwordChanged = sp["geaendert"] === "1";

  return (
    <LoginForm configured={isPlatformConfigured()} passwordChanged={passwordChanged} />
  );
}
