import type { SavedDealSummary } from "@/lib/types";

type SavedDealsListProps = {
  deals: SavedDealSummary[];
  onLoad: (id: number) => void;
  onDelete: (id: number, name: string) => void;
};

export default function SavedDealsList({ deals, onLoad, onDelete }: SavedDealsListProps) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Saved deals</h2>

      {deals.length === 0 ? (
        <p className="text-sm text-gray-500">No saved deals yet. Calculate a deal, then save it.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
          {deals.map((deal) => (
            <li key={deal.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium">{deal.name}</p>
                <p className="text-sm text-gray-500">
                  Saved {new Date(deal.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onLoad(deal.id)}
                  className="cursor-pointer rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  Load
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(deal.id, deal.name)}
                  className="cursor-pointer rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
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