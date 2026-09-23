"use client";

import { useEffect, useMemo, useState } from "react";
import DealForm from "@/components/DealForm";
import ResultsTable from "@/components/ResultsTable";
import SavedDealsList from "@/components/SavedDealsList";
import Tombstone from "@/components/Tombstone";
import YearStrip from "@/components/YearStrip";
import { calculateDeal, deleteDeal, getDeal, listDeals, saveDeal } from "@/lib/api";
import {
  DEFAULT_DEAL_NAME,
  DEFAULT_SCHEDULES,
  DEFAULT_VALUES,
  buildDealInput,
  schedulesFromInputs,
  valuesFromInputs,
} from "@/lib/dealForm";
import type { DealInput, DealResults, SavedDealSummary } from "@/lib/types";

type Calculation = {
  inputs: DealInput;
  results: DealResults;
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

export default function DealCalculator() {
  // What the user has typed
  const [dealName, setDealName] = useState(DEFAULT_DEAL_NAME);
  const [values, setValues] = useState(DEFAULT_VALUES);
  const [schedules, setSchedules] = useState(DEFAULT_SCHEDULES);

  // The latest results, together with the inputs that produced them
  const [calculation, setCalculation] = useState<Calculation | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState("");

  // Saved deals
  const [savedDeals, setSavedDeals] = useState<SavedDealSummary[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");

  // Convert the typed text into API numbers, only when the text changes
  const inputs = useMemo(() => buildDealInput(values, schedules), [values, schedules]);

  // Recalculate automatically, shortly after the user stops typing
  useEffect(() => {
    if (inputs === null) return;
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setIsCalculating(true);
      try {
        const results = await calculateDeal(inputs);
        if (!cancelled) {
          setCalculation({ inputs, results });
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        setIsCalculating(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [inputs]);

  // Load the saved deals list once, when the page opens
  useEffect(() => {
    listDeals()
      .then(setSavedDeals)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3000);
  }

  function updateValue(key: string, text: string) {
    setValues({ ...values, [key]: text });
  }

  function updateSchedule(key: string, yearIndex: number, text: string) {
    const updated = [...schedules[key]];
    updated[yearIndex] = text;
    setSchedules({ ...schedules, [key]: updated });
  }

  function resetToExample() {
    setDealName(DEFAULT_DEAL_NAME);
    setValues(DEFAULT_VALUES);
    setSchedules(DEFAULT_SCHEDULES);
  }

  async function handleSave() {
    if (inputs === null || dealName.trim() === "") return;
    setIsSaving(true);
    try {
      const saved = await saveDeal(dealName.trim(), inputs);
      showNotice(`Saved "${saved.name}"`);
      setSavedDeals(await listDeals());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLoad(id: number) {
    try {
      const deal = await getDeal(id);
      setDealName(deal.name);
      setValues(valuesFromInputs(deal.inputs));
      setSchedules(schedulesFromInputs(deal.inputs));
      setCalculation({ inputs: deal.inputs, results: deal.results });
      showNotice(`Loaded "${deal.name}"`);
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return;
    try {
      await deleteDeal(id);
      showNotice(`Deleted "${name}"`);
      setSavedDeals(await listDeals());
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const canSave = inputs !== null && dealName.trim() !== "" && !isSaving;
  const isStale = inputs === null || isCalculating || error !== "";

  return (
    <div className="lg:grid lg:grid-cols-[400px_minmax(0,1fr)]">
      {/* Left: inputs */}
      <aside className="border-b border-rule bg-white lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-r lg:border-b-0">
        <div className="space-y-8 p-6">
          <div>
            <label htmlFor="deal-name" className="block text-body text-ink-soft">
              Deal name
            </label>
            <input
              id="deal-name"
              type="text"
              value={dealName}
              maxLength={200}
              onChange={(event) => setDealName(event.target.value)}
              className="mt-1 w-full border-b border-rule bg-transparent pb-1 text-heading font-semibold text-ink outline-none focus:border-ink"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="cursor-pointer rounded-md bg-ink px-4 py-2 text-body font-semibold text-white hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSaving ? "Saving…" : "Save deal"}
              </button>
              <button
                type="button"
                onClick={resetToExample}
                className="cursor-pointer rounded-md border border-rule px-4 py-2 text-body font-semibold text-ink hover:bg-paper"
              >
                Reset to example
              </button>
            </div>
          </div>

          <DealForm
            values={values}
            schedules={schedules}
            onValueChange={updateValue}
            onScheduleChange={updateSchedule}
          />
        </div>
      </aside>

      {/* Right: results */}
      <main className="min-w-0 space-y-10 p-6 lg:p-10">
        {error && (
          <p role="alert" className="rounded-md border border-loss/30 bg-loss/5 px-4 py-3 text-body text-loss">
            {error}
          </p>
        )}
        {inputs === null && (
          <p className="rounded-md border border-rule bg-white px-4 py-3 text-body text-ink-soft">
            Some fields are empty. Fill them in and the results will update.
          </p>
        )}

        {calculation === null ? (
          <p className="text-body text-ink-soft">Calculating…</p>
        ) : (
          <div className={`space-y-10 transition-opacity duration-200 ${isStale ? "opacity-50" : "opacity-100"}`}>
            <Tombstone dealName={dealName} inputs={calculation.inputs} results={calculation.results} />
            <YearStrip results={calculation.results} isUpdating={isCalculating} />
            <details className="rounded-lg border border-rule bg-white">
              <summary className="cursor-pointer px-5 py-4 text-body font-semibold text-ink">
                Show the numbers
              </summary>
              <div className="border-t border-rule">
                <ResultsTable results={calculation.results} />
              </div>
            </details>
          </div>
        )}

        <SavedDealsList deals={savedDeals} onLoad={handleLoad} onDelete={handleDelete} />
      </main>

      {notice && (
        <div role="status" className="fixed right-6 bottom-6 rounded-md bg-ink px-4 py-3 text-body text-white shadow-lg">
          {notice}
        </div>
      )}
    </div>
  );
}