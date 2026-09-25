import { formatEps, formatMoney, formatPct, formatShares } from "@/lib/format";
import type { FieldSource, FieldStatus } from "@/lib/types";

const BADGES: Record<FieldStatus, { label: string; className: string }> = {
  auto: { label: "Auto · verify", className: "border-brass bg-brass/15 text-ink" },
  confirmed: { label: "✓ Checked", className: "border-gain/40 text-gain" },
  manual: { label: "Manual", className: "border-rule text-ink-soft" },
  missing: { label: "Not in filings", className: "border-loss/40 text-loss" },
  todo: { label: "You fill this", className: "border-dashed border-brass text-ink" },
};

type SourceBadgeProps = {
  source: FieldSource;
  open: boolean;
  onToggle: () => void;
  controls: string;
};

/** A small tag next to a field's label saying where its value came from. Opens the details. */
export default function SourceBadge({ source, open, onToggle, controls }: SourceBadgeProps) {
  const badge = BADGES[source.status];
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      title="Where this number came from"
      className={`shrink-0 cursor-pointer rounded border px-1.5 text-caption font-semibold whitespace-nowrap ${badge.className}`}
    >
      {badge.label}
    </button>
  );
}

function formatValue(value: number, kind: FieldSource["kind"]): string {
  switch (kind) {
    case "shares": return formatShares(value);
    case "price": return formatEps(value);
    case "percent": return formatPct(value);
    default: return formatMoney(value);
  }
}

function periodText(start: string | null, end: string): string {
  return start ? `${start} to ${end}` : `as of ${end}`;
}

type SourceDetailsProps = {
  id: string;
  source: FieldSource;
  onConfirm?: () => void;
};

/** Company, filing, period, filing date, XBRL tag and a link, for each fact used. */
export function SourceDetails({ id, source, onConfirm }: SourceDetailsProps) {
  const { status } = source;
  return (
    <div id={id} className="mt-2 space-y-2 rounded-md border border-rule bg-paper p-2 text-caption text-ink-soft">
      {source.company && (
        <p className="font-semibold text-ink">
          {source.company}
          {source.basisLabel && <span className="font-normal text-ink-soft"> · {source.basisLabel}</span>}
        </p>
      )}
      {source.reason && <p>{source.reason}</p>}
      {source.periods && source.periods.length > 0 && (
        <ul className="space-y-1.5">
          {source.periods.map((period, index) => (
            <li key={`${period.accession}-${period.tag}-${index}`} className="break-words">
              <span className="text-ink">{period.role}</span>
              {source.kind && <span className="tabular-nums"> {formatValue(period.value, source.kind)}</span>}
              <br />
              {period.form ?? "Filing"} · {periodText(period.start, period.end)}
              {period.filed && <> · filed {period.filed}</>}
              <br />
              <span className="break-all">Tag: {period.tag}</span>
              {" · "}
              <a href={period.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline">
                View filing<span className="sr-only"> (opens in a new tab)</span> ↗
              </a>
            </li>
          ))}
        </ul>
      )}
      {source.note && <p>{source.note}</p>}
      {status === "manual" && source.value !== undefined && source.kind && (
        <p>You edited this. The source said {formatValue(source.value, source.kind)}.</p>
      )}
      {status === "auto" && onConfirm && (
        <button
          type="button"
          onClick={onConfirm}
          className="cursor-pointer rounded border border-ink px-2 py-0.5 font-semibold text-ink hover:bg-white"
        >
          Mark as checked
        </button>
      )}
    </div>
  );
}
