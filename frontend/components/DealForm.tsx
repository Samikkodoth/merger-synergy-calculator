"use client";

import { useState } from "react";
import NumberField from "@/components/NumberField";
import ScheduleInput, { TotalCheck } from "@/components/ScheduleInput";
import SelectField from "@/components/SelectField";
import TranchesEditor from "@/components/TranchesEditor";
import { needsAttention } from "@/lib/companyData";
import {
  TABS, isVisible, kindOf, sumOfTexts, tabPaths, unitSuffix,
  type FormState, type Item, type TrancheText,
} from "@/lib/dealForm";
import type { Currency, Mode } from "@/lib/types";

type DealFormProps = {
  state: FormState;
  onValueChange: (path: string, text: string) => void;
  onScheduleChange: (path: string, yearIndex: number | "all", text: string) => void;
  onChoiceChange: (path: string, value: string) => void;
  onTranchesChange: (tranches: TrancheText[]) => void;
  onModeChange: (mode: Mode) => void;
  onCurrencyChange: (currency: Currency) => void;
  onConfirmSource: (path: string) => void;
};

function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const options: { value: Mode; label: string }[] = [
    { value: "simple", label: "Simple" },
    { value: "advanced", label: "Advanced" },
  ];
  return (
    <div role="group" aria-label="Model detail" className="inline-flex rounded-md border border-rule p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={mode === option.value}
          onClick={() => onChange(option.value)}
          className={`cursor-pointer rounded px-3 py-1 text-body font-semibold ${
            mode === option.value ? "bg-ink text-white" : "text-ink-soft hover:text-ink"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function DealForm(props: DealFormProps) {
  const {
    state, onValueChange, onScheduleChange, onChoiceChange, onTranchesChange, onModeChange, onCurrencyChange,
    onConfirmSource,
  } = props;
  const { mode, currency } = state;
  const tabs = TABS.filter((tab) => isVisible(tab, mode));
  const [tabId, setTabId] = useState(tabs[0].id);
  const activeTab = tabs.find((tab) => tab.id === tabId) ?? tabs[0];

  function renderItem(item: Item) {
    if (!isVisible(item, mode)) return null;
    switch (item.type) {
      case "field": {
        const kind = kindOf(item, state.choices);
        return (
          <NumberField
            key={item.path}
            id={item.path}
            label={item.label}
            hint={item.hint}
            optional={item.optional}
            value={state.values[item.path] ?? ""}
            onChange={(text) => onValueChange(item.path, text)}
            source={state.sources[item.path]}
            onConfirm={() => onConfirmSource(item.path)}
            {...unitSuffix(kind, currency)}
          />
        );
      }
      case "schedule":
        return (
          <ScheduleInput
            key={`${item.path}-${mode}`}
            id={item.path}
            label={item.label}
            hint={item.hint}
            mustTotal100={item.mustTotal100}
            oneRate={item.oneRate}
            optional={item.optional}
            texts={state.schedules[item.path]}
            onChange={(yearIndex, text) => onScheduleChange(item.path, yearIndex, text)}
            source={state.sources[item.path]}
            onConfirm={() => onConfirmSource(item.path)}
          />
        );
      case "choice":
        return (
          <SelectField
            key={item.path}
            id={item.path}
            label={item.label}
            hint={item.hint}
            value={state.choices[item.path]}
            options={item.options.map((option) => ({
              ...option,
              disabled: option.value.startsWith("tranche_") && Number(option.value.slice(-1)) > state.tranches.length,
            }))}
            onChange={(value) => onChoiceChange(item.path, value)}
          />
        );
      case "premium":
        return (
          <div key="premium" className="col-span-2 grid grid-cols-2 gap-4">
            <NumberField
              id="offer.offer_price"
              label="Offer price"
              value={state.values["offer.offer_price"] ?? ""}
              onChange={(text) => onValueChange("offer.offer_price", text)}
              source={state.sources["offer.offer_price"]}
              {...unitSuffix("price", currency)}
            />
            <NumberField
              id="offer.premium"
              label="Premium"
              optional
              hint="Type either one"
              value={state.values["offer.premium"] ?? ""}
              onChange={(text) => onValueChange("offer.premium", text)}
              suffix="%"
            />
          </div>
        );
      case "tranches":
        return <TranchesEditor key="tranches" tranches={state.tranches} currency={currency} onChange={onTranchesChange} />;
      case "mix-check": {
        const total = sumOfTexts([
          state.values["offer.pct_stock"], state.values["funding.mix.pct_cash"], state.values["funding.mix.pct_debt"],
        ]);
        return (
          <div key="mix-check" className="col-span-2 -mt-2">
            <TotalCheck total={total} what="Stock, cash and debt" />
          </div>
        );
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-caption text-ink-soft">Detail</p>
          <ModeSwitch mode={mode} onChange={onModeChange} />
        </div>
        <div className="w-40">
          <SelectField
            id="currency"
            label="Currency"
            value={currency}
            onChange={(value) => onCurrencyChange(value as Currency)}
            options={[
              { value: "USD", label: "USD ($M)" },
              { value: "INR", label: "INR (₹ crore)" },
            ]}
          />
        </div>
      </div>
      {mode === "simple" && (
        <p className="text-caption text-ink-soft">
          Simple mode: a purchase price paid with stock, cash and debt, and no growth, fees or purchase
          accounting. Switch to Advanced for the full model.
        </p>
      )}

      <div role="tablist" aria-label="Input sections" className="-mx-1 flex gap-1 overflow-x-auto border-b border-rule">
        {tabs.map((tab) => {
          const selected = tab.id === activeTab.id;
          const attention = tabPaths(tab).some((path) => needsAttention(state.sources[path]));
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setTabId(tab.id)}
              className={`relative -mb-px cursor-pointer border-b-2 px-2 py-2 text-body font-semibold whitespace-nowrap ${
                selected ? "border-ink text-ink" : "border-transparent text-ink-soft hover:text-ink"
              }`}
            >
              {tab.title}
              {attention && (
                <>
                  <span aria-hidden="true" className="ml-1 inline-block size-1.5 rounded-full bg-brass align-middle" />
                  <span className="sr-only"> (has fields to check)</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      <div id={`panel-${activeTab.id}`} role="tabpanel" aria-labelledby={`tab-${activeTab.id}`} className="space-y-8">
        {activeTab.groups
          .filter((group) => isVisible(group, mode))
          .map((group) => (
            <fieldset key={group.title}>
              <legend className="text-heading font-semibold text-ink">{group.title}</legend>
              {group.description && <p className="mt-1 text-caption text-ink-soft">{group.description}</p>}
              <div className="mt-3 grid grid-cols-2 gap-4">{group.items.map(renderItem)}</div>
            </fieldset>
          ))}
      </div>
    </div>
  );
}
