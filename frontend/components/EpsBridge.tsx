"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { buildEpsBridge } from "@/lib/bridge";
import YearToggle from "@/components/YearToggle";
import { CHART } from "@/lib/chartColors";
import { formatAxisEps } from "@/lib/format";
import type { DealResults } from "@/lib/types";

type EpsBridgeProps = {
  results: DealResults;
};

const TONE_COLORS = {
  total: CHART.ink,
  up: CHART.gain,
  down: CHART.loss,
};

export default function EpsBridge({ results }: EpsBridgeProps) {
  const lastIndex = results.years.length - 1;
  const [yearIndex, setYearIndex] = useState(lastIndex);
  const selected = Math.min(yearIndex, lastIndex);
  const bars = buildEpsBridge(results, selected, results.currency);

  return (
    <section aria-labelledby="eps-bridge-title" className="rounded-lg border border-rule bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="eps-bridge-title" className="text-heading font-semibold text-ink">
            What moves EPS
          </h2>
          <p className="text-body text-ink-soft">
            From the acquirer&apos;s standalone EPS to GAAP EPS after the deal. Small items are hidden.
          </p>
        </div>
        <YearToggle
            years={results.years.map((year) => year.year)}
            selectedIndex={selected}
            onSelect={setYearIndex}
        />
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="h-72" style={{ minWidth: Math.max(bars.length * 76, 480) }}>
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
                tickFormatter={(value: number) => formatAxisEps(value, results.currency)}
                tickLine={false}
                axisLine={false}
                width={64}
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