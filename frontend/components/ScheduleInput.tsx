"use client";

import { useState } from "react";
import SourceBadge, { SourceDetails } from "@/components/SourceBadge";
import { sumOfTexts } from "@/lib/dealForm";
import type { FieldSource } from "@/lib/types";

type ScheduleInputProps = {
  id: string;
  label: string;
  texts: string[];
  onChange: (yearIndex: number | "all", text: string) => void;
  hint?: string;
  mustTotal100?: boolean;
  oneRate?: boolean;
  optional?: boolean;
  source?: FieldSource;
  onConfirm?: () => void;
};

export function TotalCheck({ total, what }: { total: number | null; what: string }) {
  if (total === null) return null;
  const isOk = Math.abs(total - 100) < 0.001;
  return (
    <p className={`mt-2 text-body ${isOk ? "text-gain" : "text-loss"}`}>
      {isOk
        ? `✓ ${what} add up to 100%`
        : `${what} add up to ${Number(total.toFixed(2))}%. They need to add up to 100%.`}
    </p>
  );
}

const inputClass =
  "w-full min-w-0 rounded-md border bg-white px-2 py-2 text-right text-body tabular-nums text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/15";

/** Five yearly percentages. "One rate" schedules show a single box until expanded. */
export default function ScheduleInput({
  id, label, texts, onChange, hint, mustTotal100, oneRate, optional, source, onConfirm,
}: ScheduleInputProps) {
  const [showSource, setShowSource] = useState(false);
  const allSame = texts.every((text) => text === texts[0]);
  const [expanded, setExpanded] = useState(!oneRate || !allSame);
  const isBlank = (text: string) => text.trim() === "" && !optional;

  return (
    <div className="col-span-2">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-start gap-2">
          <p id={`${id}-label`} className="text-body text-ink-soft">
            {label}
          </p>
          {source && (
            <SourceBadge
              source={source}
              open={showSource}
              onToggle={() => setShowSource(!showSource)}
              controls={`${id}-source`}
            />
          )}
        </div>
        {oneRate && (
          <button
            type="button"
            onClick={() => {
              if (expanded) onChange("all", texts[0]);
              setExpanded(!expanded);
            }}
            className="cursor-pointer text-caption font-semibold text-ink underline-offset-2 hover:underline"
          >
            {expanded ? "Same every year" : "Vary by year"}
          </button>
        )}
      </div>

      {expanded ? (
        <div role="group" aria-labelledby={`${id}-label`} className="mt-1.5 grid grid-cols-5 gap-1.5">
          {texts.map((text, yearIndex) => (
            <div key={yearIndex}>
              <label htmlFor={`${id}-${yearIndex}`} className="block text-caption text-ink-soft">
                Y{yearIndex + 1} %
              </label>
              <input
                id={`${id}-${yearIndex}`}
                type="number"
                inputMode="decimal"
                step="any"
                value={text}
                onChange={(event) => onChange(yearIndex, event.target.value)}
                aria-invalid={isBlank(text)}
                className={`${inputClass} ${isBlank(text) ? "border-loss" : "border-rule"}`}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-1.5 flex items-center rounded-md border border-rule bg-white focus-within:border-ink focus-within:ring-2 focus-within:ring-ink/15">
          <input
            id={id}
            aria-labelledby={`${id}-label`}
            type="number"
            inputMode="decimal"
            step="any"
            value={texts[0]}
            placeholder={optional ? "Base year" : undefined}
            onChange={(event) => onChange("all", event.target.value)}
            className="w-full min-w-0 bg-transparent px-3 py-2 text-right text-body tabular-nums text-ink outline-none"
          />
          <span className="pr-3 text-body text-ink-soft">% a year</span>
        </div>
      )}
      {hint && <p className="mt-1 text-caption text-ink-soft">{hint}</p>}
      {mustTotal100 && <TotalCheck total={sumOfTexts(texts)} what="The yearly amounts" />}
      {source && showSource && (
        <SourceDetails
          id={`${id}-source`}
          source={source}
          onConfirm={onConfirm && (() => {
            onConfirm();
            setShowSource(false);
          })}
        />
      )}
    </div>
  );
}
