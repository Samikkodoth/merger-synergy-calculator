"use client";

import { useState } from "react";
import type { DealInput } from "@/lib/types";

type Unit = "millions" | "percent" | "number";

type Field = {
  key: string;
  label: string;
  unit: Unit;
};

const SECTIONS: { title: string; fields: Field[] }[] = [
  {
    title: "Acquirer (the buyer)",
    fields: [
      { key: "acquirer_net_income", label: "Net income ($M)", unit: "millions" },
      { key: "acquirer_shares", label: "Shares outstanding (millions)", unit: "millions" },
      { key: "acquirer_share_price", label: "Share price ($)", unit: "number" },
    ],
  },
  {
    title: "Target and price",
    fields: [
      { key: "target_net_income", label: "Target net income ($M)", unit: "millions" },
      { key: "purchase_price", label: "Purchase price ($M)", unit: "millions" },
      { key: "tax_rate", label: "Tax rate (%)", unit: "percent" },
    ],
  },
  {
    title: "How the deal is paid for",
    fields: [
      { key: "pct_stock", label: "Paid in stock (%)", unit: "percent" },
      { key: "pct_cash", label: "Paid in cash (%)", unit: "percent" },
      { key: "pct_debt", label: "Paid with debt (%)", unit: "percent" },
      { key: "interest_rate_on_cash", label: "Interest earned on cash (%)", unit: "percent" },
      { key: "interest_rate_on_debt", label: "Interest rate on debt (%)", unit: "percent" },
    ],
  },
  {
    title: "Synergies and integration costs",
    fields: [
      { key: "cost_synergies", label: "Cost synergies, full run-rate ($M/yr)", unit: "millions" },
      { key: "revenue_synergies", label: "Revenue synergies, full run-rate ($M/yr)", unit: "millions" },
      { key: "revenue_synergy_margin", label: "Profit margin on new revenue (%)", unit: "percent" },
      { key: "integration_costs", label: "Integration costs, one-time total ($M)", unit: "millions" },
    ],
  },
];

const SCHEDULES = [
  { key: "cost_synergy_phase_in", label: "Cost synergy phase-in (% of run-rate)" },
  { key: "revenue_synergy_phase_in", label: "Revenue synergy phase-in (% of run-rate)" },
  { key: "integration_cost_schedule", label: "Integration cost spread (% of total, must add to 100)" },
];

const DEFAULT_VALUES: Record<string, string> = {
  acquirer_net_income: "100",
  acquirer_shares: "50",
  acquirer_share_price: "40",
  target_net_income: "20",
  purchase_price: "300",
  tax_rate: "25",
  pct_stock: "50",
  pct_cash: "0",
  pct_debt: "50",
  interest_rate_on_cash: "4",
  interest_rate_on_debt: "7",
  cost_synergies: "15",
  revenue_synergies: "40",
  revenue_synergy_margin: "20",
  integration_costs: "30",
};

const DEFAULT_SCHEDULES: Record<string, string[]> = {
  cost_synergy_phase_in: ["50", "75", "100"],
  revenue_synergy_phase_in: ["0", "50", "100"],
  integration_cost_schedule: ["60", "30", "10"],
};

function isValidNumber(text: string): boolean {
  return text.trim() !== "" && !Number.isNaN(Number(text));
}

function toApiNumber(text: string, unit: Unit): number {
  const value = Number(text);
  if (unit === "millions") return value * 1_000_000;
  if (unit === "percent") return value / 100;
  return value;
}

function buildDealInput(
  values: Record<string, string>,
  schedules: Record<string, string[]>,
): DealInput | null {
  const result: Record<string, number | number[]> = {};

  for (const section of SECTIONS) {
    for (const field of section.fields) {
      const text = values[field.key];
      if (!isValidNumber(text)) return null;
      result[field.key] = toApiNumber(text, field.unit);
    }
  }

  for (const schedule of SCHEDULES) {
    const texts = schedules[schedule.key];
    if (!texts.every(isValidNumber)) return null;
    result[schedule.key] = texts.map((text) => toApiNumber(text, "percent"));
  }

  return result as DealInput;
}

type DealFormProps = {
  onCalculate: (inputs: DealInput) => void;
  isLoading: boolean;
};

export default function DealForm({ onCalculate, isLoading }: DealFormProps) {
  const [values, setValues] = useState(DEFAULT_VALUES);
  const [schedules, setSchedules] = useState(DEFAULT_SCHEDULES);
  const [formError, setFormError] = useState("");

  function updateValue(key: string, text: string) {
    setValues({ ...values, [key]: text });
  }

  function updateSchedule(key: string, yearIndex: number, text: string) {
    const updated = [...schedules[key]];
    updated[yearIndex] = text;
    setSchedules({ ...schedules, [key]: updated });
  }

  function handleCalculate() {
    const inputs = buildDealInput(values, schedules);
    if (inputs === null) {
      setFormError("Please fill in every field with a number.");
      return;
    }
    setFormError("");
    onCalculate(inputs);
  }

  return (
    <div className="space-y-6">
      {SECTIONS.map((section) => (
        <fieldset key={section.title} className="rounded-lg border border-gray-200 p-5">
          <legend className="px-1 text-sm font-semibold text-gray-700">{section.title}</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            {section.fields.map((field) => (
              <label key={field.key} className="block text-sm">
                <span className="text-gray-600">{field.label}</span>
                <input
                  type="number"
                  step="any"
                  value={values[field.key]}
                  onChange={(event) => updateValue(field.key, event.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none"
                />
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <fieldset className="rounded-lg border border-gray-200 p-5">
        <legend className="px-1 text-sm font-semibold text-gray-700">Year-by-year schedules (%)</legend>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500">
                <th className="pb-2 text-left font-medium">Schedule</th>
                <th className="pb-2 font-medium">Year 1</th>
                <th className="pb-2 font-medium">Year 2</th>
                <th className="pb-2 font-medium">Year 3</th>
              </tr>
            </thead>
            <tbody>
              {SCHEDULES.map((schedule) => (
                <tr key={schedule.key}>
                  <td className="py-2 pr-4 text-gray-600">{schedule.label}</td>
                  {schedules[schedule.key].map((text, yearIndex) => (
                    <td key={yearIndex} className="px-1 py-2 text-center">
                      <input
                        type="number"
                        step="any"
                        value={text}
                        onChange={(event) => updateSchedule(schedule.key, yearIndex, event.target.value)}
                        className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-center text-gray-900 focus:border-blue-500 focus:outline-none"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </fieldset>

      {formError && <p className="text-sm text-red-600">{formError}</p>}

      <button
        type="button"
        onClick={handleCalculate}
        disabled={isLoading}
        className="cursor-pointer rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? "Calculating..." : "Calculate"}
      </button>
    </div>
  );
}