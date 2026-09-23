"use client";

import { useState } from "react";
import YearToggle from "@/components/YearToggle";
import { formatMillionsCompact, formatPercent } from "@/lib/format";
import type { DealInput, Sensitivity } from "@/lib/types";

type SensitivityTableProps = {
  inputs: DealInput;
  sensitivity: Sensitivity;
  years: number[];
};

function formatChange(change: number): string {
  if (change === 0) return "As entered";
  const sign = change > 0 ? "+" : "−";
  return `${sign}${Math.round(Math.abs(change) * 100)}%`;
}

function cellStyle(pct: number, largest: number) {
  const strength = largest === 0 ? 0 : Math.min(Math.abs(pct) / largest, 1);
  const alpha = 0.06 + strength * 0.3;
  const color = pct >= 0 ? `rgba(31, 122, 90, ${alpha})` : `rgba(180, 50, 45, ${alpha})`;
  return { backgroundColor: color };
}

export default function SensitivityTable({ inputs, sensitivity, years }: SensitivityTableProps) {
  const lastIndex = years.length - 1;
  const [yearIndex, setYearIndex] = useState(lastIndex);
  const selected = Math.min(yearIndex, lastIndex);

  // The accretion values for the selected year, as a simple grid of rows and columns
  const grid = sensitivity.accretion.map((row) => row.map((cell) => cell[selected]));
  const allValues = grid.flat();
  const largest = Math.max(...allValues.map((value) => Math.abs(value)));
  const dilutiveCount = allValues.filter((value) => value < 0).length;

  const lastRow = grid[grid.length - 1];
  const worstCase = lastRow[lastRow.length - 1];

  return (
    <section aria-labelledby="sensitivity-title" className="rounded-lg border border-rule bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="sensitivity-title" className="text-heading font-semibold text-ink">
            What if the assumptions are wrong?
          </h2>
          <p className="text-body text-ink-soft">
            Accretion or dilution if you pay more or less, and if synergies beat or miss the plan.
          </p>
        </div>
        <YearToggle years={years} selectedIndex={selected} onSelect={setYearIndex} />
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-1 text-body tabular-nums">
          <thead>
            <tr>
              <th />
              <th colSpan={sensitivity.price_changes.length} className="pb-1 text-center font-normal text-ink-soft">
                Purchase price
              </th>
            </tr>
            <tr>
              <th className="px-2 text-left align-bottom font-normal text-ink-soft">Synergies</th>
              {sensitivity.price_changes.map((change) => (
                <th key={change} scope="col" className="px-2 pb-1 text-center font-normal">
                  <span className="block font-semibold text-ink">{formatChange(change)}</span>
                  <span className="block text-caption text-ink-soft">
                    {formatMillionsCompact(inputs.purchase_price * (1 + change))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, rowIndex) => {
              const synergyChange = sensitivity.synergy_changes[rowIndex];
              return (
                <tr key={synergyChange}>
                  <th scope="row" className="px-2 text-left font-semibold whitespace-nowrap text-ink">
                    {formatChange(synergyChange)}
                  </th>
                  {row.map((pct, columnIndex) => {
                    const isBase = synergyChange === 0 && sensitivity.price_changes[columnIndex] === 0;
                    return (
                      <td
                        key={columnIndex}
                        style={cellStyle(pct, largest)}
                        className={`rounded-md px-2 py-3 text-center font-semibold ${
                          pct >= 0 ? "text-gain" : "text-loss"
                        } ${isBase ? "ring-2 ring-ink ring-inset" : ""}`}
                      >
                        {formatPercent(pct)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-body text-ink-soft">
        In Year {years[selected]}, {dilutiveCount} of {allValues.length} scenarios are dilutive. In the
        worst case shown, paying 20% more while synergies come in 50% below plan, the deal is{" "}
        <span className={`font-semibold ${worstCase >= 0 ? "text-gain" : "text-loss"}`}>
          {formatPercent(worstCase)}
        </span>
        .
      </p>
    </section>
  );
}