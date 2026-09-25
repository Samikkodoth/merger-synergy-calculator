import type { Currency, DealResults } from "@/lib/types";
import { formatChangePct, formatEps, formatMoney, formatPct } from "@/lib/format";

type TombstoneProps = {
  dealName: string;
  results: DealResults;
};

function joinWithAnd(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function describeFinancing(results: DealResults): string {
  const { sources, total_sources: total } = results.sources_uses;
  if (total <= 0) return "";
  const pieces: Record<string, number> = { stock: 0, cash: 0, debt: 0, "new equity": 0 };
  for (const source of sources) {
    if (source.key === "stock") pieces.stock += source.amount;
    else if (source.key === "cash") pieces.cash += source.amount;
    else if (source.key === "new_equity") pieces["new equity"] += source.amount;
    else pieces.debt += source.amount;
  }
  const parts = Object.entries(pieces)
    .filter(([, amount]) => amount > 0)
    .map(([name, amount]) => `${Number(((amount / total) * 100).toFixed(1))}% ${name === "debt" ? "with debt" : `in ${name}`}`);
  return parts.length ? `, funded ${joinWithAnd(parts)}` : "";
}

function verdictFor(results: DealResults): string {
  const firstAccretive = results.years.find((year) => (year.gaap_accretion ?? -1) >= 0);
  if (firstAccretive === undefined) return "Dilutive in every year shown";
  if (firstAccretive.year === 1) return "Accretive from the first year";
  return `Dilutive at first, accretive from Year ${firstAccretive.year}`;
}

function describeStake(results: DealResults, currency: Currency): string {
  const { stake } = results;
  const cost = formatMoney(stake.cost, currency);
  if (stake.final_pct >= 0.9999) return `A ${cost} acquisition`;
  return `A ${cost} purchase taking the stake to ${formatPct(stake.final_pct)}`;
}

export default function Tombstone({ dealName, results }: TombstoneProps) {
  const { currency } = results;
  const lastYear = results.years[results.years.length - 1];
  const accretion = lastYear.gaap_accretion ?? 0;
  const endsAccretive = accretion >= 0;

  return (
    <section aria-label="Deal summary" className="rounded-lg bg-ink p-2 shadow-sm">
      <div className="rounded-md border border-brass/40 px-6 py-10 text-center sm:px-12">
        <h2 className="font-serif text-title break-words text-white sm:text-display">
          {dealName.trim() || "Untitled deal"}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-body text-white/70">
          {describeStake(results, currency)}
          {describeFinancing(results)}.
        </p>
        <div className="mx-auto my-6 h-px w-12 bg-brass" aria-hidden="true" />
        <p className="font-serif text-title text-brass">{verdictFor(results)}</p>
        <p className="mt-2 text-body text-white/70">
          In Year {lastYear.year}, EPS is {formatEps(lastYear.gaap_eps, currency)} against{" "}
          {formatEps(lastYear.standalone_eps, currency)} without the deal,{" "}
          <span className={`font-semibold ${endsAccretive ? "text-emerald-300" : "text-red-300"}`}>
            {endsAccretive ? "▲" : "▼"} {formatChangePct(lastYear.gaap_accretion)}
          </span>
          .
        </p>
      </div>
    </section>
  );
}
