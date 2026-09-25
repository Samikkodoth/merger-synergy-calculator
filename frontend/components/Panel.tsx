import type { ReactNode } from "react";

type PanelProps = {
  id: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

/** The white card every results section sits in. */
export default function Panel({ id, title, description, actions, children }: PanelProps) {
  return (
    <section aria-labelledby={`${id}-title`} className="min-w-0 rounded-lg border border-rule bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`${id}-title`} className="text-heading font-semibold text-ink">
            {title}
          </h2>
          {description && <p className="text-body text-ink-soft">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export type FigureRow = { label: string; value: string; strong?: boolean; tone?: "gain" | "loss" };

/** Label / value pairs with right-aligned tabular figures. */
export function FigureList({ rows }: { rows: FigureRow[] }) {
  return (
    <dl className="divide-y divide-rule text-body">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-4 py-2">
          <dt className={row.strong ? "font-semibold text-ink" : "text-ink-soft"}>{row.label}</dt>
          <dd
            className={`text-right whitespace-nowrap tabular-nums ${row.strong ? "font-semibold" : ""} ${
              row.tone === "gain" ? "text-gain" : row.tone === "loss" ? "text-loss" : "text-ink"
            }`}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
