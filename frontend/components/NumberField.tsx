type NumberFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (text: string) => void;
  prefix?: string;
  suffix?: string;
  hint?: string;
};

export default function NumberField({ id, label, value, onChange, prefix, suffix, hint }: NumberFieldProps) {
  const isEmpty = value.trim() === "";

  return (
    <div>
      <label htmlFor={id} className="block text-body text-ink-soft">
        {label}
      </label>
      <div
        className={`mt-1.5 flex items-center rounded-md border bg-white transition-colors focus-within:border-ink focus-within:ring-2 focus-within:ring-ink/15 ${
          isEmpty ? "border-loss" : "border-rule"
        }`}
      >
        {prefix && <span className="pl-3 text-body text-ink-soft">{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step="any"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={isEmpty}
          className="w-full min-w-0 bg-transparent px-3 py-2 text-right text-body tabular-nums text-ink outline-none"
        />
        {suffix && <span className="pr-3 text-body text-ink-soft">{suffix}</span>}
      </div>
      {hint && <p className="mt-1 text-caption text-ink-soft">{hint}</p>}
    </div>
  );
}