"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { buildEpsBridge } from "@/lib/bridge";
import { CHART } from "@/lib/chartColors";
import type { DealInput, DealResults } from "@/lib/types";

type EpsBridgeProps = {
  inputs: DealInput;
  results: DealResults;
};

const TONE_COLORS = {
  total: CHART.ink,
  up: CHART.gain,
  down: CHART.loss,
};

export default function EpsBridge({ inputs, results }: EpsBridgeProps) {
  const lastIndex = results.years.length - 1;
  const [yearIndex, setYearIndex] = useState(lastIndex);
  const selected = Math.min(yearIndex, lastIndex);
  const bars = buildEpsBridge(inputs, results, selected);

  return (
    <section aria-labelledby="eps-bridge-title" className="rounded-lg border border-rule bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="eps-bridge-title" className="text-heading font-semibold text-ink">
            What moves EPS
          </h2>
          <p className="text-body text-ink-soft">
            How each part of the deal adds to or takes away from earnings per share.
          </p>
        </div>
        <div role="group" aria-label="Choose a year" className="inline-flex rounded-md border border-rule p-0.5">
          {results.years.map((year, index) => (
            <button
              key={year.year}
              type="button"
              aria-pressed={index === selected}
              onClick={() => setYearIndex(index)}
              className={`cursor-pointer rounded px-3 py-1 text-body font-semibold ${
                index === selected ? "bg-ink text-white" : "text-ink-soft hover:text-ink"
              }`}
            >
              Year {year.year}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="h-72 min-w-[720px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bars} margin={{ top: 24, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={CHART.rule} />
              <XAxis
                dataKey="label"
                interval={0}
                tickLine={false}
                axisLine={{ stroke: CHART.rule }}
                tick={{ fill: CHART.inkSoft, fontSize: 12 }}
              />
              <YAxis
                tickFormatter={(value: number) => `$${value.toFixed(2)}`}
                tickLine={false}
                axisLine={false}
                width={56}
                tick={{ fill: CHART.inkSoft, fontSize: 12 }}
              />
              <Bar dataKey="base" stackId="bridge" fill="transparent" isAnimationActive={false} />
              <Bar dataKey="height" stackId="bridge" radius={3} isAnimationActive={false}>
                {bars.map((bar) => (
                  <Cell key={bar.label} fill={TONE_COLORS[bar.tone]} />
                ))}
                <LabelList
                  dataKey="display"
                  position="top"
                  style={{ fill: CHART.ink, fontSize: 12, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="mt-3 text-caption text-ink-soft">
        Amounts are per share and after tax. Each step is rounded, so the steps can differ from the
        total by a cent.
      </p>
    </section>
  );
}