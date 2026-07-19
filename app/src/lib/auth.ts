import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/roles";

export type SessionProfile = {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
};

// Laedt den angemeldeten Benutzer inkl. Profil/Rolle. Pro Request gecached.
export const getSessionProfile = cache(
  async (): Promise<SessionProfile | null> => {
    const supabase = await createClient();
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role, is_active")
        .eq("id", user.id)
        .single();

      if (!profile || !profile.is_active) return null;

      return {
        userId: user.id,
        email: user.email ?? "",
        fullName: profile.full_name ?? user.email ?? "",
        role: profile.role as UserRole,
      };
    } catch {
      return null;
    }
  },
);

export async function requireSession(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  return profile;
}
