// The deal form: every input, which tab it lives on, whether it shows in simple
// or advanced mode, and how typed text converts to API numbers and back.
//
// The form keeps what the user typed as text, keyed by the input's path in the
// API shape (e.g. "acquirer.net_income"). Amounts are typed in $M or ₹ crore,
// percentages as 0-100.

import { CURRENCY } from "@/lib/format";
import type { Currency, DealInput, Mode, Tranche } from "@/lib/types";

export const YEARS = 5;

export type Kind = "amount" | "shares" | "percent" | "price" | "years" | "multiple";

type Visibility = { advanced?: boolean; simpleOnly?: boolean };

export type FieldItem = Visibility & {
  type: "field";
  path: string;
  label: string;
  kind: Kind;
  hint?: string;
  optional?: boolean;
};

export type ScheduleItem = Visibility & {
  type: "schedule";
  path: string;
  label: string;
  hint?: string;
  mustTotal100?: boolean;
  /** Shown as one rate for all years until the user expands it. */
  oneRate?: boolean;
  optional?: boolean;
};

export type ChoiceItem = Visibility & {
  type: "choice";
  path: string;
  label: string;
  options: { value: string; label: string }[];
  hint?: string;
};

export type SpecialItem = Visibility & {
  type: "premium" | "tranches" | "mix-check";
};

export type Item = FieldItem | ScheduleItem | ChoiceItem | SpecialItem;

export type Group = Visibility & { title: string; description?: string; items: Item[] };

export type Tab = Visibility & { id: string; title: string; groups: Group[] };

export type TrancheText = {
  name: string;
  amount: string;
  rate: string;
  term_years: string;
  amortization_pct: string;
  fee_pct: string;
};

export type FormState = {
  mode: Mode;
  currency: Currency;
  values: Record<string, string>;
  schedules: Record<string, string[]>;
  choices: Record<string, string>;
  tranches: TrancheText[];
};

// ---------------------------------------------------------------- Field list

const field = (path: string, label: string, kind: Kind, extra: Partial<FieldItem> = {}): FieldItem => ({
  type: "field", path, label, kind, ...extra,
});
const schedule = (path: string, label: string, extra: Partial<ScheduleItem> = {}): ScheduleItem => ({
  type: "schedule", path, label, ...extra,
});
const ADV = { advanced: true };

export const TABS: Tab[] = [
  {
    id: "terms",
    title: "Deal terms",
    groups: [
      {
        title: "The buyer",
        items: [
          field("acquirer.net_income", "Net income", "amount", {
            hint: "Latest yearly profit after tax, excluding any stake already held in the target",
          }),
          field("acquirer.diluted_shares", "Diluted shares", "shares"),
          field("acquirer.share_price", "Share price", "price"),
        ],
      },
      {
        title: "The target",
        items: [
          field("target.net_income", "Net income", "amount"),
          field("offer.purchase_price", "Purchase price", "amount", { simpleOnly: true, hint: "Total paid for the equity" }),
          field("target.diluted_shares", "Diluted shares", "shares", ADV),
          field("target.unaffected_price", "Unaffected share price", "price", {
            ...ADV, hint: "Last close before the deal was announced",
          }),
          { type: "premium", ...ADV },
          field("target.debt", "Debt", "amount", ADV),
          field("target.cash", "Cash", "amount", ADV),
          field("target.preferred_stock", "Preferred stock", "amount", ADV),
          field("target.minority_interest", "Minority interest", "amount", ADV),
          {
            type: "choice", path: "offer.debt_treatment", label: "Target debt", ...ADV,
            options: [
              { value: "assumed", label: "Assumed by the buyer" },
              { value: "refinanced", label: "Refinanced at close" },
            ],
          },
          field("tax_rate", "Tax rate", "percent", { hint: "Applies to all pre-tax items" }),
        ],
      },
      {
        title: "Stake",
        description: "For partial acquisitions and open offers. Leave at 100% bought for a full takeover.",
        ...ADV,
        items: [
          field("stake.existing_pct", "Already owned", "percent", {
            hint: "At 20%+, its share of target income is added to the buyer's standalone income",
          }),
          field("stake.bought_pct", "Bought at the offer price", "percent", { hint: "E.g. from the promoter" }),
          field("stake.open_offer_pct", "Open offer size", "percent", { hint: "% of all shares" }),
          field("stake.open_offer_price", "Open offer price", "price", { hint: "0 = same as the offer price" }),
          field("stake.acceptance_pct", "Expected acceptance", "percent"),
          {
            type: "choice", path: "stake.treatment", label: "Accounting",
            options: [
              { value: "auto", label: "Automatic (by stake)" },
              { value: "consolidate", label: "Consolidate" },
              { value: "equity", label: "Equity method" },
              { value: "investment", label: "Financial investment" },
            ],
            hint: "Automatic: above 50% consolidate, 20–50% equity method",
          },
          field("stake.synergies_inside_target_pct", "Synergies inside the target", "percent", {
            hint: "Share realised inside the target, which minority holders share",
          }),
        ],
      },
    ],
  },
  {
    id: "financing",
    title: "Financing",
    groups: [
      {
        title: "How the price is paid",
        items: [
          field("offer.pct_stock", "Paid in stock", "percent", { hint: "Acquirer shares given to target holders" }),
          field("funding.mix.pct_cash", "Paid in cash", "percent", { simpleOnly: true }),
          field("funding.mix.pct_debt", "Paid with debt", "percent", { simpleOnly: true }),
          { type: "mix-check", simpleOnly: true },
          field("acquirer.interest_rate_on_cash", "Interest on cash", "percent", { hint: "What the cash was earning" }),
          field("funding.mix.debt_rate", "Interest on debt", "percent", { simpleOnly: true }),
        ],
      },
      {
        title: "Cash and new equity",
        ...ADV,
        items: [
          field("acquirer.cash", "Acquirer cash balance", "amount", { optional: true, hint: "Leave blank to skip the cash check" }),
          field("acquirer.min_cash", "Minimum cash to keep", "amount"),
          field("funding.cash_used", "Cash on hand used", "amount"),
          field("funding.new_equity_amount", "New equity raised", "amount", { hint: "From investors, not target holders" }),
          field("funding.new_equity_price", "Issue price", "price", { hint: "0 = current share price" }),
          field("fees.advisory_pct", "Advisory fees", "percent", { hint: "% of enterprise value, one-time" }),
        ],
      },
      {
        title: "New debt",
        ...ADV,
        items: [
          { type: "tranches" },
          {
            type: "choice", path: "funding.balancing_item", label: "Balancing item",
            hint: "Sized automatically so sources equal uses",
            options: [
              { value: "none", label: "None (I'll balance it)" },
              { value: "cash", label: "Cash on hand" },
              { value: "tranche_1", label: "Tranche 1" },
              { value: "tranche_2", label: "Tranche 2" },
              { value: "tranche_3", label: "Tranche 3" },
            ],
          },
          field("funding.fcf_conversion_pct", "Cash sweep", "percent", {
            hint: "Share of cash net income used to repay debt early. A simplification; 0 = off",
          }),
        ],
      },
    ],
  },
  {
    id: "forecasts",
    title: "Forecasts",
    ...ADV,
    groups: [
      {
        title: "Acquirer standalone",
        description: "Accretion is measured against the acquirer's own forecast EPS for each year.",
        items: [
          field("acquirer.revenue", "Revenue", "amount"),
          field("acquirer.ebitda", "EBITDA", "amount"),
          schedule("acquirer.revenue_growth", "Revenue growth", { oneRate: true }),
          schedule("acquirer.net_income_growth", "Net income growth", { oneRate: true }),
          schedule("acquirer.ebitda_margin", "EBITDA margin", { oneRate: true, optional: true, hint: "Blank = base-year margin" }),
          field("acquirer.debt", "Existing debt", "amount"),
          field("acquirer.interest_expense", "Interest expense", "amount"),
        ],
      },
      {
        title: "Target standalone",
        items: [
          field("target.revenue", "Revenue", "amount"),
          field("target.ebitda", "EBITDA", "amount"),
          schedule("target.revenue_growth", "Revenue growth", { oneRate: true }),
          schedule("target.net_income_growth", "Net income growth", { oneRate: true }),
          schedule("target.ebitda_margin", "EBITDA margin", { oneRate: true, optional: true, hint: "Blank = base-year margin" }),
          field("target.interest_expense", "Interest expense", "amount", { hint: "Added back if the debt is refinanced" }),
        ],
      },
    ],
  },
  {
    id: "accounting",
    title: "Accounting",
    ...ADV,
    groups: [
      {
        title: "Purchase price allocation",
        description: "Leave book value blank to skip. Goodwill is not amortized.",
        items: [
          field("target.book_value", "Target book value", "amount", { optional: true }),
          {
            type: "choice", path: "ppa.intangibles_input", label: "Intangibles entered as",
            options: [
              { value: "amount", label: "An amount" },
              { value: "pct_of_excess", label: "% of excess price" },
            ],
          },
          field("ppa.intangibles", "Intangibles write-up", "amount"),
          field("ppa.intangibles_life", "Intangibles life", "years"),
          field("ppa.ppe_writeup", "PP&E write-up", "amount"),
          field("ppa.ppe_life", "PP&E life", "years"),
        ],
      },
      {
        title: "Credit limits",
        description: "Years that break these limits are flagged.",
        items: [
          field("thresholds.max_leverage", "Max total debt / EBITDA", "multiple"),
          field("thresholds.min_coverage", "Min EBITDA / interest", "multiple"),
        ],
      },
    ],
  },
  {
    id: "synergies",
    title: "Synergies",
    groups: [
      {
        title: "Cost savings",
        items: [
          field("synergies.cost", "Cost savings", "amount", { hint: "Per year, once fully achieved, pre-tax" }),
          schedule("synergies.cost_phase_in", "Reached each year"),
        ],
      },
      {
        title: "Extra revenue",
        items: [
          field("synergies.revenue", "Extra revenue", "amount", { hint: "Per year, once fully achieved" }),
          field("synergies.revenue_margin", "Margin kept as profit", "percent"),
          field("synergies.revenue_probability", "Probability", "percent", { ...ADV, hint: "Haircut for uncertainty; 100% = none" }),
          schedule("synergies.revenue_phase_in", "Reached each year"),
        ],
      },
      {
        title: "Dis-synergies",
        description: "Lost customers or revenue because of the deal.",
        ...ADV,
        items: [
          field("synergies.dis_synergies", "Dis-synergies", "amount", { hint: "Per year, pre-tax" }),
          schedule("synergies.dis_synergy_phase_in", "Reached each year"),
        ],
      },
      {
        title: "Integration costs",
        items: [
          field("synergies.integration_costs", "Integration costs", "amount", { hint: "One-time total, pre-tax" }),
          schedule("synergies.integration_schedule", "Spent each year", { mustTotal100: true }),
        ],
      },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    groups: [
      {
        title: "Value creation",
        description: "Used to discount synergies and compare them with the premium paid.",
        items: [
          field("valuation.discount_rate", "Discount rate", "percent"),
          field("valuation.terminal_growth", "Terminal growth", "percent"),
        ],
      },
    ],
  },
];

export const TRANCHE_FIELDS: { key: keyof TrancheText; label: string; kind: Kind | "text" }[] = [
  { key: "name", label: "Name", kind: "text" },
  { key: "amount", label: "Amount", kind: "amount" },
  { key: "rate", label: "Interest rate", kind: "percent" },
  { key: "term_years", label: "Term", kind: "years" },
  { key: "amortization_pct", label: "Repaid each year", kind: "percent" },
  { key: "fee_pct", label: "Financing fee", kind: "percent" },
];

export const MAX_TRANCHES = 3;

// ---------------------------------------------------------------- Visibility

export function isVisible(item: Visibility, mode: Mode): boolean {
  return mode === "advanced" ? !item.simpleOnly : !item.advanced;
}

function allItems(): Item[] {
  return TABS.flatMap((tab) => tab.groups.flatMap((group) => group.items.map((item) => ({
    ...item,
    // An item inside an advanced tab or group is advanced too
    advanced: item.advanced || group.advanced || tab.advanced,
  }))));
}

const ITEMS = allItems();
const FIELDS = [
  ...ITEMS.filter((item): item is FieldItem => item.type === "field"),
  // The premium block shows the offer price box, which is sent to the API
  ...ITEMS.filter((item) => item.type === "premium").map((item) => field("offer.offer_price", "Offer price", "price", {
    advanced: item.advanced,
  })),
];
const SCHEDULES = ITEMS.filter((item): item is ScheduleItem => item.type === "schedule");
const CHOICES = ITEMS.filter((item): item is ChoiceItem => item.type === "choice");

/** The intangibles write-up is an amount or a percentage, depending on a choice. */
export function kindOf(item: FieldItem, choices: Record<string, string>): Kind {
  if (item.path === "ppa.intangibles" && choices["ppa.intangibles_input"] === "pct_of_excess") return "percent";
  return item.kind;
}

// ---------------------------------------------------------------- Units

export function unitSuffix(kind: Kind | "text", currency: Currency): { prefix?: string; suffix?: string } {
  const { symbol, unitLabel, sharesLabel } = CURRENCY[currency];
  switch (kind) {
    case "amount": return { prefix: symbol, suffix: unitLabel.trim() };
    case "shares": return { suffix: sharesLabel.trim() };
    case "percent": return { suffix: "%" };
    case "price": return { prefix: symbol };
    case "years": return { suffix: "yrs" };
    case "multiple": return { suffix: "x" };
    default: return {};
  }
}

function scale(kind: Kind, currency: Currency): number {
  if (kind === "amount" || kind === "shares") return CURRENCY[currency].unit;
  if (kind === "percent") return 0.01;
  return 1;
}

export function isValidNumber(text: string): boolean {
  return text.trim() !== "" && !Number.isNaN(Number(text));
}

export function toApiNumber(text: string, kind: Kind, currency: Currency): number {
  return Number(text) * scale(kind, currency);
}

export function fromApiNumber(value: number, kind: Kind, currency: Currency): string {
  return String(Number((value / scale(kind, currency)).toFixed(6)));
}

// ---------------------------------------------------------------- Nested paths

type Nested = Record<string, unknown>;

function setPath(target: Nested, path: string, value: unknown) {
  const parts = path.split(".");
  let node = target;
  for (const part of parts.slice(0, -1)) {
    node[part] = (node[part] as Nested) ?? {};
    node = node[part] as Nested;
  }
  node[parts[parts.length - 1]] = value;
}

function getPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((node, part) => (node as Nested | undefined)?.[part], source);
}

// ---------------------------------------------------------------- Building the API input

export type BuildResult = { input: DealInput | null; missing: string[] };

/** Turn the typed form into an API input. Visible fields must be filled in;
 * hidden fields are sent only if they hold a valid number. */
export function buildDealInput(state: FormState): BuildResult {
  const { mode, currency } = state;
  const result: Nested = { model_version: 2, mode, currency };
  const missing: string[] = [];

  for (const item of FIELDS) {
    const text = state.values[item.path] ?? "";
    const visible = isVisible(item, mode);
    if (item.optional && text.trim() === "") {
      setPath(result, item.path, null);
    } else if (isValidNumber(text)) {
      setPath(result, item.path, toApiNumber(text, kindOf(item, state.choices), currency));
    } else if (visible) {
      missing.push(item.label);
    }
  }

  for (const item of SCHEDULES) {
    const texts = state.schedules[item.path] ?? [];
    const visible = isVisible(item, mode);
    if (item.optional && texts.every((text) => text.trim() === "")) {
      setPath(result, item.path, null);
    } else if (texts.length === YEARS && texts.every(isValidNumber)) {
      setPath(result, item.path, texts.map((text) => toApiNumber(text, "percent", currency)));
    } else if (visible) {
      missing.push(item.label);
    }
  }

  for (const item of CHOICES) {
    setPath(result, item.path, state.choices[item.path]);
  }

  setPath(result, "offer.price_input", mode === "simple" ? "total" : "per_share");

  const tranches: Tranche[] = [];
  for (const [index, tranche] of state.tranches.entries()) {
    const numbers = TRANCHE_FIELDS.filter((f) => f.kind !== "text");
    const valid = numbers.every((f) => isValidNumber(tranche[f.key]));
    if (!valid) {
      if (mode === "advanced") missing.push(`Tranche ${index + 1}`);
      continue;
    }
    tranches.push({
      name: tranche.name.trim() || `Tranche ${index + 1}`,
      amount: toApiNumber(tranche.amount, "amount", currency),
      rate: toApiNumber(tranche.rate, "percent", currency),
      term_years: Math.max(1, Math.round(Number(tranche.term_years))),
      amortization_pct: toApiNumber(tranche.amortization_pct, "percent", currency),
      fee_pct: toApiNumber(tranche.fee_pct, "percent", currency),
    });
  }
  setPath(result, "funding.tranches", tranches);

  return { input: missing.length === 0 ? (result as DealInput) : null, missing };
}

// ---------------------------------------------------------------- Reading an API input back into the form

export function premiumText(values: Record<string, string>): string {
  const offer = Number(values["offer.offer_price"]);
  const unaffected = Number(values["target.unaffected_price"]);
  if (!isValidNumber(values["offer.offer_price"] ?? "") || !(unaffected > 0)) return "";
  return String(Number(((offer / unaffected - 1) * 100).toFixed(4)));
}

export function formFromInputs(input: DealInput): FormState {
  const currency = input.currency ?? "USD";
  const values: Record<string, string> = {};
  const schedules: Record<string, string[]> = {};
  const choices: Record<string, string> = {};

  for (const item of CHOICES) choices[item.path] = String(getPath(input, item.path));
  for (const item of FIELDS) {
    const raw = getPath(input, item.path);
    values[item.path] = raw === null || raw === undefined ? "" : fromApiNumber(raw as number, kindOf(item, choices), currency);
  }
  for (const item of SCHEDULES) {
    const raw = getPath(input, item.path) as number[] | null;
    schedules[item.path] = raw ? raw.map((v) => fromApiNumber(v, "percent", currency)) : Array(YEARS).fill("");
  }
  values["offer.premium"] = premiumText(values);

  const tranches = input.funding.tranches.map((t) => ({
    name: t.name,
    amount: fromApiNumber(t.amount, "amount", currency),
    rate: fromApiNumber(t.rate, "percent", currency),
    term_years: String(t.term_years),
    amortization_pct: fromApiNumber(t.amortization_pct, "percent", currency),
    fee_pct: fromApiNumber(t.fee_pct, "percent", currency),
  }));

  return { mode: input.mode, currency, values, schedules, choices, tranches };
}

// ---------------------------------------------------------------- Edits

/** Apply one typed edit. The offer price and the premium each update the other. */
export function applyValueEdit(state: FormState, path: string, text: string): FormState {
  const values = { ...state.values, [path]: text };
  if (path === "offer.premium") {
    const unaffected = Number(values["target.unaffected_price"]);
    if (isValidNumber(text) && unaffected > 0) {
      values["offer.offer_price"] = String(Number((unaffected * (1 + Number(text) / 100)).toFixed(4)));
    }
  } else if (path === "offer.offer_price" || path === "target.unaffected_price") {
    values["offer.premium"] = premiumText(values);
  }
  return { ...state, values };
}

function num(text: string | undefined): number {
  return text !== undefined && isValidNumber(text) ? Number(text) : 0;
}

function tidy(value: number): string {
  return String(Number(value.toFixed(4)));
}

/** Switching modes carries the deal across: the typed purchase price and payment
 * mix become an offer price and funding amounts, and back. */
export function switchMode(state: FormState, mode: Mode): FormState {
  if (mode === state.mode) return state;
  const values = { ...state.values };
  const choices = { ...state.choices };
  let tranches = state.tranches;
  const shares = num(values["target.diluted_shares"]);
  const stockPct = num(values["offer.pct_stock"]);

  if (mode === "advanced") {
    const price = num(values["offer.purchase_price"]);
    if (shares > 0 && price > 0) values["offer.offer_price"] = tidy(price / shares);
    values["offer.premium"] = premiumText(values);
    values["funding.cash_used"] = tidy((price * num(values["funding.mix.pct_cash"])) / 100);
    const debt = tidy((price * num(values["funding.mix.pct_debt"])) / 100);
    const first = tranches[0] ?? { name: "Term loan", term_years: "5", amortization_pct: "0", fee_pct: "0", amount: "0", rate: "0" };
    tranches = [{ ...first, amount: debt, rate: values["funding.mix.debt_rate"] ?? first.rate }, ...tranches.slice(1)];
    if (choices["funding.balancing_item"] === "none") choices["funding.balancing_item"] = "tranche_1";
  } else {
    const offer = num(values["offer.offer_price"]);
    const price = shares > 0 && offer > 0 ? offer * shares : num(values["offer.purchase_price"]);
    values["offer.purchase_price"] = tidy(price);
    const debt = tranches.reduce((total, t) => total + num(t.amount), 0);
    const debtPct = price > 0 ? Math.min((debt / price) * 100, 100 - stockPct) : 0;
    values["funding.mix.pct_debt"] = tidy(Math.max(debtPct, 0));
    values["funding.mix.pct_cash"] = tidy(Math.max(100 - stockPct - debtPct, 0));
    if (tranches[0]) values["funding.mix.debt_rate"] = tranches[0].rate;
  }
  return { ...state, mode, values, choices, tranches };
}

export function sumOfTexts(texts: string[]): number | null {
  if (!texts.every(isValidNumber)) return null;
  return texts.reduce((total, text) => total + Number(text), 0);
}

// ---------------------------------------------------------------- The example deal

export const DEFAULT_DEAL_NAME = "Acme acquires Beta Corp";

// Simple mode matches the original example. The advanced fields hold a
// consistent version of the same deal: 10M target shares x $30 = $300M.
export const DEFAULT_FORM: FormState = {
  mode: "simple",
  currency: "USD",
  values: {
    tax_rate: "25",
    "acquirer.net_income": "100",
    "acquirer.diluted_shares": "50",
    "acquirer.share_price": "40",
    "acquirer.revenue": "1000",
    "acquirer.ebitda": "200",
    "acquirer.debt": "300",
    "acquirer.interest_expense": "15",
    "acquirer.cash": "150",
    "acquirer.min_cash": "50",
    "acquirer.interest_rate_on_cash": "4",
    "target.net_income": "20",
    "target.diluted_shares": "10",
    "target.unaffected_price": "22",
    "target.revenue": "200",
    "target.ebitda": "40",
    "target.debt": "40",
    "target.cash": "10",
    "target.preferred_stock": "0",
    "target.minority_interest": "0",
    "target.interest_expense": "3",
    "target.book_value": "120",
    "offer.purchase_price": "300",
    "offer.offer_price": "30",
    "offer.premium": "36.3636",
    "offer.pct_stock": "50",
    "stake.existing_pct": "0",
    "stake.bought_pct": "100",
    "stake.open_offer_pct": "0",
    "stake.open_offer_price": "0",
    "stake.acceptance_pct": "100",
    "stake.synergies_inside_target_pct": "0",
    "funding.mix.pct_cash": "0",
    "funding.mix.pct_debt": "50",
    "funding.mix.debt_rate": "7",
    "funding.cash_used": "0",
    "funding.new_equity_amount": "0",
    "funding.new_equity_price": "0",
    "funding.fcf_conversion_pct": "0",
    "fees.advisory_pct": "1",
    "ppa.intangibles": "60",
    "ppa.intangibles_life": "10",
    "ppa.ppe_writeup": "0",
    "ppa.ppe_life": "10",
    "synergies.cost": "15",
    "synergies.revenue": "40",
    "synergies.revenue_margin": "20",
    "synergies.revenue_probability": "100",
    "synergies.dis_synergies": "0",
    "synergies.integration_costs": "30",
    "thresholds.max_leverage": "4",
    "thresholds.min_coverage": "3",
    "valuation.discount_rate": "10",
    "valuation.terminal_growth": "2",
  },
  schedules: {
    "acquirer.revenue_growth": ["0", "0", "0", "0", "0"],
    "acquirer.net_income_growth": ["0", "0", "0", "0", "0"],
    "acquirer.ebitda_margin": ["", "", "", "", ""],
    "target.revenue_growth": ["0", "0", "0", "0", "0"],
    "target.net_income_growth": ["0", "0", "0", "0", "0"],
    "target.ebitda_margin": ["", "", "", "", ""],
    "synergies.cost_phase_in": ["50", "75", "100", "100", "100"],
    "synergies.revenue_phase_in": ["0", "50", "100", "100", "100"],
    "synergies.dis_synergy_phase_in": ["100", "100", "100", "100", "100"],
    "synergies.integration_schedule": ["60", "30", "10", "0", "0"],
  },
  choices: {
    "offer.debt_treatment": "assumed",
    "stake.treatment": "auto",
    "funding.balancing_item": "tranche_1",
    "ppa.intangibles_input": "amount",
  },
  tranches: [
    { name: "Term loan", amount: "150", rate: "7", term_years: "5", amortization_pct: "0", fee_pct: "1" },
  ],
};

export const EMPTY_TRANCHE: TrancheText = {
  name: "", amount: "0", rate: "7", term_years: "5", amortization_pct: "0", fee_pct: "0",
};
