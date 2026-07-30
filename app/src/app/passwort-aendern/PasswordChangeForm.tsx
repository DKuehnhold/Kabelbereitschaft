"use client";

import { useActionState } from "react";
import { Logo } from "@/components/Logo";
import { changePassword, type PasswordChangeState } from "./actions";

// AP14/B: rein funktionaler Passwortwechsel (ADR-011 / 2.3).
//
// Gestaltung: uebernommen aus `app/login/LoginForm.tsx` - identische Karte,
// identische Feld-, Hinweis- und Schaltflaechenklassen. Es ist bewusst KEINE
// neue Gestaltung, keine Variante und keine Designentscheidung entstanden;
// sichtbare Gestaltung entscheidet Dennis in der GUI-Phase.

const initialState: PasswordChangeState = { error: null };

export function PasswordChangeForm({
  email,
  forced,
  minLength,
}: {
  email: string;
  forced: boolean;
  minLength: number;
}) {
  const [state, formAction, pending] = useActionState(changePassword, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo height={40} />
          <h1 className="text-lg font-semibold text-slate-900">Passwort ändern</h1>
          <p className="text-sm text-slate-500">{email}</p>
        </div>

        {forced ? (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Für dieses Konto ist ein Passwortwechsel erforderlich. Bis zum Wechsel
            sind alle übrigen Seiten gesperrt.
          </div>
        ) : null}

        <form action={formAction} className="space-y-4">
          <div>
            <label
              htmlFor="currentPassword"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Aktuelles Passwort
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="newPassword"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Neues Passwort
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={minLength}
              aria-describedby="newPasswordHint"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <p id="newPasswordHint" className="mt-1 text-xs text-slate-500">
              Mindestens {minLength} Zeichen.
            </p>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Neues Passwort bestätigen
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={minLength}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {state.error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {pending ? "Wird geändert…" : "Passwort ändern"}
          </button>
        </form>

        {/* Der Wechsel beendet alle Sitzungen; die Abmeldung bleibt der einzige
            andere Weg aus einem gesperrten Konto. */}
        <form action="/auth/signout" method="post" className="mt-4">
          <button
            type="submit"
            className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Abmelden
          </button>
        </form>
      </div>
    </main>
  );
}
