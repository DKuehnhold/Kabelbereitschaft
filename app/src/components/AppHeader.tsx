import { Logo } from "@/components/Logo";
import { NavLinks } from "@/components/NavLinks";
import { navFor, ROLE_LABELS, type UserRole } from "@/lib/roles";

export function AppHeader({
  role,
  fullName,
}: {
  role: UserRole;
  fullName: string;
}) {
  const items = navFor(role).map((i) => ({ href: i.href, label: i.label }));

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <Logo height={34} />
          <span className="hidden text-sm text-slate-400 sm:inline">
            Kabelbereitschaft
          </span>
        </div>

        {/* Desktop-Navigation */}
        <nav className="hidden items-center gap-1 md:flex">
          <NavLinks items={items} />
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium text-slate-800">{fullName}</div>
            <div className="text-xs text-slate-500">{ROLE_LABELS[role]}</div>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Abmelden
            </button>
          </form>
        </div>
      </div>

      {/* Mobile-Navigation (ohne zusaetzliches JS via details/summary) */}
      <details className="border-t border-slate-100 md:hidden">
        <summary className="cursor-pointer list-none px-4 py-2 text-sm font-medium text-slate-700">
          ☰ Menü
        </summary>
        <nav className="space-y-1 px-2 pb-3">
          <NavLinks items={items} variant="mobile" />
        </nav>
      </details>
    </header>
  );
}
