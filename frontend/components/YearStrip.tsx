import type { DealResults } from "@/lib/types";
import { formatChangePct, formatEps } from "@/lib/format";

type YearStripProps = {
  results: DealResults;
  isUpdating: boolean;
};

function Accretion({ value, label }: { value: number | null; label: string }) {
  if (value === null) return <p className="text-body text-ink-soft">{label} n/a</p>;
  const isAccretive = value >= 0;
  return (
    <p className={`text-body font-semibold tabular-nums ${isAccretive ? "text-gain" : "text-loss"}`}>
      {isAccretive ? "▲" : "▼"} {formatChangePct(value)}
      <span className="font-normal text-ink-soft"> {label}</span>
    </p>
  );
}

export default function YearStrip({ results, isUpdating }: YearStripProps) {
  const { currency } = results;
  return (
    <section aria-labelledby="year-strip-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="year-strip-title" className="text-heading font-semibold text-ink">
          Earnings per share, year by year
        </h2>
        <p className="text-body text-ink-soft" aria-live="polite">
          {isUpdating ? "Updating…" : `Acquirer EPS today: ${formatEps(results.eps_today, currency)}`}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-rule bg-rule sm:grid-cols-3 xl:grid-cols-5">
        {results.years.map((year) => (
          <div key={year.year} className="bg-white p-4">
            <p className="text-caption text-ink-soft">Year {year.year}</p>
            <p className="mt-1 text-figure font-semibold tabular-nums text-ink">{formatEps(year.gaap_eps, currency)}</p>
            <p className="text-caption text-ink-soft">
              vs {formatEps(year.standalone_eps, currency)} standalone
            </p>
            <div className="mt-2 space-y-0.5">
              <Accretion value={year.gaap_accretion} label="GAAP" />
              <Accretion value={year.cash_accretion} label="cash" />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-caption text-ink-soft">
        GAAP EPS is reported earnings. Cash EPS adds back the new amortization and one-time integration costs.
        Both are compared with the acquirer&apos;s standalone forecast for the same year.
      </p>
    </section>
  );
}
