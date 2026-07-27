"use client";

import { useState } from "react";
import type { CablePositionRef } from "@/lib/incidents";

type CableType = { id: string; code: string; name: string };
type Position = {
  id?: string;
  cable_type_id: string;
  quantity_value: string;
  quantity_unit: "" | "piece" | "meter";
  condition_code: "" | "ready" | "restricted" | "damaged" | "unusable";
};

const conditionLabels = {
  ready: "Einsatzbereit",
  restricted: "Eingeschränkt",
  damaged: "Beschädigt",
  unusable: "Nicht verwendbar",
} as const;

function emptyPosition(): Position {
  return { cable_type_id: "", quantity_value: "", quantity_unit: "piece", condition_code: "ready" };
}

export function CablePositionsEditor({
  cableTypes,
  initial = [],
}: {
  cableTypes: CableType[];
  initial?: CablePositionRef[];
}) {
  const [positions, setPositions] = useState<Position[]>(
    initial.length
      ? initial.map((p) => ({
          id: p.id,
          cable_type_id: p.cable_type_id,
          quantity_value: p.quantity_value == null ? "" : String(p.quantity_value),
          quantity_unit: p.quantity_unit ?? "",
          condition_code: p.condition_code ?? "",
        }))
      : [emptyPosition()],
  );

  const patch = (index: number, values: Partial<Position>) =>
    setPositions((rows) => rows.map((row, i) => (i === index ? { ...row, ...values } : row)));

  return (
    <div className="space-y-3">
      <input type="hidden" name="cable_positions_json" value={JSON.stringify(positions)} />
      {positions.map((position, index) => (
        <div key={position.id ?? `new-${index}`} className="rounded-md border border-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">Kabelposition {index + 1}</span>
            {positions.length > 1 ? (
              <button
                type="button"
                className="text-sm text-danger hover:underline"
                onClick={() => setPositions((rows) => rows.filter((_, i) => i !== index))}
              >
                Entfernen
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Kabelart *</label>
              <select
                required
                value={position.cable_type_id}
                onChange={(e) => patch(index, { cable_type_id: e.target.value })}
                className="input"
              >
                <option value="">Bitte wählen…</option>
                {cableTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Menge *</label>
              <input
                required={!position.id}
                inputMode="decimal"
                value={position.quantity_value}
                onChange={(e) => patch(index, { quantity_value: e.target.value })}
                className="input"
                placeholder={position.id ? "nicht erfasst" : "z. B. 2"}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Einheit *</label>
              <select
                required={!position.id}
                value={position.quantity_unit}
                onChange={(e) => patch(index, { quantity_unit: e.target.value as Position["quantity_unit"] })}
                className="input"
              >
                <option value="">nicht erfasst</option>
                <option value="piece">Stück</option>
                <option value="meter">Meter</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Zustand *</label>
              <select
                required={!position.id}
                value={position.condition_code}
                onChange={(e) => patch(index, { condition_code: e.target.value as Position["condition_code"] })}
                className="input"
              >
                <option value="">nicht erfasst</option>
                {Object.entries(conditionLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          {position.id && (!position.quantity_value || !position.quantity_unit || !position.condition_code) ? (
            <p className="mt-2 text-xs text-muted">
              Historischer Bestand: Solange die Position fachlich unverändert bleibt, dürfen fehlende Angaben bestehen bleiben.
            </p>
          ) : null}
        </div>
      ))}
      <button type="button" className="btn btn-outline" onClick={() => setPositions((rows) => [...rows, emptyPosition()])}>
        + Kabelposition
      </button>
    </div>
  );
}
