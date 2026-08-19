"use client";

// AUFTRAG_11: Feste Seitenleiste entfällt. Stattdessen oben eine horizontale
// Topbar mit den wichtigsten Zielen als Icon+Text (Dashboard, Meldungen,
// Neue Meldung, Bereitschaftsplan, Material/Bestand - je nach Rolle über
// roles.ts gefiltert), rechts ein Burger-Menü mit dem Rest (Stammdaten,
// weitere Einträge, Benutzer, Theme-Umschalter, Abmelden). Rollenabhängige
// Sichtbarkeit unverändert (navFor/navGroupsFor) - nur die Darstellung
// ändert sich.
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { MenuNavLink, PrimaryNavLink, isPrimaryNavItem } from "@/components/AppNav";
import { navFor, navGroupsFor, ROLE_LABELS, type UserRole } from "@/lib/roles";

export function AppShell({
  role,
  fullName,
  children,
}: {
  role: UserRole;
  fullName: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const items = navFor(role);
  const groups = navGroupsFor(role);
  const primaryItems = items.filter((item) => isPrimaryNavItem(item));
  const restItems = items.filter((item) => !isPrimaryNavItem(item));

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));

  const closeMenu = () => setOpen(false);

  // Escape schließt das Menü (Fokus zurück auf den Burger-Button); Klick
  // außerhalb von Menü/Button schließt ebenfalls. Nur aktiv, solange offen.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        !buttonRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-surface safe-x safe-t">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2">
            <Logo height={30} />
            <span className="hidden text-sm text-muted sm:inline">
              Bereitschaftsapp HLK
            </span>
          </div>

          {/* Desktop: Hauptziele als Icon+Text-Leiste */}
          <nav
            className="hidden flex-1 items-center gap-1 md:flex"
            aria-label="Hauptnavigation"
          >
            {primaryItems.map((item) => (
              <PrimaryNavLink
                key={item.href}
                item={item}
                active={isActive(item.href)}
              />
            ))}
          </nav>

          {/* Burger-Menü: Auf Mobil kompakte Topbar (nur Logo + Burger), auf
              Desktop enthält es den Rest (Stammdaten, Benutzer, Theme,
              Abmelden). */}
          <button
            ref={buttonRef}
            type="button"
            aria-label={open ? "Menü schließen" : "Menü öffnen"}
            aria-expanded={open}
            aria-controls="app-burger-menu"
            onClick={() => setOpen((v) => !v)}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border bg-surface text-foreground hover:bg-surface-2"
          >
            {open ? (
              <X className="size-5" aria-hidden />
            ) : (
              <Menu className="size-5" aria-hidden />
            )}
          </button>
        </div>
      </header>

      {open ? (
        <>
          {/* Abdunkelung außerhalb des Menüs; Klick darauf schließt es. */}
          <div
            className="fixed inset-0 z-20 bg-foreground/20"
            aria-hidden="true"
            onClick={closeMenu}
          />
          <div
            id="app-burger-menu"
            ref={menuRef}
            className="fixed inset-x-0 top-16 z-30 max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-border bg-surface shadow safe-x safe-b"
          >
            <div className="mx-auto max-w-7xl px-4 py-3">
              {/* Hauptziele: auf Desktop bereits oben sichtbar, deshalb hier
                  nur auf Mobil eingeblendet (dieselben Links, dieselbe
                  Quelle - kein zweiter Datenpfad). */}
              {primaryItems.length > 0 ? (
                <nav
                  className="space-y-1 border-b border-border pb-3 md:hidden"
                  aria-label="Hauptziele"
                >
                  {primaryItems.map((item) => (
                    <PrimaryNavLink
                      key={item.href}
                      item={item}
                      active={isActive(item.href)}
                      onNavigate={closeMenu}
                      className="w-full"
                    />
                  ))}
                </nav>
              ) : null}

              <nav className="space-y-1 pt-3" aria-label="Weitere Navigation">
                {restItems.map((item) => (
                  <MenuNavLink
                    key={item.href}
                    item={item}
                    active={isActive(item.href)}
                    onNavigate={closeMenu}
                  />
                ))}
                {groups.map((group) => (
                  <div key={group.label} className="pt-3">
                    <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                      {group.label}
                    </div>
                    {group.items.map((item) => (
                      <MenuNavLink
                        key={item.href}
                        item={item}
                        active={isActive(item.href)}
                        onNavigate={closeMenu}
                      />
                    ))}
                  </div>
                ))}
              </nav>

              <div className="mt-3 space-y-2 border-t border-border pt-3">
                <div>
                  <div className="text-sm font-medium text-foreground">{fullName}</div>
                  <div className="text-xs text-muted">{ROLE_LABELS[role]}</div>
                </div>
                <ThemeToggle />
                <form action="/auth/signout" method="post">
                  <button type="submit" className="btn btn-outline w-full">
                    Abmelden
                  </button>
                </form>
              </div>
            </div>
          </div>
        </>
      ) : null}

      <main>
        <div className="mx-auto max-w-7xl px-4 py-6 safe-x">{children}</div>
      </main>
    </div>
  );
}
