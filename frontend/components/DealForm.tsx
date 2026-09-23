import NumberField from "@/components/NumberField";
import { SCHEDULES, SECTIONS, sumOfTexts } from "@/lib/dealForm";

type DealFormProps = {
  values: Record<string, string>;
  schedules: Record<string, string[]>;
  onValueChange: (key: string, text: string) => void;
  onScheduleChange: (key: string, yearIndex: number, text: string) => void;
};

function TotalCheck({ total, what }: { total: number | null; what: string }) {
  if (total === null) return null;
  const isOk = Math.abs(total - 100) < 0.001;
  return (
    <p className={`mt-3 text-body ${isOk ? "text-gain" : "text-loss"}`}>
      {isOk
        ? `✓ ${what} add up to 100%`
        : `${what} add up to ${Number(total.toFixed(2))}%. They need to add up to 100%.`}
    </p>
  );
}

export default function DealForm({ values, schedules, onValueChange, onScheduleChange }: DealFormProps) {
  const paymentTotal = sumOfTexts([values.pct_stock, values.pct_cash, values.pct_debt]);

  return (
    <div className="space-y-8">
      {SECTIONS.map((section) => (
        <fieldset key={section.id}>
          <legend className="text-heading font-semibold text-ink">{section.title}</legend>
          <div className="mt-3 grid grid-cols-2 gap-4">
            {section.fields.map((field) => (
              <NumberField
                key={field.key}
                id={field.key}
                label={field.label}
                prefix={field.prefix}
                suffix={field.suffix}
                hint={field.hint}
                value={values[field.key]}
                onChange={(text) => onValueChange(field.key, text)}
              />
            ))}
          </div>
          {section.id === "financing" && <TotalCheck total={paymentTotal} what="Stock, cash and debt" />}
        </fieldset>
      ))}

      <fieldset>
        <legend className="text-heading font-semibold text-ink">Timing</legend>
        <p className="mt-1 text-caption text-ink-soft">
          How much of each amount happens in each year after the deal closes.
        </p>
        <div className="mt-4 space-y-5">
          {SCHEDULES.map((schedule) => (
            <div key={schedule.key}>
              <p className="text-body font-semibold text-ink">{schedule.label}</p>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {schedules[schedule.key].map((text, yearIndex) => (
                  <NumberField
                    key={yearIndex}
                    id={`${schedule.key}-${yearIndex}`}
                    label={`Year ${yearIndex + 1}`}
                    suffix="%"
                    value={text}
                    onChange={(newText) => onScheduleChange(schedule.key, yearIndex, newText)}
                  />
                ))}
              </div>
              {schedule.mustTotal100 && (
                <TotalCheck total={sumOfTexts(schedules[schedule.key])} what="The yearly amounts" />
              )}
            </div>
          ))}
        </div>
      </fieldset>
    </div>
  );
}