import Panel from "@/components/Panel";
import { formatMoney } from "@/lib/format";
import type { Currency, DealResults, LineItem } from "@/lib/types";

function Column({ title, items, total, currency }: { title: string; items: LineItem[]; total: number; currency: Currency }) {
  const shown = items.filter((item) => Math.abs(item.amount) > 0.5);
  return (
    <div className="min-w-0">
      <h3 className="text-body font-semibold text-ink">{title}</h3>
      <dl className="mt-1 divide-y divide-rule text-body">
        {shown.map((item) => (
          <div key={item.key} className="flex justify-between gap-4 py-2">
            <dt className="text-ink-soft">{item.label}</dt>
            <dd className="text-right whitespace-nowrap tabular-nums text-ink">{formatMoney(item.amount, currency)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 py-2 font-semibold">
          <dt className="text-ink">Total</dt>
          <dd className="text-right whitespace-nowrap tabular-nums text-ink">{formatMoney(total, currency)}</dd>
        </div>
      </dl>
    </div>
  );
}

export default function SourcesUsesPanel({ results }: { results: DealResults }) {
  const su = results.sources_uses;
  const { currency } = results;

  return (
    <Panel id="sources-uses" title="Sources and uses" description="Where the money comes from, and what it pays for.">
      <div className="grid gap-6 sm:grid-cols-2">
        <Column title="Uses" items={su.uses} total={su.total_uses} currency={currency} />
        <Column title="Sources" items={su.sources} total={su.total_sources} currency={currency} />
      </div>
      {su.balanced ? (
        <p className="mt-3 text-body text-gain">✓ Sources equal uses</p>
      ) : (
        <p className="mt-3 text-body font-semibold text-loss" role="alert">
          ✗ Sources are {formatMoney(Math.abs(su.gap), currency)} {su.gap > 0 ? "more" : "less"} than uses. The
          results below are not valid until this is fixed.
        </p>
      )}
      {su.cash_available !== null && (
        <p className="mt-1 text-caption text-ink-soft">
          Cash available above the minimum balance: {formatMoney(su.cash_available, currency)}.
        </p>
      )}
      {results.one_time.advisory_fees > 0 && (
        <p className="mt-1 text-caption text-ink-soft">
          Advisory fees of {formatMoney(results.one_time.advisory_fees, currency)} are a one-time cost at close and
          are left out of recurring EPS.
        </p>
      )}
    </Panel>
  );
}
