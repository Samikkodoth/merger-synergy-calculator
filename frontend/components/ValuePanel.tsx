import Panel, { FigureList, type FigureRow } from "@/components/Panel";
import { formatMoney, formatPct } from "@/lib/format";
import type { DealResults } from "@/lib/types";

export default function ValuePanel({ results }: { results: DealResults }) {
  const { value, currency } = results;

  if (!value.valid) {
    return (
      <Panel id="value" title="Value creation" description="Are the synergies worth the premium?">
        <p className="text-body text-loss">{value.message}</p>
      </Panel>
    );
  }

  const created = value.value_created;
  const rows: FigureRow[] = [
    { label: "PV of Years 1–5 synergies", value: formatMoney(value.pv_forecast_years, currency) },
    { label: "PV of terminal value", value: formatMoney(value.pv_terminal_value, currency) },
    { label: "PV of synergies", value: formatMoney(value.pv_synergies, currency), strong: true },
    { label: "Premium paid", value: value.premium_paid === null ? "n/a" : formatMoney(value.premium_paid, currency) },
  ];
  if (created !== null) {
    rows.push({
      label: created >= 0 ? "▲ Value created" : "▼ Value destroyed",
      value: formatMoney(created, currency),
      strong: true,
      tone: created >= 0 ? "gain" : "loss",
    });
  }

  return (
    <Panel id="value" title="Value creation" description="Are the synergies worth the premium?">
      <FigureList rows={rows} />
      <p className="mt-3 text-caption text-ink-soft">
        After-tax net synergies (after integration costs), discounted at {formatPct(value.discount_rate)}, plus a
        terminal value on the Year 5 run-rate growing at {formatPct(value.terminal_growth)} a year.
        {value.premium_paid === null && " Enter the unaffected share price (Advanced mode) to compare with the premium."}
      </p>
    </Panel>
  );
}
