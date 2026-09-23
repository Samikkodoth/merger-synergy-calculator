"use client";

import { useState } from "react";
import DealForm from "@/components/DealForm";
import ResultsTable from "@/components/ResultsTable";
import { calculateDeal } from "@/lib/api";
import type { DealInput, DealResults } from "@/lib/types";

export default function DealCalculator() {
  const [results, setResults] = useState<DealResults | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleCalculate(inputs: DealInput) {
    setIsLoading(true);
    setError("");
    try {
      const newResults = await calculateDeal(inputs);
      setResults(newResults);
    } catch (err) {
      setResults(null);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-10">
      <DealForm onCalculate={handleCalculate} isLoading={isLoading} />

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {results && <ResultsTable results={results} />}
    </div>
  );
}