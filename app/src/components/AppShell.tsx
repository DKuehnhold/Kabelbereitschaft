"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { navFor, ROLE_LABELS, type UserRole } from "@/lib/roles";

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
  const items = navFor(role);

  const nav = (
    <nav className="flex-1 space-y-1 px-2" aria-label="Hauptnavigation">
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={() => setOpen(false)}
            className={`block rounded-md px-3 py-2 text-sm font-medium ${
              active
                ? "bg-brand text-white"
                : "text-foreground hover:bg-surface-2"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const userBox = (
    <div className="space-y-2 border-t border-border p-3 safe-b">
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
  );

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop-Sidebar */}
      <aside className="hidden w-60 flex-col border-r border-border bg-surface md:flex md:fixed md:inset-y-0 safe-x">
        <div className="flex h-16 items-center gap-2 border-b border-border px-4">
          <Logo height={30} />
        </div>
        {nav}
        {userBox}
      </aside>

      {/* Mobile-Topbar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface px-4 safe-x md:hidden">
        <Logo height={26} />
        <button
          type="button"
          aria-label="Menü"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="btn btn-outline px-3 py-1.5"
        >
          ☰ Menü
        </button>
      </header>

      {/* Mobile-Drawer */}
      {open ? (
        <div className="border-b border-border bg-surface md:hidden">
          <div className="py-2">{nav}</div>
          {userBox}
        </div>
      ) : null}

      {/* Inhalt */}
      <main className="flex-1 md:ml-60">
        <div className="mx-auto max-w-7xl px-4 py-6 safe-x">{children}</div>
      </main>
    </div>
  );
}
