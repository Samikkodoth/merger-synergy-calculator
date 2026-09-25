import NumberField from "@/components/NumberField";
import { EMPTY_TRANCHE, MAX_TRANCHES, TRANCHE_FIELDS, unitSuffix, type TrancheText } from "@/lib/dealForm";
import type { Currency } from "@/lib/types";

type TranchesEditorProps = {
  tranches: TrancheText[];
  currency: Currency;
  onChange: (tranches: TrancheText[]) => void;
};

export default function TranchesEditor({ tranches, currency, onChange }: TranchesEditorProps) {
  function update(index: number, key: keyof TrancheText, text: string) {
    onChange(tranches.map((tranche, i) => (i === index ? { ...tranche, [key]: text } : tranche)));
  }

  return (
    <div className="col-span-2 space-y-4">
      {tranches.map((tranche, index) => (
        <fieldset key={index} className="relative rounded-md border border-rule p-3">
          <legend className="px-1 text-body font-semibold text-ink">Tranche {index + 1}</legend>
          <button
            type="button"
            onClick={() => onChange(tranches.filter((_, i) => i !== index))}
            aria-label={`Remove tranche ${index + 1}`}
            className="absolute top-2 right-3 cursor-pointer text-caption font-semibold text-loss hover:underline"
          >
            Remove
          </button>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {TRANCHE_FIELDS.map((field) => (
              <NumberField
                key={field.key}
                id={`tranche-${index}-${field.key}`}
                label={field.label}
                type={field.kind === "text" ? "text" : "number"}
                optional={field.kind === "text"}
                value={tranche[field.key]}
                onChange={(text) => update(index, field.key, text)}
                {...unitSuffix(field.kind, currency)}
              />
            ))}
          </div>
        </fieldset>
      ))}
      {tranches.length < MAX_TRANCHES && (
        <button
          type="button"
          onClick={() => onChange([...tranches, { ...EMPTY_TRANCHE, name: `Tranche ${tranches.length + 1}` }])}
          className="cursor-pointer rounded-md border border-rule px-3 py-1.5 text-body font-semibold text-ink hover:bg-paper"
        >
          Add a debt tranche
        </button>
      )}
      <p className="text-caption text-ink-soft">
        Interest is charged on each year&apos;s opening balance. Fees are spread over the term.
      </p>
    </div>
  );
}
