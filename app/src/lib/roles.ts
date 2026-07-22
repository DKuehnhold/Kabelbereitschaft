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
  { href: "/bestand", label: "Bestand", roles: ["admin", "disponent", "monteur"] },
  { href: "/material", label: "Material", roles: ["admin"] },
  { href: "/lager", label: "Lagerorte", roles: ["admin"] },
  { href: "/materialhistorie", label: "Materialhistorie", roles: ["admin", "disponent"] },
  { href: "/benutzer", label: "Benutzer", roles: ["admin"] },
  { href: "/export", label: "Export", roles: ["admin"] },
];

export function navFor(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function hasRole(role: UserRole, allowed: UserRole[]): boolean {
  return allowed.includes(role);
}

// AP9: Gruppierte Navigation (Untermenü). Sichtbarkeit je Rolle; zusätzlich
// serverseitig in jeder Seite durchgesetzt. Desktop und Mobile nutzen dieselbe
// Quelle (navGroupsFor), damit Rechte/Einträge identisch sind.
export type NavGroup = {
  label: string;
  roles: UserRole[];
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Stammdaten",
    roles: ["admin", "disponent"],
    items: [
      { href: "/stammdaten/kunden", label: "Kunden", roles: ["admin", "disponent"] },
      { href: "/stammdaten/bauabschnitte", label: "Bauabschnitte", roles: ["admin", "disponent"] },
      { href: "/stammdaten/vzg", label: "VzG-Strecken", roles: ["admin", "disponent"] },
      { href: "/stammdaten/ansprechpartner", label: "Ansprechpartner", roles: ["admin", "disponent"] },
      { href: "/stammdaten/monteure", label: "Monteure", roles: ["admin", "disponent"] },
      { href: "/stammdaten/teams", label: "Teams", roles: ["admin", "disponent"] },
      { href: "/stammdaten/kabelarten", label: "Kabelarten", roles: ["admin", "disponent"] },
      { href: "/stammdaten/einstellungen", label: "Einstellungen", roles: ["admin", "disponent"] },
    ],
  },
];

export function navGroupsFor(role: UserRole): NavGroup[] {
  return NAV_GROUPS.filter((g) => g.roles.includes(role)).map((g) => ({
    ...g,
    items: g.items.filter((i) => i.roles.includes(role)),
  }));
}
