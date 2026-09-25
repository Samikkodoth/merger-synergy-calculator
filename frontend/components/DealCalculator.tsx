"use client";

import { useEffect, useMemo, useState } from "react";
import CompanyLookup from "@/components/CompanyLookup";
import CreditPanel from "@/components/CreditPanel";
import DealForm from "@/components/DealForm";
import EpsBridge from "@/components/EpsBridge";
import IssuesList from "@/components/IssuesList";
import OwnershipPanel from "@/components/OwnershipPanel";
import PremiumPanel from "@/components/PremiumPanel";
import ResultsTable from "@/components/ResultsTable";
import SavedDealsList from "@/components/SavedDealsList";
import SensitivityTable, { AXIS_PRESETS, type AxisPair } from "@/components/SensitivityTable";
import SourcesUsesPanel from "@/components/SourcesUsesPanel";
import SynergyTimeline from "@/components/SynergyTimeline";
import Tombstone from "@/components/Tombstone";
import ValuePanel from "@/components/ValuePanel";
import YearStrip from "@/components/YearStrip";
import {
  calculateDeal, calculateSensitivity, deleteDeal, downloadExcel, getDeal, listDeals, saveDeal,
} from "@/lib/api";
import { confirmField, markEdited } from "@/lib/companyData";
import {
  DEFAULT_DEAL_NAME, DEFAULT_FORM, YEARS, applyValueEdit, buildDealInput, dataSources, formFromInputs, switchMode,
  type FormState, type TrancheText,
} from "@/lib/dealForm";
import type { AxisKey, Currency, DealInput, DealResults, Mode, SavedDealSummary, Sensitivity } from "@/lib/types";

type Calculation = {
  inputs: DealInput;
  results: DealResults;
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

/** Which sensitivity axes make sense for this deal. */
function availableAxes(input: DealInput | null): AxisKey[] {
  const axes: AxisKey[] = ["price", "synergies", "pct_stock"];
  if (input === null) return axes;
  const hasDebt = input.mode === "simple" || input.funding.tranches.length > 0;
  if (hasDebt) axes.push("debt_rate", "pct_debt");
  if (input.mode === "advanced" && input.target.unaffected_price > 0) axes.push("premium");
  if (input.mode === "advanced" && input.stake.open_offer_pct > 0) axes.push("acceptance");
  return axes;
}

function usablePair(pair: AxisPair, available: AxisKey[]): AxisPair {
  if (available.includes(pair.x) && available.includes(pair.y)) return pair;
  const preset = AXIS_PRESETS.find((p) => p.needs.every((key) => available.includes(key)));
  return preset?.pair ?? { x: "price", y: "synergies" };
}

export default function DealCalculator() {
  // What the user has typed
  const [dealName, setDealName] = useState(DEFAULT_DEAL_NAME);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [chosenPair, setChosenPair] = useState<AxisPair>({ x: "price", y: "synergies" });

  // The latest results, together with the inputs that produced them
  const [calculation, setCalculation] = useState<Calculation | null>(null);
  const [sensitivity, setSensitivity] = useState<Sensitivity | null>(null);
  const [sensitivityError, setSensitivityError] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState("");

  // Saved deals
  const [savedDeals, setSavedDeals] = useState<SavedDealSummary[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [notice, setNotice] = useState("");

  // Convert the typed text into API numbers, only when the text changes
  const { input, missing } = useMemo(() => buildDealInput(form), [form]);
  const available = useMemo(() => availableAxes(input), [input]);
  const pair = usablePair(chosenPair, available);

  // Recalculate automatically, shortly after the user stops typing
  useEffect(() => {
    if (input === null) return;
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setIsCalculating(true);
      try {
        const results = await calculateDeal(input);
        if (!cancelled) {
          setCalculation({ inputs: input, results });
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
  }, [input]);

  // The sensitivity grid: one request per grid, rerun when inputs or axes change
  useEffect(() => {
    if (input === null) return;
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      try {
        const grid = await calculateSensitivity(input, pair.x, pair.y);
        if (!cancelled) {
          setSensitivity(grid);
          setSensitivityError("");
        }
      } catch (err) {
        if (!cancelled) setSensitivityError(errorMessage(err));
      }
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [input, pair.x, pair.y]);

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

  function updateValue(path: string, text: string) {
    // Typing the premium sets the offer price, so that counts as an edit to it too
    const edited = path === "offer.premium" ? [path, "offer.offer_price"] : [path];
    setForm((current) => markEdited(applyValueEdit(current, path, text), edited));
  }

  function updateSchedule(path: string, yearIndex: number | "all", text: string) {
    setForm((current) => {
      const updated = yearIndex === "all" ? Array(YEARS).fill(text) : [...current.schedules[path]];
      if (yearIndex !== "all") updated[yearIndex] = text;
      return markEdited({ ...current, schedules: { ...current.schedules, [path]: updated } }, [path]);
    });
  }

  function confirmSource(path: string) {
    setForm((current) => confirmField(current, path));
  }

  function updateChoice(path: string, value: string) {
    setForm((current) => ({ ...current, choices: { ...current.choices, [path]: value } }));
  }

  function updateTranches(tranches: TrancheText[]) {
    setForm((current) => {
      const choices = { ...current.choices };
      // A balancing tranche that was removed can't balance anything
      const plug = choices["funding.balancing_item"];
      if (plug.startsWith("tranche_") && Number(plug.slice(-1)) > tranches.length) choices["funding.balancing_item"] = "none";
      return { ...current, tranches, choices };
    });
  }

  function updateMode(mode: Mode) {
    setForm((current) => switchMode(current, mode));
  }

  function updateCurrency(currency: Currency) {
    setForm((current) => ({ ...current, currency }));
  }

  function resetToExample() {
    setDealName(DEFAULT_DEAL_NAME);
    setForm(DEFAULT_FORM);
  }

  async function handleSave() {
    if (input === null || dealName.trim() === "") return;
    setIsSaving(true);
    try {
      const saved = await saveDeal(dealName.trim(), { ...input, data_sources: dataSources(form) });
      showNotice(`Saved "${saved.name}"`);
      setSavedDeals(await listDeals());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleExport() {
    if (input === null) return;
    setIsExporting(true);
    try {
      await downloadExcel(dealName.trim() || "Deal", input, pair.x, pair.y);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsExporting(false);
    }
  }

  async function handleLoad(id: number) {
    try {
      const deal = await getDeal(id);
      setDealName(deal.name);
      setForm(formFromInputs(deal.inputs));
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

  const canSave = input !== null && dealName.trim() !== "" && !isSaving;
  const isStale = input === null || isCalculating || error !== "";

  return (
    <div className="lg:grid lg:grid-cols-[400px_minmax(0,1fr)]">
      {/* Left: inputs */}
      <aside className="border-b border-rule bg-white lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-r lg:border-b-0">
        <div className="space-y-6 p-4 sm:p-6">
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
            <div className="mt-4 flex flex-wrap gap-2">
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
                onClick={handleExport}
                disabled={input === null || isExporting}
                className="cursor-pointer rounded-md border border-rule px-4 py-2 text-body font-semibold text-ink hover:bg-paper disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isExporting ? "Preparing…" : "Download Excel"}
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

          <CompanyLookup form={form} onApply={setForm} />

          <DealForm
            state={form}
            onConfirmSource={confirmSource}
            onValueChange={updateValue}
            onScheduleChange={updateSchedule}
            onChoiceChange={updateChoice}
            onTranchesChange={updateTranches}
            onModeChange={updateMode}
            onCurrencyChange={updateCurrency}
          />
        </div>
      </aside>

      {/* Right: results */}
      <main className="min-w-0 space-y-8 p-4 sm:p-6 lg:p-10">
        {error && (
          <p role="alert" className="rounded-md border border-loss/30 bg-loss/5 px-4 py-3 text-body text-loss">
            {error}
          </p>
        )}
        {input === null && (
          <p className="rounded-md border border-rule bg-white px-4 py-3 text-body text-ink-soft">
            Some fields are empty: {missing.join(", ")}. Fill them in and the results will update.
          </p>
        )}

        {calculation === null ? (
          <p className="text-body text-ink-soft">
            Loading the calculator. After a quiet period, the first load can take up to a minute while the
            server wakes up.
          </p>
        ) : (
          <div className={`space-y-8 transition-opacity duration-200 ${isStale ? "opacity-50" : "opacity-100"}`}>
            <Tombstone dealName={dealName} results={calculation.results} />
            <IssuesList issues={calculation.results.issues} />
            <YearStrip results={calculation.results} isUpdating={isCalculating} />
            <EpsBridge results={calculation.results} />
            <div className="grid gap-8 xl:grid-cols-2">
              <PremiumPanel results={calculation.results} />
              <SourcesUsesPanel results={calculation.results} />
              <OwnershipPanel results={calculation.results} />
              <ValuePanel results={calculation.results} />
            </div>
            <CreditPanel results={calculation.results} thresholds={calculation.inputs.thresholds} />
            <SynergyTimeline results={calculation.results} />
            <SensitivityTable
              sensitivity={sensitivity}
              pair={pair}
              available={available}
              onPairChange={setChosenPair}
              error={sensitivityError}
            />
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
