# The configurable sensitivity grid (section 3.10).
import pytest

from helpers import M, deal
from model.engine import run_model
from model.sensitivity import run_sensitivity

# 50% stock, the rest from a 7% term loan that balances the deal; 15M cost synergies.
ADVANCED = dict(
    offer={"pct_stock": 0.5},
    funding={"tranches": [{"rate": 0.07}], "balancing_item": "tranche_1"},
    synergies={"cost": 15 * M},
)


def cell(grid, row, col, metric="gaap", year=1):
    return grid["cells"][row][col][metric][year - 1]


def test_centre_cell_matches_the_deal():
    d = deal(**ADVANCED)
    base = run_model(d)["years"][0]
    grid = run_sensitivity(d, "premium", "synergies")
    assert cell(grid, 2, 2) == pytest.approx(base["gaap_accretion"])
    assert cell(grid, 2, 2, "cash") == pytest.approx(base["cash_accretion"])


def test_premium_axis_values():
    # Base premium 30% -> 10%, 20%, 30%, 40%, 50%.
    grid = run_sensitivity(deal(**ADVANCED), "premium", "synergies")
    assert grid["x_axis"]["values"] == pytest.approx([0.1, 0.2, 0.3, 0.4, 0.5])


def test_premium_scenario_equals_a_deal_at_that_price():
    # The 50% premium column = offer $30. Same deal typed in directly must match.
    grid = run_sensitivity(deal(**ADVANCED), "premium", "synergies")
    direct = run_model(deal(**{**ADVANCED, "offer": {"pct_stock": 0.5, "offer_price": 30}}))
    assert cell(grid, 2, 4) == pytest.approx(direct["years"][0]["gaap_accretion"])


def test_stock_vs_premium_all_stock_column_has_no_debt_cost():
    # 100% stock at a 30% premium: 6.5M new shares, no debt. EPS = (100 + 20 + 11.25) / 56.5.
    grid = run_sensitivity(deal(**ADVANCED), "pct_stock", "premium")
    assert cell(grid, 2, 4) == pytest.approx((131.25 / 56.5) / 2 - 1)


def test_debt_rate_vs_debt_share():
    # 0% debt financing: the cash part (130M) is paid from cash on hand at 0% interest,
    # so the rate makes no difference. EPS = 131.25 / 53.25.
    grid = run_sensitivity(deal(**ADVANCED), "debt_rate", "pct_debt")
    assert grid["x_axis"]["values"] == pytest.approx([0.05, 0.06, 0.07, 0.08, 0.09])
    row_no_debt = [cell(grid, 0, col) for col in range(5)]
    assert row_no_debt == pytest.approx([131.25 / 53.25 / 2 - 1] * 5)
    # 100% debt at 9%: 130 x 9% x 0.75 = 8.775 of interest.
    assert cell(grid, 4, 4) == pytest.approx((131.25 - 8.775) / 53.25 / 2 - 1)


def test_acceptance_axis_for_open_offers():
    d = deal(stake={"bought_pct": 0.25, "open_offer_pct": 0.26}, offer={"pct_stock": 1.0})
    grid = run_sensitivity(d, "acceptance", "synergies")
    assert grid["x_axis"]["base_index"] == 4
    # 50% acceptance -> 38% stake (equity method): 3.8M shares issued x 26 / 40 = 2.47M new shares.
    assert cell(grid, 2, 2) == pytest.approx((100 + 7.6) / 52.47 / 2 - 1)


def test_every_scenario_balances():
    # The grid resizes funding so each scenario is a valid deal.
    grid = run_sensitivity(deal(**ADVANCED), "price", "pct_stock")
    assert grid["base_valid"]


def test_axis_errors():
    with pytest.raises(ValueError, match="two different"):
        run_sensitivity(deal(**ADVANCED), "price", "price")
    with pytest.raises(ValueError, match="open offer"):
        run_sensitivity(deal(**ADVANCED), "acceptance", "price")
    with pytest.raises(ValueError, match="premium axis"):
        run_sensitivity(deal(mode="simple", offer={"price_input": "total", "purchase_price": 300 * M}),
                        "premium", "price")
