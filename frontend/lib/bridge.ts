import { formatEps, formatEpsChange } from "@/lib/format";
import type { Currency, DealResults } from "@/lib/types";

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
  /** Shown even when zero */
  always?: boolean;
};

/** The steps from standalone EPS to pro forma GAAP EPS for one year. Every
 * after-tax item is spread over the pro forma share count. */
export function epsSteps(results: DealResults, yearIndex: number): Step[] {
  const year = results.years[yearIndex];
  const c = year.components;
  const perShare = (amount: number) => amount / year.pro_forma_shares;

  return [
    { label: "Standalone", value: year.standalone_eps, isTotal: true },
    { label: "New shares", value: perShare(c.acquirer_net_income) - year.standalone_eps, isTotal: false, always: true },
    { label: "Target profit", value: perShare(c.target_net_income + c.minority_interest), isTotal: false, always: true },
    { label: "Refinancing", value: perShare(c.refinancing_savings), isTotal: false },
    { label: "Cost savings", value: perShare(c.cost_synergies), isTotal: false, always: true },
    { label: "New revenue", value: perShare(c.revenue_synergies), isTotal: false },
    { label: "Dis-synergies", value: perShare(c.dis_synergies), isTotal: false },
    { label: "Integration", value: perShare(c.integration_costs), isTotal: false },
    { label: "Amortization", value: perShare(c.amortization), isTotal: false },
    { label: "Financing", value: perShare(c.new_interest + c.lost_interest_on_cash), isTotal: false, always: true },
    { label: "Fees", value: perShare(c.financing_fees), isTotal: false },
    { label: `Year ${year.year}`, value: year.gaap_eps, isTotal: true },
  ].filter((step) => step.isTotal || step.always || Math.abs(step.value) >= 0.005);
}

export function buildEpsBridge(results: DealResults, yearIndex: number, currency: Currency): BridgeBar[] {
  const bars: BridgeBar[] = [];
  let running = 0;

  for (const step of epsSteps(results, yearIndex)) {
    if (step.isTotal) {
      running = step.value;
      bars.push({ label: step.label, base: 0, height: step.value, tone: "total", display: formatEps(step.value, currency) });
    } else {
      const start = running;
      running += step.value;
      bars.push({
        label: step.label,
        base: Math.min(start, running),
        height: Math.abs(step.value),
        tone: step.value >= 0 ? "up" : "down",
        display: formatEpsChange(step.value, currency),
      });
    }
  }

  return bars;
}
