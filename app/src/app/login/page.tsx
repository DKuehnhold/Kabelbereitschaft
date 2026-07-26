"use client";

import { useActionState } from "react";
import { Logo } from "@/components/Logo";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { signIn, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 safe-x">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo height={44} />
          <h1 className="text-lg font-semibold text-foreground">Kabelbereitschaft</h1>
          <p className="text-sm text-muted">Bitte anmelden</p>
        </div>

        {!isSupabaseConfigured ? (
          <div
            className="mb-4 rounded-md border px-3 py-2 text-xs"
            style={{ borderColor: "var(--warning)", background: "var(--warning-bg)", color: "var(--warning)" }}
          >
            Hinweis: Supabase ist noch nicht konfiguriert. Anmeldung erst nach Eintrag von URL und
            Anon-Key in <code>.env.local</code> möglich.
          </div>
        ) : null}

        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-foreground">
              E-Mail
            </label>
            <input id="email" name="email" type="email" autoComplete="email" required className="input" />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-foreground">
              Passwort
            </label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
          </div>

          {state.error ? (
            <div
              className="rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: "var(--danger)", background: "var(--danger-bg)", color: "var(--danger)" }}
              role="alert"
            >
              {state.error}
            </div>
          ) : null}

          <button type="submit" disabled={pending} className="btn btn-primary w-full">
            {pending ? "Anmeldung läuft…" : "Anmelden"}
          </button>
        </form>
      </div>
    </main>
  );
}
