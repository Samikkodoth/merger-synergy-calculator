"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART } from "@/lib/chartColors";
import { formatMillions } from "@/lib/format";
import type { DealResults } from "@/lib/types";

const SERIES = [
  { key: "cost", name: "Cost savings", color: CHART.gain },
  { key: "revenue", name: "Profit from new revenue", color: CHART.gainLight },
  { key: "integration", name: "Integration costs", color: CHART.loss },
];

function formatAxisMillions(value: number): string {
  const sign = value < 0 ? "−" : "";
  return `${sign}$${Math.abs(value)}M`;
}

export default function SynergyTimeline({ results }: { results: DealResults }) {
  const data = results.years.map((year) => ({
    label: `Year ${year.year}`,
    cost: year.cost_synergies / 1_000_000,
    revenue: year.revenue_synergy_profit / 1_000_000,
    integration: -year.integration_costs / 1_000_000,
  }));

  return (
    <section aria-labelledby="synergy-timeline-title" className="rounded-lg border border-rule bg-white p-5">
      <h2 id="synergy-timeline-title" className="text-heading font-semibold text-ink">
        Benefits against costs
      </h2>
      <p className="text-body text-ink-soft">
        Synergies build up over time while integration costs fall away. Yearly amounts, before tax.
      </p>

      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} stackOffset="sign" margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART.rule} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: CHART.inkSoft, fontSize: 12 }}
            />
            <YAxis
              tickFormatter={formatAxisMillions}
              tickLine={false}
              axisLine={false}
              width={56}
              tick={{ fill: CHART.inkSoft, fontSize: 12 }}
            />
            <ReferenceLine y={0} stroke={CHART.inkSoft} />
            <Tooltip
              cursor={{ fill: CHART.paper }}
              formatter={(value, name) => [formatMillions(Math.abs(Number(value)) * 1_000_000), name]}
              contentStyle={{ borderRadius: 6, borderColor: CHART.rule, fontSize: 14 }}
              labelStyle={{ color: CHART.ink, fontWeight: 600 }}
            />
            {SERIES.map((series) => (
              <Bar
                key={series.key}
                dataKey={series.key}
                name={series.name}
                stackId="flow"
                fill={series.color}
                maxBarSize={64}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-caption text-ink-soft">
        {SERIES.map((series) => (
          <li key={series.key} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: series.color }} aria-hidden="true" />
            {series.name}
          </li>
        ))}
      </ul>
    </section>
  );
}