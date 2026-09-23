type YearToggleProps = {
  years: number[];
  selectedIndex: number;
  onSelect: (index: number) => void;
};

export default function YearToggle({ years, selectedIndex, onSelect }: YearToggleProps) {
  return (
    <div role="group" aria-label="Choose a year" className="inline-flex rounded-md border border-rule p-0.5">
      {years.map((year, index) => (
        <button
          key={year}
          type="button"
          aria-pressed={index === selectedIndex}
          onClick={() => onSelect(index)}
          className={`cursor-pointer rounded px-3 py-1 text-body font-semibold ${
            index === selectedIndex ? "bg-ink text-white" : "text-ink-soft hover:text-ink"
          }`}
        >
          Year {year}
        </button>
      ))}
    </div>
  );
}