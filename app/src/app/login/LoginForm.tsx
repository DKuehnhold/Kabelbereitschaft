"use client";

import { useActionState } from "react";
import { Logo } from "@/components/Logo";
import { signIn, type LoginState } from "./actions";

// AP14/B: unveraenderte Darstellung der bisherigen Anmeldeseite. Aus
// `page.tsx` herausgezogen, weil der Konfigurationszustand jetzt aus
// serverseitigen Laufzeitvariablen (DATABASE_URL, AUTH_SECRET) stammt und
// deshalb nicht in ein Client-Bundle gelangen darf. Er wird als Eigenschaft
// uebergeben. Es ist keine Gestaltungsaenderung erfolgt.

const initialState: LoginState = { error: null };

export function LoginForm({
  configured,
  passwordChanged = false,
}: {
  configured: boolean;
  passwordChanged?: boolean;
}) {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo height={40} />
          <h1 className="text-lg font-semibold text-slate-900">
            Kabelbereitschaft
          </h1>
          <p className="text-sm text-slate-500">Bitte anmelden</p>
        </div>

        {/* Nach einem Passwortwechsel sind alle Sitzungen widerrufen; die
            erneute Anmeldung ist zwingend. Gleicher Hinweiskasten wie unten,
            keine neue Gestaltung. */}
        {passwordChanged ? (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Das Passwort wurde geändert. Bitte mit dem neuen Passwort anmelden.
          </div>
        ) : null}

        {!configured ? (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Hinweis: Die Laufzeitkonfiguration ist unvollständig. Anmeldung erst
            nach Eintrag von <code>DATABASE_URL</code> und{" "}
            <code>AUTH_SECRET</code> möglich.
          </div>
        ) : null}

        <form action={formAction} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              E-Mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Passwort
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
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
            {pending ? "Anmeldung läuft…" : "Anmelden"}
          </button>
        </form>
      </div>
    </main>
  );
}
