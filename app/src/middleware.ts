import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Alles ausser statischen Assets und PWA-Ressourcen (sw.js, Manifest).
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|api/health|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
