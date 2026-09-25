type SelectFieldProps = {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string; disabled?: boolean }[];
  onChange: (value: string) => void;
  hint?: string;
};

export default function SelectField({ id, label, value, options, onChange, hint }: SelectFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-body text-ink-soft">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={hintId}
        className="mt-1.5 w-full cursor-pointer rounded-md border border-rule bg-white px-3 py-2 text-body text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/15"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && (
        <p id={hintId} className="mt-1 text-caption text-ink-soft">
          {hint}
        </p>
      )}
    </div>
  );
}
