"use client";

import { useActionState } from "react";
import { saveSettings } from "@/lib/masterdata-actions";
import type { AppSettingsRow, CustomerRow, StageOption } from "@/lib/masterdata";
import type { FormState } from "@/lib/incidents";
import { FormError, labelCls } from "@/components/masterdata/shared";

const initial: FormState = { ok: false, error: null };

export function SettingsClient({
  settings, customers, onCallOptions,
}: { settings: AppSettingsRow; customers: CustomerRow[]; onCallOptions: StageOption[] }) {
  const [state, action, pending] = useActionState(saveSettings, initial);

  return (
    <div className="card max-w-xl p-4">
      <form action={action} className="space-y-4">
        <FormError error={state.error} />
        {state.ok ? (
          <div
            role="status" className="rounded-md border px-3 py-2 text-sm"
            style={{ background: "var(--success-bg)", color: "var(--success)", borderColor: "var(--success)" }}
          >
            Einstellungen gespeichert.
          </div>
        ) : null}

        <div>
          <label className={labelCls} htmlFor="set_customer">Standardkunde</label>
          <select id="set_customer" name="default_customer_id" defaultValue={settings.default_customer_id ?? ""} className="input">
            <option value="">— nicht festgelegt —</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <p className="mt-1 text-xs text-muted">Wird in der späteren Vorgangserfassung vorausgewählt.</p>
        </div>

        <div>
          <label className={labelCls} htmlFor="set_oncall">Standard-Bereitschaftsnummer</label>
          <select id="set_oncall" name="default_on_call_number_id" defaultValue={settings.default_on_call_number_id ?? ""} className="input">
            <option value="">— nicht festgelegt —</option>
            {onCallOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <p className="mt-1 text-xs text-muted">Globaler Standard; je Bauabschnitt kann eine abweichende Nummer hinterlegt werden.</p>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={pending} className="btn btn-primary">
            {pending ? "Speichern…" : "Einstellungen speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}
