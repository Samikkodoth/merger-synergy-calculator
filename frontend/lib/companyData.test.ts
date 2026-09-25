import { describe, expect, it } from "vitest";
import {
  applyGrowth, applyTaxRate, confirmAll, confirmField, fillFromCompany, fillPrice, findConflicts, markEdited,
  markNeedsInput, replaceWithFiling,
} from "@/lib/companyData";
import { DEFAULT_FORM, buildDealInput, dataSources, formFromInputs } from "@/lib/dealForm";
import type { CompanyField, CompanyProfile, PriceLookup } from "@/lib/types";

const period = {
  role: "Fiscal year", tag: "NetIncomeLoss", value: 0, start: "2025-01-01", end: "2025-12-31",
  form: "10-K", filed: "2026-02-20", accession: "0000000001-26-000001", url: "https://www.sec.gov/x",
};

function field(value: number | null, extra: Partial<CompanyField> = {}): Record<"ttm" | "fy", CompanyField> {
  const f: CompanyField = value === null
    ? { value: null, tags: [], periods: [], reason: "No interest expense found for this period in the filings" }
    : { value, tags: ["Tag"], periods: [{ ...period, value }], ...extra };
  return { ttm: f, fy: f };
}

// A target with $20M net income, 10M shares on the cover page, and no interest expense tag
const PROFILE: CompanyProfile = {
  ticker: "BETA",
  cik: "0000000001",
  name: "Beta Corp",
  industry: "Widgets",
  bases: { ttm: "Twelve months to 2026-06-30", fy: "Fiscal year ended 2025-12-31" },
  balance_date: "2026-06-30",
  fields: {
    net_income: field(20e6),
    diluted_shares: field(10.4e6),
    shares_outstanding: field(10e6, { as_of: "2026-07-20" }),
    revenue: field(200e6),
    ebitda: field(40e6),
    total_debt: field(40e6),
    cash: field(10e6),
    interest_expense: field(null),
    book_equity: field(120e6),
    tax_rate: field(0.21),
  },
  growth: {
    revenue: {
      value: 0.05, years: 3,
      from: { end: "2022-12-31", value: 1, tag: "Revenues" },
      to: { end: "2025-12-31", value: 1, tag: "Revenues" },
    },
    net_income: { value: null, reason: "Not meaningful" },
  },
  warnings: [],
  share_classes: ["BETA"],
};

const advanced = { ...DEFAULT_FORM, mode: "advanced" as const };

describe("fillFromCompany", () => {
  const filled = fillFromCompany(advanced, "target", PROFILE, "ttm");

  it("writes values in form units ($M, shares in millions) and marks them auto", () => {
    expect(filled.values["target.net_income"]).toBe("20");
    expect(filled.values["target.book_value"]).toBe("120");
    expect(filled.sources["target.net_income"]).toMatchObject({
      status: "auto", company: "Beta Corp (BETA)", basisLabel: "Twelve months to 2026-06-30", value: 20e6,
    });
  });

  it("uses the cover page share count for the target, with its as-of date", () => {
    expect(filled.values["target.diluted_shares"]).toBe("10");
    expect(filled.sources["target.diluted_shares"].basisLabel).toBe("As of 2026-07-20");
  });

  it("falls back to the diluted count when the cover page has none, and says so", () => {
    const noCover = { ...PROFILE, fields: { ...PROFILE.fields, shares_outstanding: field(null) } };
    const result = fillFromCompany(advanced, "target", noCover, "ttm");
    expect(result.values["target.diluted_shares"]).toBe("10.4");
    expect(result.sources["target.diluted_shares"].note).toContain("weighted average diluted");
  });

  it("clears missing items instead of keeping the old value", () => {
    expect(filled.values["target.interest_expense"]).toBe("");
    expect(filled.sources["target.interest_expense"]).toMatchObject({ status: "missing" });
    expect(buildDealInput(filled).missing).toContain("Interest expense");
  });

  it("uses the weighted diluted count for the buyer", () => {
    const buyer = fillFromCompany(advanced, "acquirer", PROFILE, "ttm");
    expect(buyer.values["acquirer.diluted_shares"]).toBe("10.4");
  });
});

describe("prices", () => {
  const found: PriceLookup = {
    available: true,
    source: "Tiingo",
    ticker: "BETA",
    current: { price: 25, date: "2026-09-24" },
    unaffected: { price: 20, date: "2026-09-18", announced: "2026-09-21", raw_close: 20, split_factor: 1, note: null },
  };

  it("fills the unaffected price and recomputes the premium", () => {
    // Offer $30 vs unaffected $20 = 50% premium
    const result = fillPrice(advanced, "target", found, "beta");
    expect(result.values["target.unaffected_price"]).toBe("20");
    expect(result.values["offer.premium"]).toBe("50");
    expect(result.sources["target.unaffected_price"].note).toContain("last trading day before 2026-09-21");
  });

  it("leaves prices manual without a key", () => {
    const off: PriceLookup = { available: false, message: "Automatic prices available in local use only." };
    const result = fillPrice(advanced, "acquirer", off, "BETA");
    expect(result.values["acquirer.share_price"]).toBe(advanced.values["acquirer.share_price"]);
    expect(result.sources["acquirer.share_price"]).toMatchObject({ status: "todo" });
  });
});

describe("field status", () => {
  const filled = markNeedsInput(fillFromCompany(advanced, "target", PROFILE, "ttm"));

  it("marks assumptions with no free source for the user to fill", () => {
    expect(filled.sources["synergies.cost"].status).toBe("todo");
    expect(filled.sources["target.revenue_growth"].status).toBe("todo");
  });

  it("an edit makes a field manual and keeps what the source said", () => {
    const edited = markEdited(filled, ["target.net_income", "synergies.cost"]);
    expect(edited.sources["target.net_income"]).toMatchObject({ status: "manual", value: 20e6 });
    expect(edited.sources["synergies.cost"].status).toBe("manual");
  });

  it("confirms one field or all of them", () => {
    expect(confirmField(filled, "target.revenue").sources["target.revenue"].status).toBe("confirmed");
    // Only auto-filled fields are confirmed; missing and to-do ones are left alone
    const all = confirmAll(filled);
    expect(all.sources["target.revenue"].status).toBe("confirmed");
    expect(all.sources["target.interest_expense"].status).toBe("missing");
    expect(all.sources["synergies.cost"].status).toBe("todo");
  });

  it("uses historical growth and the tax rate only when asked, labelled", () => {
    const grown = applyGrowth(filled, "target", PROFILE);
    expect(grown.schedules["target.revenue_growth"]).toEqual(["5", "5", "5", "5", "5"]);
    expect(grown.sources["target.revenue_growth"].note).toContain("not a forecast");
    // No net income growth history, so that schedule is untouched
    expect(grown.schedules["target.net_income_growth"]).toEqual(filled.schedules["target.net_income_growth"]);
    expect(applyTaxRate(filled, PROFILE, "ttm").values.tax_rate).toBe("21");
  });

  it("saves sources with the deal and loads them back", () => {
    const state = {
      ...filled,
      lookup: { ...filled.lookup, target: "BETA" },
      values: { ...filled.values, "target.interest_expense": "3" },
    };
    const input = { ...buildDealInput(state).input!, data_sources: dataSources(state) };
    const loaded = formFromInputs(input);
    expect(loaded.sources["target.net_income"].status).toBe("auto");
    expect(loaded.lookup.target).toBe("BETA");
    // A deal without a lookup saves nothing extra
    expect(dataSources(DEFAULT_FORM)).toEqual({});
  });
});

describe("switching between TTM and the fiscal year", () => {
  // Same company; fiscal-year figures differ from TTM: net income $18M, revenue $190M, EBITDA $36M
  const flow = (ttm: number, fy: number) => ({
    ttm: { ...PROFILE.fields.net_income.ttm, value: ttm },
    fy: { ...PROFILE.fields.net_income.fy, value: fy },
  });
  const BOTH: CompanyProfile = {
    ...PROFILE,
    fields: { ...PROFILE.fields, net_income: flow(20e6, 18e6), revenue: flow(200e6, 190e6), ebitda: flow(40e6, 36e6) },
  };

  // Filled on TTM; the user types $25M net income and checks revenue; EBITDA stays auto
  const ttm = fillFromCompany(advanced, "target", BOTH, "ttm");
  const edited = confirmField(
    markEdited({ ...ttm, values: { ...ttm.values, "target.net_income": "25" } }, ["target.net_income"]),
    "target.revenue",
  );
  const fy = fillFromCompany(edited, "target", BOTH, "fy");

  it("refreshes auto fields only", () => {
    expect(fy.values["target.ebitda"]).toBe("36");
    expect(fy.sources["target.ebitda"].basisLabel).toBe("Fiscal year ended 2025-12-31");
  });

  it("keeps manual and checked fields unchanged", () => {
    expect(fy.values["target.net_income"]).toBe("25");
    expect(fy.sources["target.net_income"].status).toBe("manual");
    expect(fy.values["target.revenue"]).toBe("200");
    expect(fy.sources["target.revenue"]).toMatchObject({ status: "confirmed", basisLabel: "Twelve months to 2026-06-30" });
  });

  it("lists kept fields that differ from the new figures", () => {
    const conflicts = findConflicts(fy, "target", BOTH, "fy");
    expect(conflicts.map((c) => [c.label, c.status, c.yours, c.filing])).toEqual([
      ["Target net income", "manual", 25e6, 18e6],
      ["Target revenue", "confirmed", 200e6, 190e6],
    ]);
    // Back on TTM, the checked revenue matches again; only the manual edit differs
    expect(findConflicts(fy, "target", BOTH, "ttm").map((c) => c.path)).toEqual(["target.net_income"]);
  });

  it("replaces the listed fields when asked", () => {
    const replaced = replaceWithFiling(fy, "target", BOTH, "fy", ["target.net_income", "target.revenue"]);
    expect(replaced.values["target.net_income"]).toBe("18");
    expect(replaced.values["target.revenue"]).toBe("190");
    expect(replaced.sources["target.net_income"].status).toBe("auto");
    expect(findConflicts(replaced, "target", BOTH, "fy")).toEqual([]);
  });

  it("a different company overwrites everything", () => {
    const other = { ...BOTH, ticker: "GAMMA", name: "Gamma Inc" };
    const filled = fillFromCompany(edited, "target", other, "fy");
    expect(filled.values["target.net_income"]).toBe("18");
    expect(filled.sources["target.net_income"]).toMatchObject({ status: "auto", company: "Gamma Inc (GAMMA)" });
  });
});
