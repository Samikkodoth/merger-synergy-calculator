import type { DealResults } from "@/lib/types";
import { formatEps, formatMillions, formatPercent, formatShares } from "@/lib/format";

export default function ResultsTable({ results }: { results: DealResults }) {
  const financingCost = results.new_interest_expense + results.lost_interest_income;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-body tabular-nums">
          <thead>
            <tr className="text-ink-soft">
              <th className="px-5 py-3 text-left font-normal">Year</th>
              <th className="px-5 py-3 text-right font-normal">Cost savings</th>
              <th className="px-5 py-3 text-right font-normal">Revenue synergy profit</th>
              <th className="px-5 py-3 text-right font-normal">Integration costs</th>
              <th className="px-5 py-3 text-right font-normal">EPS after</th>
              <th className="px-5 py-3 text-right font-normal">Accretion</th>
            </tr>
          </thead>
          <tbody>
            {results.years.map((year) => (
              <tr key={year.year} className="border-t border-rule">
                <td className="px-5 py-3 text-left">Year {year.year}</td>
                <td className="px-5 py-3 text-right">{formatMillions(year.cost_synergies)}</td>
                <td className="px-5 py-3 text-right">{formatMillions(year.revenue_synergy_profit)}</td>
                <td className="px-5 py-3 text-right">{formatMillions(year.integration_costs)}</td>
                <td className="px-5 py-3 text-right">{formatEps(year.eps_after)}</td>
                <td className={`px-5 py-3 text-right font-semibold ${year.accretion_pct >= 0 ? "text-gain" : "text-loss"}`}>
                  {formatPercent(year.accretion_pct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-rule px-5 py-3 text-body text-ink-soft">
        New shares issued: {formatShares(results.new_shares_issued)}. Yearly financing cost after
        tax: {formatMillions(financingCost)}.
      </p>
    </div>
  );
}