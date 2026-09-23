import { formatEps } from "@/lib/format";
import type { DealInput, DealResults } from "@/lib/types";

export type BridgeBar = {
  label: string;
  base: number;
  height: number;
  tone: "total" | "up" | "down";
  display: string;
};

type Step = {
  label: string;
  value: number;
  isTotal: boolean;
};

function formatChange(value: number): string {
  const sign = value >= 0 ? "+" : "−";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function epsSteps(inputs: DealInput, results: DealResults, yearIndex: number): Step[] {
  const year = results.years[yearIndex];
  const keepAfterTax = 1 - inputs.tax_rate;
  const sharesAfter = inputs.acquirer_shares + results.new_shares_issued;
  const perShare = (amount: number) => amount / sharesAfter;

  return [
    { label: "Before deal", value: results.eps_before, isTotal: true },
    { label: "New shares", value: perShare(inputs.acquirer_net_income) - results.eps_before, isTotal: false },
    { label: "Target profit", value: perShare(inputs.target_net_income), isTotal: false },
    { label: "Cost savings", value: perShare(year.cost_synergies * keepAfterTax), isTotal: false },
    { label: "New revenue", value: perShare(year.revenue_synergy_profit * keepAfterTax), isTotal: false },
    { label: "Integration", value: -perShare(year.integration_costs * keepAfterTax), isTotal: false },
    {
      label: "Financing",
      value: -perShare(results.new_interest_expense + results.lost_interest_income),
      isTotal: false,
    },
    { label: `Year ${year.year}`, value: year.eps_after, isTotal: true },
  ];
}

export function buildEpsBridge(inputs: DealInput, results: DealResults, yearIndex: number): BridgeBar[] {
  const bars: BridgeBar[] = [];
  let running = 0;

  for (const step of epsSteps(inputs, results, yearIndex)) {
    if (step.isTotal) {
      running = step.value;
      bars.push({ label: step.label, base: 0, height: step.value, tone: "total", display: formatEps(step.value) });
    } else {
      const start = running;
      running += step.value;
      bars.push({
        label: step.label,
        base: Math.min(start, running),
        height: Math.abs(step.value),
        tone: step.value >= 0 ? "up" : "down",
        display: formatChange(step.value),
      });
    }
  }

  return bars;
}