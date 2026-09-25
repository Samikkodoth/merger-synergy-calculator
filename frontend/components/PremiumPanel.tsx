import Panel, { FigureList, type FigureRow } from "@/components/Panel";
import { formatEps, formatMoney, formatMultiple, formatPct } from "@/lib/format";
import type { DealResults } from "@/lib/types";

const TREATMENT = {
  consolidate: "Consolidated",
  equity: "Equity method",
  investment: "Financial investment",
};

export default function PremiumPanel({ results }: { results: DealResults }) {
  const { offer, stake, consideration, currency } = results;
  const rows: FigureRow[] = [];

  if (offer.per_share && offer.offer_price !== null) {
    rows.push({ label: "Offer price per share", value: formatEps(offer.offer_price, currency) });
    if (offer.unaffected_price) rows.push({ label: "Unaffected price", value: formatEps(offer.unaffected_price, currency) });
    rows.push({ label: "Premium", value: formatPct(offer.premium_pct), strong: true });
  }
  rows.push(
    { label: "Equity value (100%)", value: formatMoney(offer.equity_value, currency) },
    { label: "Net debt", value: formatMoney(offer.net_debt, currency) },
    { label: "Enterprise value", value: formatMoney(offer.enterprise_value, currency), strong: true },
    { label: "EV / Revenue", value: formatMultiple(offer.ev_revenue) },
    { label: "EV / EBITDA", value: formatMultiple(offer.ev_ebitda) },
    { label: "P/E", value: formatMultiple(offer.pe) },
  );
  if (stake.premium_paid !== null) {
    rows.push({ label: "Premium paid", value: formatMoney(stake.premium_paid, currency) });
  }
  if (consideration.exchange_ratio !== null && consideration.stock_per_share !== null && consideration.exchange_ratio > 0) {
    rows.push(
      { label: "Stock per target share", value: formatEps(consideration.stock_per_share, currency) },
      { label: "Exchange ratio", value: `${consideration.exchange_ratio.toFixed(4)}x` },
    );
  }

  const stakeRows = [
    ...stake.legs.map((leg) => ({ label: `${leg.name} (${formatPct(leg.pct)})`, value: formatMoney(leg.cost, currency) })),
    { label: "Final stake", value: formatPct(stake.final_pct), strong: true },
    { label: "Accounting", value: TREATMENT[stake.treatment] },
  ];

  return (
    <Panel id="premium" title="Premium and implied multiples" description="What is being paid, for 100% of the target.">
      <FigureList rows={rows} />
      {(stake.final_pct < 0.9999 || stake.legs.length > 1) && (
        <div className="mt-4">
          <h3 className="text-body font-semibold text-ink">Stake</h3>
          <FigureList rows={stakeRows} />
        </div>
      )}
    </Panel>
  );
}
