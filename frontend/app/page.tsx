import ApiStatus from "@/components/ApiStatus";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold">Merger Synergy Calculator</h1>
        <p className="mt-3 text-gray-600">
          Estimate cost synergies, revenue synergies, integration costs, and EPS
          accretion or dilution for M&amp;A deals.
        </p>
        <div className="mt-8">
          <ApiStatus />
        </div>
      </div>
    </main>
  );
}