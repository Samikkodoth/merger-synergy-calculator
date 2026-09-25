"use client";

import { useState } from "react";
import Panel from "@/components/Panel";
import SelectField from "@/components/SelectField";
import YearToggle from "@/components/YearToggle";
import { formatChangePct, formatPct } from "@/lib/format";
import type { Axis, AxisKey, Sensitivity } from "@/lib/types";

export type AxisPair = { x: AxisKey; y: AxisKey };

export const AXIS_PRESETS: { id: string; label: string; pair: AxisPair; needs: AxisKey[] }[] = [
  { id: "premium-synergies", label: "Premium vs synergies", pair: { x: "premium", y: "synergies" }, needs: ["premium"] },
  { id: "stock-premium", label: "% stock vs premium", pair: { x: "pct_stock", y: "premium" }, needs: ["premium"] },
  { id: "rate-debt", label: "Debt rate vs % debt financing", pair: { x: "debt_rate", y: "pct_debt" }, needs: ["debt_rate", "pct_debt"] },
  { id: "price-synergies", label: "Purchase price vs synergies", pair: { x: "price", y: "synergies" }, needs: [] },
  { id: "acceptance-synergies", label: "Open offer acceptance vs synergies", pair: { x: "acceptance", y: "synergies" }, needs: ["acceptance"] },
];

type SensitivityTableProps = {
  sensitivity: Sensitivity | null;
  pair: AxisPair;
  available: AxisKey[];
  onPairChange: (pair: AxisPair) => void;
  error: string;
};

function formatAxisValue(axis: Axis, value: number): string {
  if (axis.key === "price" || axis.key === "synergies") {
    return value === 0 ? "As entered" : formatChangePct(value, 0);
  }
  if (axis.key === "premium" || axis.key === "debt_rate") return formatPct(value);
  return formatPct(value, 0);
}

function cellStyle(value: number, largest: number) {
  const strength = largest === 0 ? 0 : Math.min(Math.abs(value) / largest, 1);
  const alpha = 0.06 + strength * 0.3;
  const color = value >= 0 ? `rgba(31, 122, 90, ${alpha})` : `rgba(180, 50, 45, ${alpha})`;
  return { backgroundColor: color };
}

export default function SensitivityTable({ sensitivity, pair, available, onPairChange, error }: SensitivityTableProps) {
  const [yearIndex, setYearIndex] = useState(4);
  const [metric, setMetric] = useState<"gaap" | "cash">("gaap");

  const presets = AXIS_PRESETS.filter((preset) => preset.needs.every((key) => available.includes(key)));
  const current = AXIS_PRESETS.find((preset) => preset.pair.x === pair.x && preset.pair.y === pair.y);

  const controls = (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-64 max-w-full">
        <SelectField
          id="sensitivity-axes"
          label="Compare"
          value={current?.id ?? presets[0]?.id ?? ""}
          options={presets.map((preset) => ({ value: preset.id, label: preset.label }))}
          onChange={(id) => {
            const preset = AXIS_PRESETS.find((p) => p.id === id);
            if (preset) onPairChange(preset.pair);
          }}
        />
      </div>
      <div role="group" aria-label="Choose a measure" className="inline-flex rounded-md border border-rule p-0.5">
        {(["gaap", "cash"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={metric === option}
            onClick={() => setMetric(option)}
            className={`cursor-pointer rounded px-3 py-1 text-body font-semibold ${
              metric === option ? "bg-ink text-white" : "text-ink-soft hover:text-ink"
            }`}
          >
            {option === "gaap" ? "GAAP EPS" : "Cash EPS"}
          </button>
        ))}
      </div>
      <YearToggle years={[1, 2, 3, 4, 5]} selectedIndex={yearIndex} onSelect={setYearIndex} />
    </div>
  );

  let body;
  if (error) {
    body = <p className="text-body text-loss">{error}</p>;
  } else if (sensitivity === null) {
    body = <p className="text-body text-ink-soft">Calculating scenarios…</p>;
  } else {
    const { x_axis: x, y_axis: y } = sensitivity;
    const grid = sensitivity.cells.map((row) => row.map((cell) => cell[metric][yearIndex]));
    const numbers = grid.flat().filter((value): value is number => value !== null);
    const largest = Math.max(0, ...numbers.map(Math.abs));
    const dilutive = numbers.filter((value) => value < 0).length;

    body = (
      <>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-separate border-spacing-1 text-body tabular-nums">
            <thead>
              <tr>
                <th />
                <th colSpan={x.values.length} className="pb-1 text-center font-normal text-ink-soft">
                  {x.label}
                </th>
              </tr>
              <tr>
                <th className="px-2 text-left align-bottom font-normal text-ink-soft">{y.label}</th>
                {x.values.map((value, i) => (
                  <th key={i} scope="col" className="px-2 pb-1 text-center font-semibold text-ink">
                    {formatAxisValue(x, value)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((row, r) => (
                <tr key={r}>
                  <th scope="row" className="px-2 text-left font-semibold whitespace-nowrap text-ink">
                    {formatAxisValue(y, y.values[r])}
                  </th>
                  {row.map((value, c) => {
                    const isBase = r === y.base_index && c === x.base_index;
                    if (value === null) {
                      return <td key={c} className="rounded-md px-2 py-3 text-center text-ink-soft">n/a</td>;
                    }
                    return (
                      <td
                        key={c}
                        style={cellStyle(value, largest)}
                        className={`rounded-md px-2 py-3 text-center font-semibold whitespace-nowrap ${
                          value >= 0 ? "text-gain" : "text-loss"
                        } ${isBase ? "ring-2 ring-ink ring-inset" : ""}`}
                      >
                        {value >= 0 ? "▲" : "▼"} {formatChangePct(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-body text-ink-soft">
          In Year {yearIndex + 1}, {dilutive} of {numbers.length} scenarios are dilutive on{" "}
          {metric === "gaap" ? "GAAP" : "cash"} EPS. The outlined cell is the deal as entered.
          {!sensitivity.base_valid && " Sources and uses don't balance for the deal as entered, so treat this grid with care."}
        </p>
        <p className="mt-1 text-caption text-ink-soft">
          When a scenario needs more or less cash, each funding source keeps its share of the funding.
        </p>
      </>
    );
  }

  return (
    <Panel
      id="sensitivity"
      title="What if the assumptions are wrong?"
      description="Accretion or dilution across a range of two assumptions."
    >
      {controls}
      <div className="mt-4">{body}</div>
    </Panel>
  );
}
