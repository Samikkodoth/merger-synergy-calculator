import type { DealInput, DealResults } from "@/lib/types";
import { formatEps, formatMillionsCompact, formatPercent } from "@/lib/format";

type TombstoneProps = {
  dealName: string;
  inputs: DealInput;
  results: DealResults;
};

function joinWithAnd(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function describeFinancing(inputs: DealInput): string {
  const asPercent = (share: number) => Number((share * 100).toFixed(1));
  const parts: string[] = [];
  if (inputs.pct_stock > 0) parts.push(`${asPercent(inputs.pct_stock)}% in stock`);
  if (inputs.pct_cash > 0) parts.push(`${asPercent(inputs.pct_cash)}% in cash`);
  if (inputs.pct_debt > 0) parts.push(`${asPercent(inputs.pct_debt)}% with debt`);
  return joinWithAnd(parts);
}

function verdictFor(results: DealResults): string {
  const firstAccretive = results.years.find((year) => year.accretion_pct >= 0);
  if (firstAccretive === undefined) return "Dilutive in every year shown";
  if (firstAccretive.year === 1) return "Accretive from the first year";
  return `Dilutive at first, accretive from Year ${firstAccretive.year}`;
}

export default function Tombstone({ dealName, inputs, results }: TombstoneProps) {
  const lastYear = results.years[results.years.length - 1];
  const endsAccretive = lastYear.accretion_pct >= 0;

  return (
    <section aria-label="Deal summary" className="rounded-lg bg-ink p-2 shadow-sm">
      <div className="rounded-md border border-brass/40 px-6 py-10 text-center sm:px-12">
        <h2 className="font-serif text-title text-white sm:text-display">
          {dealName.trim() || "Untitled deal"}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-body text-white/70">
          A {formatMillionsCompact(inputs.purchase_price)} acquisition, paid {describeFinancing(inputs)}.
        </p>
        <div className="mx-auto my-6 h-px w-12 bg-brass" aria-hidden="true" />
        <p className="font-serif text-title text-brass">{verdictFor(results)}</p>
        <p className="mt-2 text-body text-white/70">
          EPS moves from {formatEps(results.eps_before)} to {formatEps(lastYear.eps_after)} by Year{" "}
          {lastYear.year},{" "}
          <span className={`font-semibold ${endsAccretive ? "text-emerald-300" : "text-red-300"}`}>
            {formatPercent(lastYear.accretion_pct)}
          </span>
          .
        </p>
      </div>
    </section>
  );
}