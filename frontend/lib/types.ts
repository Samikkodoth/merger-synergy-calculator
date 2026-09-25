// The shapes of the data we send to and receive from the backend.
// These mirror backend/model/inputs.py (DealInputV2) and model/engine.py (run_model).

export type Currency = "USD" | "INR";
export type Mode = "simple" | "advanced";
export type Treatment = "consolidate" | "equity" | "investment";

export type Company = {
  net_income: number;
  diluted_shares: number;
  revenue: number;
  ebitda: number;
  revenue_growth: number[];
  net_income_growth: number[];
  ebitda_margin: number[] | null;
  debt: number;
  interest_expense: number;
};

export type Tranche = {
  name: string;
  amount: number;
  rate: number;
  term_years: number;
  amortization_pct: number;
  fee_pct: number;
};

export type DealInput = {
  model_version: 2;
  mode: Mode;
  currency: Currency;
  tax_rate: number;
  acquirer: Company & {
    share_price: number;
    cash: number | null;
    min_cash: number;
    interest_rate_on_cash: number;
  };
  target: Company & {
    unaffected_price: number;
    cash: number;
    preferred_stock: number;
    minority_interest: number;
    book_value: number | null;
  };
  offer: {
    price_input: "total" | "per_share";
    purchase_price: number;
    offer_price: number;
    pct_stock: number;
    debt_treatment: "assumed" | "refinanced";
  };
  stake: {
    existing_pct: number;
    bought_pct: number;
    open_offer_pct: number;
    open_offer_price: number;
    acceptance_pct: number;
    treatment: "auto" | Treatment;
    synergies_inside_target_pct: number;
  };
  funding: {
    mix: { pct_cash: number; pct_debt: number; debt_rate: number };
    cash_used: number;
    tranches: Tranche[];
    new_equity_amount: number;
    new_equity_price: number;
    balancing_item: "none" | "cash" | "tranche_1" | "tranche_2" | "tranche_3";
    fcf_conversion_pct: number;
  };
  fees: { advisory_pct: number };
  ppa: {
    intangibles_input: "amount" | "pct_of_excess";
    intangibles: number;
    intangibles_life: number;
    ppe_writeup: number;
    ppe_life: number;
  };
  synergies: {
    cost: number;
    cost_phase_in: number[];
    revenue: number;
    revenue_margin: number;
    revenue_phase_in: number[];
    revenue_probability: number;
    dis_synergies: number;
    dis_synergy_phase_in: number[];
    integration_costs: number;
    integration_schedule: number[];
  };
  thresholds: { max_leverage: number; min_coverage: number };
  valuation: { discount_rate: number; terminal_growth: number };
};

export type Issue = {
  level: "error" | "warning" | "note";
  code: string;
  message: string;
};

export type LineItem = { key: string; label: string; amount: number };

export type Components = {
  acquirer_net_income: number;
  target_net_income: number;
  refinancing_savings: number;
  cost_synergies: number;
  revenue_synergies: number;
  dis_synergies: number;
  integration_costs: number;
  amortization: number;
  new_interest: number;
  financing_fees: number;
  lost_interest_on_cash: number;
  minority_interest: number;
};

export type Credit = {
  ebitda: number;
  total_debt: number;
  cash: number;
  net_debt: number;
  interest_expense: number;
  total_leverage: number | null;
  net_leverage: number | null;
  interest_coverage: number | null;
  available: boolean;
  leverage_breach: boolean;
  coverage_breach: boolean;
};

export type YearResult = {
  year: number;
  standalone_eps: number;
  pro_forma_shares: number;
  gaap_net_income: number;
  gaap_eps: number;
  gaap_accretion: number | null;
  cash_net_income: number;
  cash_eps: number;
  cash_accretion: number | null;
  components: Components;
  synergies: {
    cost: number;
    revenue_profit: number;
    dis_synergies: number;
    integration_costs: number;
    net_pre_tax: number;
    net_after_tax_attributable: number;
  };
  breakeven_synergies: number | null;
  credit: Credit;
};

export type DebtRow = {
  year: number;
  beginning: number;
  mandatory: number;
  sweep: number;
  ending: number;
  interest: number;
  fee_amortization: number;
};

export type DealResults = {
  model_version: 2;
  mode: Mode;
  currency: Currency;
  valid: boolean;
  issues: Issue[];
  eps_today: number;
  offer: {
    per_share: boolean;
    offer_price: number | null;
    unaffected_price: number | null;
    premium_pct: number | null;
    equity_value: number;
    net_debt: number;
    enterprise_value: number;
    ev_revenue: number | null;
    ev_ebitda: number | null;
    pe: number | null;
  };
  stake: {
    existing_pct: number;
    final_pct: number;
    treatment: Treatment;
    legs: { name: string; pct: number; shares: number | null; price: number | null; cost: number }[];
    shares_acquired: number;
    cost: number;
    premium_paid: number | null;
  };
  consideration: {
    stock_value: number;
    cash_value: number;
    stock_per_share: number | null;
    exchange_ratio: number | null;
    shares_issued: number;
  };
  sources_uses: {
    uses: LineItem[];
    sources: LineItem[];
    total_uses: number;
    total_sources: number;
    gap: number;
    balanced: boolean;
    cash_used: number;
    cash_available: number | null;
    tranche_amounts: number[];
    refinanced_debt: number;
    advisory_fees: number;
    financing_fees: number;
    new_equity_shares: number;
    new_equity_price: number;
  };
  ownership: {
    existing_shares: number;
    shares_to_target_holders: number;
    shares_to_new_investors: number;
    pro_forma_shares: number;
    existing_pct: number;
    target_holders_pct: number;
    new_investors_pct: number;
  };
  ppa: {
    consideration: number;
    stake_pct: number;
    book_value: number;
    excess_purchase_price: number;
    intangibles_write_up: number;
    ppe_write_up: number;
    deferred_tax_liability: number;
    fair_value_net_assets: number;
    goodwill: number;
    amortization: number[];
  } | null;
  debt_schedule: (Tranche & { years: DebtRow[] })[];
  years: YearResult[];
  value:
    | {
        valid: true;
        discount_rate: number;
        terminal_growth: number;
        years: { year: number; synergies: number; discount_factor: number; present_value: number }[];
        pv_forecast_years: number;
        run_rate: number;
        terminal_value: number;
        pv_terminal_value: number;
        pv_synergies: number;
        premium_paid: number | null;
        value_created: number | null;
      }
    | { valid: false; discount_rate: number; terminal_growth: number; message: string };
  one_time: { advisory_fees: number };
  num_years: number;
};

export type AxisKey = "price" | "premium" | "synergies" | "pct_stock" | "debt_rate" | "pct_debt" | "acceptance";

export type Axis = {
  key: AxisKey;
  label: string;
  values: number[];
  base_index: number | null;
};

export type Sensitivity = {
  x_axis: Axis;
  y_axis: Axis;
  cells: { gaap: (number | null)[]; cash: (number | null)[] }[][];
  base_valid: boolean;
};

export type SavedDealSummary = {
  id: number;
  name: string;
  currency?: Currency;
  created_at: string;
};

export type SavedDeal = SavedDealSummary & {
  inputs: DealInput;
  results: DealResults;
};
