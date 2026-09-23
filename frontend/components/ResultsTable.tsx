import type { DealResults } from "@/lib/types";
import { formatEps, formatMillions, formatPercent, formatShares } from "@/lib/format";

type ResultsTableProps = {
  results: DealResults;
};

export default function ResultsTable({ results }: ResultsTableProps) {
  const firstAccretiveYear = results.years.find((year) => year.accretion_pct >= 0);

  let verdict: string;
  if (firstAccretiveYear === undefined) {
    verdict = "The deal is dilutive in every year shown.";
  } else if (firstAccretiveYear.year === 1) {
    verdict = "The deal is accretive from Year 1.";
  } else {
    verdict = `The deal is dilutive at first and becomes accretive in Year ${firstAccretiveYear.year}.`;
  }

  const financingCost = results.new_interest_expense + results.lost_interest_income;

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">Results</h2>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="EPS before deal" value={formatEps(results.eps_before)} />
        <SummaryCard label="New shares issued" value={formatShares(results.new_shares_issued)} />
        <SummaryCard label="Yearly financing cost (after tax)" value={formatMillions(financingCost)} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Year</th>
              <th className="px-4 py-3 text-right font-medium">Cost synergies</th>
              <th className="px-4 py-3 text-right font-medium">Revenue synergy profit</th>
              <th className="px-4 py-3 text-right font-medium">Integration costs</th>
              <th className="px-4 py-3 text-right font-medium">EPS after</th>
              <th className="px-4 py-3 text-right font-medium">Accretion / dilution</th>
            </tr>
          </thead>
          <tbody>
            {results.years.map((year) => (
              <tr key={year.year} className="border-t border-gray-200">
                <td className="px-4 py-3">Year {year.year}</td>
                <td className="px-4 py-3 text-right">{formatMillions(year.cost_synergies)}</td>
                <td className="px-4 py-3 text-right">{formatMillions(year.revenue_synergy_profit)}</td>
                <td className="px-4 py-3 text-right">{formatMillions(year.integration_costs)}</td>
                <td className="px-4 py-3 text-right">{formatEps(year.eps_after)}</td>
                <td
                  className={`px-4 py-3 text-right font-semibold ${
                    year.accretion_pct >= 0 ? "text-green-700" : "text-red-600"
                  }`}
                >
                  {formatPercent(year.accretion_pct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="font-medium">{verdict}</p>
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}