"use client";

import { useEffect, useState } from "react";
import DealForm from "@/components/DealForm";
import ResultsTable from "@/components/ResultsTable";
import SaveDealBox from "@/components/SaveDealBox";
import SavedDealsList from "@/components/SavedDealsList";
import { calculateDeal, deleteDeal, getDeal, listDeals, saveDeal } from "@/lib/api";
import type { DealInput, DealResults, SavedDealSummary } from "@/lib/types";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

export default function DealCalculator() {
  // The current calculation
  const [results, setResults] = useState<DealResults | null>(null);
  const [lastInputs, setLastInputs] = useState<DealInput | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Filling the form with a loaded deal
  const [formInputs, setFormInputs] = useState<DealInput | undefined>(undefined);
  const [formKey, setFormKey] = useState(0);

  // Saved deals
  const [savedDeals, setSavedDeals] = useState<SavedDealSummary[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Messages for the user
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Load the saved deals list once, when the page opens
  useEffect(() => {
    listDeals()
      .then(setSavedDeals)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  async function refreshSavedDeals() {
    setSavedDeals(await listDeals());
  }

  async function handleCalculate(inputs: DealInput) {
    setIsLoading(true);
    setError("");
    setNotice("");
    try {
      setResults(await calculateDeal(inputs));
      setLastInputs(inputs);
    } catch (err) {
      setResults(null);
      setLastInputs(null);
      setError(errorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave(name: string) {
    if (lastInputs === null) return;
    setIsSaving(true);
    setError("");
    try {
      const saved = await saveDeal(name, lastInputs);
      setNotice(`Saved "${saved.name}".`);
      await refreshSavedDeals();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLoad(id: number) {
    setError("");
    try {
      const deal = await getDeal(id);
      setFormInputs(deal.inputs);
      setFormKey(formKey + 1);
      setLastInputs(deal.inputs);
      setResults(deal.results);
      setNotice(`Loaded "${deal.name}".`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setError("");
    try {
      await deleteDeal(id);
      setNotice(`Deleted "${name}".`);
      await refreshSavedDeals();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-10">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {notice}
        </p>
      )}

      <DealForm
        key={formKey}
        initialInputs={formInputs}
        onCalculate={handleCalculate}
        isLoading={isLoading}
      />

      {results && (
        <>
          <ResultsTable results={results} />
          <SaveDealBox onSave={handleSave} isSaving={isSaving} />
        </>
      )}

      <SavedDealsList deals={savedDeals} onLoad={handleLoad} onDelete={handleDelete} />
    </div>
  );
}