import { FigureList } from "@/components/Panel";
import { formatChangePct, formatEps, formatMoney, formatShares } from "@/lib/format";
import type { Components, Currency, DealResults } from "@/lib/types";

const COMPONENT_LABELS: [keyof Components, string][] = [
  ["acquirer_net_income", "Acquirer net income"],
  ["target_net_income", "Target net income"],
  ["refinancing_savings", "Target interest saved (refinancing)"],
  ["cost_synergies", "Cost synergies"],
  ["revenue_synergies", "Revenue synergies"],
  ["dis_synergies", "Dis-synergies"],
  ["integration_costs", "Integration costs"],
  ["amortization", "New amortization"],
  ["new_interest", "Interest on new debt"],
  ["financing_fees", "Financing fee amortization"],
  ["lost_interest_on_cash", "Interest lost on cash used"],
  ["minority_interest", "Minority interest"],
];

type Row = { label: string; cells: string[]; strong?: boolean; tones?: (number | null)[] };

function YearTable({ caption, rows }: { caption: string; rows: Row[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-body tabular-nums">
        <caption className="px-5 pt-4 pb-2 text-left text-body font-semibold text-ink">{caption}</caption>
        <thead>
          <tr className="text-ink-soft">
            <th className="px-5 py-2 text-left font-normal" />
            {[1, 2, 3, 4, 5].map((year) => (
              <th key={year} scope="col" className="px-3 py-2 text-right font-normal">Year {year}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-rule">
              <th scope="row" className={`px-5 py-2 text-left ${row.strong ? "font-semibold text-ink" : "font-normal text-ink-soft"}`}>
                {row.label}
              </th>
              {row.cells.map((cell, i) => {
                const tone = row.tones?.[i];
                const color = tone === undefined || tone === null ? "text-ink" : tone >= 0 ? "text-gain" : "text-loss";
                return (
                  <td key={i} className={`px-3 py-2 text-right ${color} ${row.strong ? "font-semibold" : ""}`}>
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function earningsRows(results: DealResults, currency: Currency): Row[] {
  const { years } = results;
  const money = (pick: (i: number) => number) => years.map((_, i) => formatMoney(pick(i), currency));
  const rows: Row[] = COMPONENT_LABELS
    .filter(([key]) => years.some((y) => Math.abs(y.components[key]) > 0.5))
    .map(([key, label]) => ({ label, cells: money((i) => years[i].components[key]) }));
  const change = (pick: (i: number) => number | null) => ({
    cells: years.map((_, i) => `${(pick(i) ?? 0) >= 0 ? "▲" : "▼"} ${formatChangePct(pick(i))}`),
    tones: years.map((_, i) => pick(i)),
  });
  return [
    ...rows,
    { label: "GAAP net income", cells: money((i) => years[i].gaap_net_income), strong: true },
    { label: "Pro forma shares", cells: years.map((y) => formatShares(y.pro_forma_shares, currency)) },
    { label: "Standalone EPS", cells: years.map((y) => formatEps(y.standalone_eps, currency)) },
    { label: "GAAP EPS", cells: years.map((y) => formatEps(y.gaap_eps, currency)), strong: true },
    { label: "GAAP accretion", ...change((i) => years[i].gaap_accretion), strong: true },
    { label: "Cash net income", cells: money((i) => years[i].cash_net_income) },
    { label: "Cash EPS", cells: years.map((y) => formatEps(y.cash_eps, currency)), strong: true },
    { label: "Cash accretion", ...change((i) => years[i].cash_accretion), strong: true },
    {
      label: "Breakeven pre-tax synergies",
      cells: years.map((y) =>
        y.breakeven_synergies === null ? "n/a" : y.breakeven_synergies <= 0 ? "None needed" : formatMoney(y.breakeven_synergies, currency),
      ),
    },
  ];
}

export default function ResultsTable({ results }: { results: DealResults }) {
  const { currency, ppa } = results;

  return (
    <div className="divide-y divide-rule">
      <YearTable caption="Pro forma earnings (after tax)" rows={earningsRows(results, currency)} />
      <p className="px-5 py-3 text-caption text-ink-soft">
        Breakeven synergies: the pre-tax synergies (cost savings plus revenue profit, less dis-synergies) at which
        GAAP EPS equals standalone EPS. &ldquo;None needed&rdquo; means the deal is accretive without any.
      </p>

      {results.debt_schedule.map((tranche, index) => (
        <YearTable
          key={index}
          caption={`${tranche.name}: ${formatMoney(tranche.amount, currency)} at ${(tranche.rate * 100).toFixed(2)}%`}
          rows={[
            { label: "Opening balance", cells: tranche.years.map((y) => formatMoney(y.beginning, currency)) },
            { label: "Mandatory repayment", cells: tranche.years.map((y) => formatMoney(-y.mandatory, currency)) },
            { label: "Cash sweep", cells: tranche.years.map((y) => formatMoney(-y.sweep, currency)) },
            { label: "Closing balance", cells: tranche.years.map((y) => formatMoney(y.ending, currency)), strong: true },
            { label: "Interest", cells: tranche.years.map((y) => formatMoney(y.interest, currency)) },
            { label: "Fee amortization", cells: tranche.years.map((y) => formatMoney(y.fee_amortization, currency)) },
          ]}
        />
      ))}

      {ppa && (
        <div className="px-5 py-4">
          <h3 className="text-body font-semibold text-ink">Purchase price allocation</h3>
          <FigureList
            rows={[
              { label: "Consideration", value: formatMoney(ppa.consideration, currency) },
              { label: "Book value of equity", value: formatMoney(ppa.book_value, currency) },
              { label: "Intangibles write-up", value: formatMoney(ppa.intangibles_write_up, currency) },
              { label: "PP&E write-up", value: formatMoney(ppa.ppe_write_up, currency) },
              { label: "Deferred tax liability", value: formatMoney(-ppa.deferred_tax_liability, currency) },
              { label: "Goodwill", value: formatMoney(ppa.goodwill, currency), strong: true, tone: ppa.goodwill < 0 ? "loss" : undefined },
              { label: "Yearly amortization (Year 1, pre-tax)", value: formatMoney(ppa.amortization[0], currency) },
            ]}
          />
        </div>
      )}
    </div>
  );
}
