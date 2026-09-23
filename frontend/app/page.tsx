import ApiStatus from "@/components/ApiStatus";
import DealCalculator from "@/components/DealCalculator";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-bold">Merger Synergy Calculator</h1>
        <p className="mt-3 text-gray-600">
          Estimate cost synergies, revenue synergies, integration costs, and EPS
          accretion or dilution for M&amp;A deals.
        </p>
        <div className="mt-6">
          <ApiStatus />
        </div>
        <div className="mt-10">
          <DealCalculator />
        </div>
      </div>
    </main>
  );
}