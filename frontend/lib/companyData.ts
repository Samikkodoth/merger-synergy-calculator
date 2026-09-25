// Filling the deal form from SEC filings and share prices, and tracking each
// field's status: "auto" (filled, not yet checked), "confirmed", "manual"
// (edited), "missing" (not in the filings) or "todo" (no free source exists).
//
// Company data is in USD. Values are written into the form in its units ($M,
// shares in millions, % as 0-100), exactly as if the user had typed them.

import { YEARS, fromApiNumber, premiumText, type FormState } from "@/lib/dealForm";
import type {
  Basis, CompanyField, CompanyProfile, FieldSource, Growth, PriceLookup,
} from "@/lib/types";

export type Role = "acquirer" | "target";

type Kind = NonNullable<FieldSource["kind"]>;

type Mapping = {
  path: string;
  /** Profile fields to try in order (the target's shares fall back to the diluted count) */
  fields: string[];
  kind: Kind;
};

export const COMPANY_FIELDS: Record<Role, Mapping[]> = {
  acquirer: [
    { path: "acquirer.net_income", fields: ["net_income"], kind: "amount" },
    // EPS uses the weighted average diluted count, as reported EPS does
    { path: "acquirer.diluted_shares", fields: ["diluted_shares"], kind: "shares" },
    { path: "acquirer.revenue", fields: ["revenue"], kind: "amount" },
    { path: "acquirer.ebitda", fields: ["ebitda"], kind: "amount" },
    { path: "acquirer.debt", fields: ["total_debt"], kind: "amount" },
    { path: "acquirer.cash", fields: ["cash"], kind: "amount" },
    { path: "acquirer.interest_expense", fields: ["interest_expense"], kind: "amount" },
  ],
  target: [
    { path: "target.net_income", fields: ["net_income"], kind: "amount" },
    // The offer is paid on shares outstanding now: the cover page count
    { path: "target.diluted_shares", fields: ["shares_outstanding", "diluted_shares"], kind: "shares" },
    { path: "target.revenue", fields: ["revenue"], kind: "amount" },
    { path: "target.ebitda", fields: ["ebitda"], kind: "amount" },
    { path: "target.debt", fields: ["total_debt"], kind: "amount" },
    { path: "target.cash", fields: ["cash"], kind: "amount" },
    { path: "target.interest_expense", fields: ["interest_expense"], kind: "amount" },
    { path: "target.book_value", fields: ["book_equity"], kind: "amount" },
  ],
};

export const PRICE_PATHS: Record<Role, string> = {
  acquirer: "acquirer.share_price",
  target: "target.unaffected_price",
};

/** Assumptions with no free source. After a lookup they're marked for the user to fill. */
export const NEEDS_INPUT = [
  "offer.offer_price",
  "offer.pct_stock",
  "acquirer.revenue_growth",
  "acquirer.net_income_growth",
  "target.revenue_growth",
  "target.net_income_growth",
  "synergies.cost",
  "synergies.revenue",
  "synergies.revenue_margin",
  "synergies.integration_costs",
  "ppa.intangibles",
  "tax_rate",
];

const SHARES_NOTE = "Options, RSUs and convertibles are not included.";

export function isTicker(text: string): boolean {
  return /^[A-Za-z0-9.-]{1,12}$/.test(text.trim());
}

export function companyLabel(profile: CompanyProfile): string {
  return `${profile.name} (${profile.ticker})`;
}

/** An API number as the form would show it (company data is always USD). */
function formText(value: number, kind: Kind): string {
  return fromApiNumber(value, kind, "USD");
}

/** Fill one company's figures. Missing items are cleared, never guessed. */
export function fillFromCompany(state: FormState, role: Role, profile: CompanyProfile, basis: Basis): FormState {
  let values = { ...state.values };
  const sources = { ...state.sources };

  for (const mapping of COMPANY_FIELDS[role]) {
    const options = mapping.fields.map((name) => profile.fields[name]?.[basis]);
    const found = options.find((field): field is CompanyField => field !== undefined && field.value !== null);
    if (!found) {
      const first = options[0];
      values = { ...values, [mapping.path]: "" };
      sources[mapping.path] = {
        status: "missing",
        company: companyLabel(profile),
        reason: first?.reason ?? "Not found in the filings",
      };
      continue;
    }
    const usedFallback = found !== options[0];
    const notes = [found.note];
    if (usedFallback) {
      notes.push("The cover page doesn't report shares outstanding, so this is the weighted average diluted count.",
        SHARES_NOTE);
    }
    values = { ...values, [mapping.path]: formText(found.value!, mapping.kind) };
    sources[mapping.path] = {
      status: "auto",
      company: companyLabel(profile),
      basisLabel: found.as_of ? `As of ${found.as_of}` : profile.bases[basis],
      value: found.value!,
      kind: mapping.kind,
      periods: found.periods,
      note: notes.filter(Boolean).join(" ") || undefined,
    };
  }
  return { ...state, values, sources };
}

/** Fill a share price: the last close before the announcement date. */
export function fillPrice(state: FormState, role: Role, lookup: PriceLookup, ticker: string): FormState {
  const path = PRICE_PATHS[role];
  if (!lookup.available || lookup.unaffected === null) {
    const reason = lookup.available
      ? lookup.unaffected_message ?? "No price found before the announcement date."
      : lookup.message;
    return { ...state, sources: { ...state.sources, [path]: { status: "todo", reason } } };
  }
  const { unaffected } = lookup;
  const values = { ...state.values, [path]: formText(unaffected.price, "price") };
  if (role === "target") values["offer.premium"] = premiumText(values);
  const next = { ...state, values };
  const notes = [
    `${lookup.source} close on ${unaffected.date}, the last trading day before ${unaffected.announced}.`,
    `Latest close: $${lookup.current.price.toFixed(2)} on ${lookup.current.date}.`,
    unaffected.note,
  ];
  return {
    ...next,
    sources: {
      ...next.sources,
      [path]: {
        status: "auto",
        company: ticker.toUpperCase(),
        basisLabel: `Close on ${unaffected.date}`,
        value: unaffected.price,
        kind: "price",
        note: notes.filter(Boolean).join(" "),
      },
    },
  };
}

/** Mark assumptions with no free source as "you fill this", unless the user already has. */
export function markNeedsInput(state: FormState): FormState {
  const sources = { ...state.sources };
  for (const path of NEEDS_INPUT) {
    const status = sources[path]?.status;
    if (status === undefined || status === "todo") {
      sources[path] = { status: "todo", reason: "No free source for this: enter your own assumption." };
    }
  }
  return { ...state, sources };
}

/** A typed edit makes the field "manual"; what the source said is kept for reference. */
export function markEdited(state: FormState, paths: string[]): FormState {
  if (!paths.some((path) => path in state.sources)) return state;
  const sources = { ...state.sources };
  for (const path of paths) {
    if (path in sources && sources[path].status !== "manual") sources[path] = { ...sources[path], status: "manual" };
  }
  return { ...state, sources };
}

export function confirmField(state: FormState, path: string): FormState {
  const source = state.sources[path];
  if (!source || source.status !== "auto") return state;
  return { ...state, sources: { ...state.sources, [path]: { ...source, status: "confirmed" } } };
}

export function confirmAll(state: FormState): FormState {
  const sources = Object.fromEntries(
    Object.entries(state.sources).map(([path, source]) => [
      path, source.status === "auto" ? { ...source, status: "confirmed" as const } : source,
    ]),
  );
  return { ...state, sources };
}

/** Use historical growth as the forecast in every year. Labelled as history, not a forecast. */
export function applyGrowth(state: FormState, role: Role, profile: CompanyProfile): FormState {
  const schedules = { ...state.schedules };
  const sources = { ...state.sources };
  for (const [name, growth] of Object.entries(profile.growth) as [keyof CompanyProfile["growth"], Growth][]) {
    if (growth.value === null) continue;
    const path = `${role}.${name}_growth`;
    schedules[path] = Array(YEARS).fill(formText(growth.value, "percent"));
    sources[path] = {
      status: "auto",
      company: companyLabel(profile),
      basisLabel: `${growth.years}-year history, ${growth.from?.end} to ${growth.to?.end}`,
      value: growth.value,
      kind: "percent",
      note: "Historical growth, not a forecast. Replace it with your own view.",
    };
  }
  return { ...state, schedules, sources };
}

export function applyTaxRate(state: FormState, profile: CompanyProfile, basis: Basis): FormState {
  const field = profile.fields.tax_rate?.[basis];
  if (!field || field.value === null) return state;
  return {
    ...state,
    values: { ...state.values, tax_rate: formText(field.value, "percent") },
    sources: {
      ...state.sources,
      tax_rate: {
        status: "auto",
        company: companyLabel(profile),
        basisLabel: profile.bases[basis],
        value: field.value,
        kind: "percent",
        periods: field.periods,
        note: "The buyer's effective tax rate: income tax ÷ pre-tax income. One rate applies to the whole deal.",
      },
    },
  };
}

/** How many fields still need a look, for the summary and the tab markers. */
export function countByStatus(sources: Record<string, FieldSource>) {
  const counts = { auto: 0, confirmed: 0, manual: 0, missing: 0, todo: 0 };
  for (const source of Object.values(sources)) counts[source.status] += 1;
  return counts;
}

export function needsAttention(source: FieldSource | undefined): boolean {
  return source !== undefined && (source.status === "auto" || source.status === "missing" || source.status === "todo");
}
