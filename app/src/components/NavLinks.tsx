"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/roles";

export function NavLinks({
  items,
  variant = "desktop",
}: {
  items: Pick<NavItem, "href" | "label">[];
  variant?: "desktop" | "mobile";
}) {
  const pathname = usePathname();
  const base =
    variant === "desktop"
      ? "px-3 py-2 rounded-md text-sm font-medium"
      : "block px-3 py-2 rounded-md text-base font-medium";

  return (
    <>
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${base} ${
              active
                ? "bg-blue-900 text-white"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
