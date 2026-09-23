import type { DealInput } from "@/lib/types";

export type Unit = "millions" | "percent" | "number";

export type Field = {
  key: string;
  label: string;
  unit: Unit;
  prefix?: string;
  suffix?: string;
  hint?: string;
};

export type Section = {
  id: string;
  title: string;
  fields: Field[];
};

export const SECTIONS: Section[] = [
  {
    id: "buyer",
    title: "The buyer",
    fields: [
      { key: "acquirer_net_income", label: "Net income", unit: "millions", prefix: "$", suffix: "M", hint: "Yearly profit after tax" },
      { key: "acquirer_shares", label: "Shares outstanding", unit: "millions", suffix: "M" },
      { key: "acquirer_share_price", label: "Share price", unit: "number", prefix: "$" },
    ],
  },
  {
    id: "target",
    title: "The target",
    fields: [
      { key: "target_net_income", label: "Net income", unit: "millions", prefix: "$", suffix: "M" },
      { key: "purchase_price", label: "Purchase price", unit: "millions", prefix: "$", suffix: "M", hint: "Total price paid" },
      { key: "tax_rate", label: "Tax rate", unit: "percent", suffix: "%" },
    ],
  },
  {
    id: "financing",
    title: "Financing",
    fields: [
      { key: "pct_stock", label: "Paid in stock", unit: "percent", suffix: "%" },
      { key: "pct_cash", label: "Paid in cash", unit: "percent", suffix: "%" },
      { key: "pct_debt", label: "Paid with debt", unit: "percent", suffix: "%" },
      { key: "interest_rate_on_cash", label: "Interest on cash", unit: "percent", suffix: "%", hint: "What the cash was earning" },
      { key: "interest_rate_on_debt", label: "Interest on debt", unit: "percent", suffix: "%" },
    ],
  },
  {
    id: "synergies",
    title: "Synergies and costs",
    fields: [
      { key: "cost_synergies", label: "Cost savings", unit: "millions", prefix: "$", suffix: "M", hint: "Per year, once fully achieved" },
      { key: "revenue_synergies", label: "Extra revenue", unit: "millions", prefix: "$", suffix: "M", hint: "Per year, once fully achieved" },
      { key: "revenue_synergy_margin", label: "Margin on extra revenue", unit: "percent", suffix: "%", hint: "Share kept as profit" },
      { key: "integration_costs", label: "Integration costs", unit: "millions", prefix: "$", suffix: "M", hint: "One-time total" },
    ],
  },
];

export const SCHEDULES = [
  { key: "cost_synergy_phase_in", label: "Cost savings reached", mustTotal100: false },
  { key: "revenue_synergy_phase_in", label: "Extra revenue reached", mustTotal100: false },
  { key: "integration_cost_schedule", label: "Integration costs spent", mustTotal100: true },
];

export const DEFAULT_DEAL_NAME = "Acme acquires Beta Corp";

export const DEFAULT_VALUES: Record<string, string> = {
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

export const DEFAULT_SCHEDULES: Record<string, string[]> = {
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

function fromApiNumber(value: number, unit: Unit): string {
  let converted = value;
  if (unit === "millions") converted = value / 1_000_000;
  if (unit === "percent") converted = value * 100;
  return String(Number(converted.toFixed(6)));
}

export function buildDealInput(
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

export function valuesFromInputs(inputs: DealInput): Record<string, string> {
  const raw = inputs as Record<string, number | number[]>;
  const values: Record<string, string> = {};
  for (const section of SECTIONS) {
    for (const field of section.fields) {
      values[field.key] = fromApiNumber(raw[field.key] as number, field.unit);
    }
  }
  return values;
}

export function schedulesFromInputs(inputs: DealInput): Record<string, string[]> {
  const raw = inputs as Record<string, number | number[]>;
  const schedules: Record<string, string[]> = {};
  for (const schedule of SCHEDULES) {
    schedules[schedule.key] = (raw[schedule.key] as number[]).map((value) =>
      fromApiNumber(value, "percent"),
    );
  }
  return schedules;
}

export function sumOfTexts(texts: string[]): number | null {
  if (!texts.every(isValidNumber)) return null;
  return texts.reduce((total, text) => total + Number(text), 0);
}