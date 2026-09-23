// The shapes of the data we send to and receive from the backend.
// These mirror DealInput in main.py and the dictionary returned by calculate_deal.

export type DealInput = {
  acquirer_net_income: number;
  acquirer_shares: number;
  acquirer_share_price: number;
  target_net_income: number;
  purchase_price: number;
  tax_rate: number;
  pct_stock: number;
  pct_cash: number;
  pct_debt: number;
  interest_rate_on_cash: number;
  interest_rate_on_debt: number;
  cost_synergies: number;
  cost_synergy_phase_in: number[];
  revenue_synergies: number;
  revenue_synergy_margin: number;
  revenue_synergy_phase_in: number[];
  integration_costs: number;
  integration_cost_schedule: number[];
};

export type YearResult = {
  year: number;
  cost_synergies: number;
  revenue_synergy_profit: number;
  integration_costs: number;
  eps_after: number;
  accretion_pct: number;
};

export type DealResults = {
  eps_before: number;
  new_shares_issued: number;
  new_interest_expense: number;
  lost_interest_income: number;
  years: YearResult[];
};

export type SavedDealSummary = {
  id: number;
  name: string;
  created_at: string;
};

export type SavedDeal = SavedDealSummary & {
  inputs: DealInput;
  results: DealResults;
};