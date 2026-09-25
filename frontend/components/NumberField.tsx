import { useState } from "react";
import SourceBadge, { SourceDetails } from "@/components/SourceBadge";
import type { FieldSource } from "@/lib/types";

type NumberFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (text: string) => void;
  prefix?: string;
  suffix?: string;
  hint?: string;
  /** Blank is allowed (it means "not entered") */
  optional?: boolean;
  type?: "number" | "text";
  /** Where an auto-filled value came from */
  source?: FieldSource;
  onConfirm?: () => void;
};

export default function NumberField({
  id, label, value, onChange, prefix, suffix, hint, optional = false, type = "number", source, onConfirm,
}: NumberFieldProps) {
  const [showSource, setShowSource] = useState(false);
  const isEmpty = value.trim() === "";
  const isInvalid = isEmpty && !optional;
  const hintId = hint ? `${id}-hint` : undefined;
  const sourceId = `${id}-source`;

  return (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-2">
        <label htmlFor={id} className="block text-body text-ink-soft">
          {label}
        </label>
        {source && (
          <SourceBadge source={source} open={showSource} onToggle={() => setShowSource(!showSource)} controls={sourceId} />
        )}
      </div>
      <div
        className={`mt-1.5 flex items-center rounded-md border bg-white transition-colors focus-within:border-ink focus-within:ring-2 focus-within:ring-ink/15 ${
          isInvalid ? "border-loss" : "border-rule"
        }`}
      >
        {prefix && <span className="pl-3 text-body text-ink-soft">{prefix}</span>}
        <input
          id={id}
          type={type}
          inputMode={type === "number" ? "decimal" : undefined}
          step="any"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={isInvalid}
          aria-describedby={hintId}
          className={`w-full min-w-0 bg-transparent px-3 py-2 text-body text-ink outline-none ${
            type === "number" ? "text-right tabular-nums" : "text-left"
          }`}
        />
        {suffix && <span className="pr-3 text-body whitespace-nowrap text-ink-soft">{suffix}</span>}
      </div>
      {hint && (
        <p id={hintId} className="mt-1 text-caption text-ink-soft">
          {hint}
        </p>
      )}
      {source && showSource && (
        <SourceDetails
          id={sourceId}
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
