import Panel from "@/components/Panel";
import { CHART } from "@/lib/chartColors";
import { formatPct, formatShares } from "@/lib/format";
import type { DealResults } from "@/lib/types";

export default function OwnershipPanel({ results }: { results: DealResults }) {
  const o = results.ownership;
  const { currency } = results;
  const groups = [
    { label: "Existing acquirer holders", pct: o.existing_pct, shares: o.existing_shares, color: CHART.ink },
    { label: "Former target holders", pct: o.target_holders_pct, shares: o.shares_to_target_holders, color: CHART.brass },
    { label: "New investors", pct: o.new_investors_pct, shares: o.shares_to_new_investors, color: CHART.inkSoft },
  ].filter((group) => group.shares > 0);

  return (
    <Panel id="ownership" title="Pro forma ownership" description="Who owns the combined company.">
      <div className="flex h-3 overflow-hidden rounded-full bg-paper" aria-hidden="true">
        {groups.map((group) => (
          <div key={group.label} style={{ width: `${group.pct * 100}%`, backgroundColor: group.color }} />
        ))}
      </div>
      <dl className="mt-3 divide-y divide-rule text-body">
        {groups.map((group) => (
          <div key={group.label} className="flex items-baseline justify-between gap-4 py-2">
            <dt className="flex items-center gap-2 text-ink-soft">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: group.color }} aria-hidden="true" />
              {group.label}
            </dt>
            <dd className="text-right whitespace-nowrap tabular-nums text-ink">
              <span className="font-semibold">{formatPct(group.pct)}</span>
              <span className="text-ink-soft"> · {formatShares(group.shares, currency)}</span>
            </dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 py-2 font-semibold">
          <dt className="text-ink">Pro forma diluted shares</dt>
          <dd className="text-right whitespace-nowrap tabular-nums text-ink">{formatShares(o.pro_forma_shares, currency)}</dd>
        </div>
      </dl>
    </Panel>
  );
}
