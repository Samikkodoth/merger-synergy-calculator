import ApiStatus from "@/components/ApiStatus";
import DealCalculator from "@/components/DealCalculator";

export default function Home() {
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule bg-white px-6 py-4">
        <div>
          <h1 className="text-heading font-semibold text-ink">Merger Synergy Calculator</h1>
          <p className="text-body text-ink-soft">
            See whether a deal raises or lowers the buyer&apos;s earnings per share.
          </p>
        </div>
        <ApiStatus />
      </header>
      <DealCalculator />
    </>
  );
}