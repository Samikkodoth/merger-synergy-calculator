import type { DealResults } from "@/lib/types";
import { formatEps, formatPercent } from "@/lib/format";

type YearStripProps = {
  results: DealResults;
  isUpdating: boolean;
};

export default function YearStrip({ results, isUpdating }: YearStripProps) {
  return (
    <section aria-labelledby="year-strip-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="year-strip-title" className="text-heading font-semibold text-ink">
          Earnings per share, year by year
        </h2>
        <p className="text-body text-ink-soft" aria-live="polite">
          {isUpdating ? "Updating…" : `Before the deal: ${formatEps(results.eps_before)}`}
        </p>
      </div>

      <div className="mt-4 grid gap-px overflow-hidden rounded-lg border border-rule bg-rule sm:grid-cols-3">
        {results.years.map((year) => {
          const isAccretive = year.accretion_pct >= 0;
          return (
            <div key={year.year} className="bg-white p-5">
              <p className="text-caption text-ink-soft">Year {year.year}</p>
              <p className="mt-1 text-figure font-semibold tabular-nums text-ink">{formatEps(year.eps_after)}</p>
              <p className={`mt-1 text-body font-semibold tabular-nums ${isAccretive ? "text-gain" : "text-loss"}`}>
                {isAccretive ? "▲" : "▼"} {formatPercent(year.accretion_pct)} {isAccretive ? "accretive" : "dilutive"}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}