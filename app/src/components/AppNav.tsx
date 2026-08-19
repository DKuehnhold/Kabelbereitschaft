"use client";

// AUFTRAG_11: Neue Topbar-Navigation (Icons + Text) und deren Bausteine.
// Reine Darstellungsschicht - welche Einträge für eine Rolle sichtbar sind,
// entscheidet weiterhin ausschließlich `roles.ts` (navFor/navGroupsFor).
// Diese Datei entscheidet nur, WELCHE der von roles.ts gelieferten Einträge
// oben als Icon-Leiste erscheinen (PRIMARY_NAV_ICONS) und WIE ein Link
// aussieht - keine Rechte-/Routenänderung.

import Link from "next/link";
import type { ComponentType } from "react";
import {
  LayoutDashboard,
  ListChecks,
  FilePlus2,
  ClipboardList,
  CalendarClock,
  Package,
  Boxes,
} from "lucide-react";
import type { NavItem } from "@/lib/roles";

type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

// Zuordnung Haupt-Ziel (Topbar) -> Icon. Absichtlich kurz gehalten
// (Vorgabe AUFTRAG_11: Dashboard, Meldungen, Neue Meldung, Bereitschaftsplan,
// Material/Bestand). Für Rollen ohne "Meldungen" (Monteur) tritt an dessen
// Stelle der vorhandene Eintrag "Meine Einsätze" (gleiche Position in
// NAV_ITEMS, andere Route) - navFor(role) liefert ohnehin nur die pro Rolle
// erlaubten Einträge, hier wird nur entschieden, ob ein vorhandener Eintrag
// in die Icon-Leiste gehört.
export const PRIMARY_NAV_ICONS: Record<string, IconType> = {
  "/dashboard": LayoutDashboard,
  "/vorgaenge": ListChecks,
  "/vorgaenge/neu": FilePlus2,
  "/meine-einsaetze": ClipboardList,
  "/bereitschaftsplan": CalendarClock,
  "/bestand": Package,
  "/material": Boxes,
};

export function isPrimaryNavItem(item: Pick<NavItem, "href">): boolean {
  return item.href in PRIMARY_NAV_ICONS;
}

// Gemeinsamer Link-Baustein für Icon+Text-Einträge (Topbar-Leiste UND deren
// Duplikat im Burger-Menü auf Mobil). min-h-11 = 44px Touchziel.
export function PrimaryNavLink({
  item,
  active,
  onNavigate,
  className = "",
}: {
  item: Pick<NavItem, "href" | "label">;
  active: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const Icon = PRIMARY_NAV_ICONS[item.href];
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={`flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium ${
        active ? "bg-brand text-brand-fg" : "text-foreground hover:bg-surface-2"
      } ${className}`}
    >
      {Icon ? <Icon className="size-5 shrink-0" aria-hidden /> : null}
      <span>{item.label}</span>
    </Link>
  );
}

// Einfacher Textlink für Einträge im Burger-Menü ohne eigenes Icon
// (Stammdaten-Untermenü, Materialhistorie, Benutzer, Export, Lagerorte …).
export function MenuNavLink({
  item,
  active,
  onNavigate,
  className = "",
}: {
  item: Pick<NavItem, "href" | "label">;
  active: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={`flex min-h-11 items-center rounded-md px-3 text-sm font-medium ${
        active ? "bg-brand text-brand-fg" : "text-foreground hover:bg-surface-2"
      } ${className}`}
    >
      {item.label}
    </Link>
  );
}
