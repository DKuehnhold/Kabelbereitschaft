"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
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
    <nav className="flex-1 space-y-1 px-2">
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`block rounded-md px-3 py-2 text-sm font-medium ${
              active
                ? "bg-blue-900 text-white"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const userBox = (
    <div className="border-t border-slate-200 p-3">
      <div className="mb-2">
        <div className="text-sm font-medium text-slate-800">{fullName}</div>
        <div className="text-xs text-slate-500">{ROLE_LABELS[role]}</div>
      </div>
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Abmelden
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop-Sidebar */}
      <aside className="hidden w-60 flex-col border-r border-slate-200 bg-white md:flex md:fixed md:inset-y-0">
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-4">
          <Logo height={30} />
        </div>
        {nav}
        {userBox}
      </aside>

      {/* Mobile-Topbar */}
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden">
        <Logo height={26} />
        <button
          type="button"
          aria-label="Menü"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
        >
          ☰ Menü
        </button>
      </header>

      {/* Mobile-Drawer */}
      {open ? (
        <div className="border-b border-slate-200 bg-white md:hidden">
          <div className="py-2">{nav}</div>
          {userBox}
        </div>
      ) : null}

      {/* Inhalt */}
      <main className="flex-1 md:ml-60">
        <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
