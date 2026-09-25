import type { SavedDealSummary } from "@/lib/types";

type SavedDealsListProps = {
  deals: SavedDealSummary[];
  onLoad: (id: number) => void;
  onDelete: (id: number, name: string) => void;
};

export default function SavedDealsList({ deals, onLoad, onDelete }: SavedDealsListProps) {
  return (
    <section aria-labelledby="saved-deals-title">
      <h2 id="saved-deals-title" className="text-heading font-semibold text-ink">
        Saved deals
      </h2>

      {deals.length === 0 ? (
        <p className="mt-3 text-body text-ink-soft">
          No saved deals yet. Name your deal and choose Save deal to keep it here.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-rule rounded-lg border border-rule bg-white">
          {deals.map((deal) => (
            <li key={deal.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="truncate text-body font-semibold text-ink">{deal.name}</p>
                <p className="text-caption text-ink-soft">
                  {deal.currency === "INR" ? "INR · " : ""}Saved {new Date(deal.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onLoad(deal.id)}
                  className="cursor-pointer rounded-md border border-rule px-3 py-1.5 text-body font-semibold text-ink hover:bg-paper"
                >
                  Load
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(deal.id, deal.name)}
                  className="cursor-pointer rounded-md px-3 py-1.5 text-body font-semibold text-loss hover:bg-loss/5"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}