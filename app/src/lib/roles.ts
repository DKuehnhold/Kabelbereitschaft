// Rollen und rollenbasierte Navigation.
export type UserRole = "admin" | "disponent" | "monteur";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrator",
  disponent: "Disponent",
  monteur: "Monteur",
};

export type NavItem = {
  href: string;
  label: string;
  roles: UserRole[];
};

// Grundnavigation. Sichtbarkeit je Rolle (durchgesetzt zusaetzlich serverseitig).
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", roles: ["admin", "disponent", "monteur"] },
  { href: "/vorgaenge", label: "Vorgänge", roles: ["admin", "disponent"] },
  { href: "/vorgaenge/neu", label: "Vorgang anlegen", roles: ["admin", "disponent"] },
  { href: "/meine-einsaetze", label: "Meine Einsätze", roles: ["monteur"] },
  { href: "/material", label: "Material", roles: ["admin", "disponent", "monteur"] },
  { href: "/lager", label: "Lagerorte", roles: ["admin"] },
  { href: "/benutzer", label: "Benutzer", roles: ["admin"] },
  { href: "/export", label: "Export", roles: ["admin"] },
];

export function navFor(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function hasRole(role: UserRole, allowed: UserRole[]): boolean {
  return allowed.includes(role);
}
