import { describe, expect, it } from "vitest";
import {
  DEFAULT_FORM, applyValueEdit, buildDealInput, formFromInputs, switchMode, type FormState,
} from "@/lib/dealForm";

function build(state: FormState) {
  const { input, missing } = buildDealInput(state);
  expect(missing).toEqual([]);
  return input!;
}

describe("buildDealInput", () => {
  it("converts the simple example to raw API numbers", () => {
    const input = build(DEFAULT_FORM);
    expect(input.mode).toBe("simple");
    expect(input.offer.price_input).toBe("total");
    expect(input.acquirer.net_income).toBe(100e6);
    expect(input.offer.purchase_price).toBe(300e6);
    expect(input.tax_rate).toBe(0.25);
    expect(input.funding.mix).toEqual({ pct_cash: 0, pct_debt: 0.5, debt_rate: 0.07 });
    expect(input.synergies.cost_phase_in).toEqual([0.5, 0.75, 1, 1, 1]);
    expect(input.acquirer.ebitda_margin).toBeNull();
  });

  it("reads INR amounts as crore (1 crore = 10 million)", () => {
    const input = build({ ...DEFAULT_FORM, currency: "INR" });
    expect(input.acquirer.net_income).toBe(100e7);
    expect(input.acquirer.diluted_shares).toBe(50e7);
    expect(input.acquirer.share_price).toBe(40);
  });

  it("reports empty visible fields, but ignores empty hidden ones", () => {
    const blankVisible = { ...DEFAULT_FORM, values: { ...DEFAULT_FORM.values, "target.net_income": "" } };
    expect(buildDealInput(blankVisible).missing).toEqual(["Net income"]);

    // Target shares are only shown in advanced mode
    const blankHidden = { ...DEFAULT_FORM, values: { ...DEFAULT_FORM.values, "target.diluted_shares": "" } };
    expect(buildDealInput(blankHidden).missing).toEqual([]);
  });

  it("round-trips through the API shape", () => {
    const advanced = switchMode(DEFAULT_FORM, "advanced");
    const input = build(advanced);
    expect(input.offer.offer_price).toBe(30);
    expect(build(formFromInputs(input))).toEqual(input);
  });
});

describe("edits and modes", () => {
  it("keeps the offer price and premium in step", () => {
    let state = applyValueEdit(DEFAULT_FORM, "target.unaffected_price", "20");
    state = applyValueEdit(state, "offer.offer_price", "26");
    expect(state.values["offer.premium"]).toBe("30");
    state = applyValueEdit(state, "offer.premium", "50");
    expect(state.values["offer.offer_price"]).toBe("30");
  });

  it("carries the simple deal into advanced mode", () => {
    // $300M for 10M shares -> $30 offer; 50% debt -> a $150M tranche at 7%.
    const advanced = switchMode(DEFAULT_FORM, "advanced");
    expect(advanced.values["offer.offer_price"]).toBe("30");
    expect(advanced.tranches[0].amount).toBe("150");
    expect(advanced.tranches[0].rate).toBe("7");
    const input = build(advanced);
    expect(input.offer.price_input).toBe("per_share");
    expect(input.offer.offer_price).toBe(30);
    expect(input.target.diluted_shares).toBe(10e6);
    expect(input.funding.tranches[0].amount).toBe(150e6);
  });

  it("carries an advanced deal back to simple mode", () => {
    let advanced = switchMode(DEFAULT_FORM, "advanced");
    advanced = applyValueEdit(advanced, "offer.offer_price", "32");
    const simple = switchMode(advanced, "simple");
    expect(simple.values["offer.purchase_price"]).toBe("320");
    // 150 of debt on 320 = 46.875%; stock stays 50%; cash takes the rest.
    expect(simple.values["funding.mix.pct_debt"]).toBe("46.875");
    expect(simple.values["funding.mix.pct_cash"]).toBe("3.125");
  });
});
