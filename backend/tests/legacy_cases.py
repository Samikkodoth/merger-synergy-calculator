# The example deals from section 6 of the upgrade plan, in the old input format.
# Shared by the regression tests for the old calculator and the new engine.

CASE_1 = {
    "acquirer_net_income": 100e6,
    "acquirer_shares": 50e6,
    "acquirer_share_price": 40,
    "target_net_income": 20e6,
    "purchase_price": 300e6,
    "tax_rate": 0.25,
    "pct_stock": 1.0,
    "pct_cash": 0.0,
    "pct_debt": 0.0,
    "interest_rate_on_cash": 0.04,
    "interest_rate_on_debt": 0.07,
    "cost_synergies": 15e6,
    "cost_synergy_phase_in": [1.0, 1.0, 1.0],
    "revenue_synergies": 0,
    "revenue_synergy_margin": 0,
    "revenue_synergy_phase_in": [0.0, 0.0, 0.0],
    "integration_costs": 0,
    "integration_cost_schedule": [1.0, 0.0, 0.0],
}

CASE_1_ALL_STOCK = CASE_1
CASE_1_ALL_DEBT = {**CASE_1, "pct_stock": 0.0, "pct_debt": 1.0}
CASE_1_HALF_HALF = {**CASE_1, "pct_stock": 0.5, "pct_debt": 0.5}

CASE_2 = {
    **CASE_1_HALF_HALF,
    "cost_synergy_phase_in": [0.50, 0.75, 1.00],
    "revenue_synergies": 40e6,
    "revenue_synergy_margin": 0.20,
    "revenue_synergy_phase_in": [0.00, 0.50, 1.00],
    "integration_costs": 30e6,
    "integration_cost_schedule": [0.60, 0.30, 0.10],
}

# Today's sensitivity grid: purchase price -20%..+20% (columns),
# synergies +50%..-50% (rows), cost and revenue synergies scaled together.
PRICE_CHANGES = [-0.20, -0.10, 0.0, 0.10, 0.20]
SYNERGY_CHANGES = [0.50, 0.25, 0.0, -0.25, -0.50]
