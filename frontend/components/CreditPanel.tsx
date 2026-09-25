import Panel from "@/components/Panel";
import { formatMoney, formatMultiple } from "@/lib/format";
import type { DealInput, DealResults } from "@/lib/types";

type CreditPanelProps = {
  results: DealResults;
  thresholds: DealInput["thresholds"];
};

function Ratio({ value, breach }: { value: number | null; breach: boolean }) {
  return (
    <td className={`px-3 py-2 text-right tabular-nums ${breach ? "font-semibold text-loss" : "text-ink"}`}>
      {breach && <span aria-hidden="true">⚑ </span>}
      {formatMultiple(value)}
      {breach && <span className="sr-only"> (outside the limit)</span>}
    </td>
  );
}

export default function CreditPanel({ results, thresholds }: CreditPanelProps) {
  const { currency } = results;
  const years = results.years;

  if (!years[0].credit.available) {
    return (
      <Panel id="credit" title="Credit metrics" description="Leverage and interest cover for the combined company.">
        <p className="text-body text-ink-soft">
          Enter EBITDA for the acquirer (Advanced mode, Forecasts tab) to see credit metrics.
        </p>
      </Panel>
    );
  }

  const amountRow = (label: string, pick: (i: number) => number) => (
    <tr className="border-t border-rule">
      <th scope="row" className="px-3 py-2 text-left font-normal text-ink-soft">{label}</th>
      {years.map((_, i) => (
        <td key={i} className="px-3 py-2 text-right tabular-nums text-ink">{formatMoney(pick(i), currency)}</td>
      ))}
    </tr>
  );

  return (
    <Panel
      id="credit"
      title="Credit metrics"
      description={`End-of-year figures. Flagged: debt / EBITDA above ${thresholds.max_leverage.toFixed(1)}x or cover below ${thresholds.min_coverage.toFixed(1)}x.`}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-body">
          <thead>
            <tr className="text-ink-soft">
              <th className="px-3 py-2 text-left font-normal" />
              {years.map((year) => (
                <th key={year.year} scope="col" className="px-3 py-2 text-right font-normal">Year {year.year}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {amountRow("EBITDA", (i) => years[i].credit.ebitda)}
            {amountRow("Total debt", (i) => years[i].credit.total_debt)}
            {amountRow("Net debt", (i) => years[i].credit.net_debt)}
            {amountRow("Interest expense", (i) => years[i].credit.interest_expense)}
            <tr className="border-t border-rule">
              <th scope="row" className="px-3 py-2 text-left font-semibold text-ink">Total debt / EBITDA</th>
              {years.map((y) => <Ratio key={y.year} value={y.credit.total_leverage} breach={y.credit.leverage_breach} />)}
            </tr>
            <tr className="border-t border-rule">
              <th scope="row" className="px-3 py-2 text-left font-semibold text-ink">Net debt / EBITDA</th>
              {years.map((y) => <Ratio key={y.year} value={y.credit.net_leverage} breach={false} />)}
            </tr>
            <tr className="border-t border-rule">
              <th scope="row" className="px-3 py-2 text-left font-semibold text-ink">EBITDA / interest</th>
              {years.map((y) => <Ratio key={y.year} value={y.credit.interest_coverage} breach={y.credit.coverage_breach} />)}
            </tr>
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
