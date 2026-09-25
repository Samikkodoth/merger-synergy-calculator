# Regression tests 1-3 (section 6) run against the ORIGINAL calculator.
# They pin down today's behaviour so the new engine can be compared with it.
import pytest

from calculator import calculate_deal
from legacy_cases import (
    CASE_1_ALL_DEBT, CASE_1_ALL_STOCK, CASE_1_HALF_HALF, CASE_2,
    PRICE_CHANGES, SYNERGY_CHANGES,
)


def year(inputs, n):
    return calculate_deal(**inputs)["years"][n - 1]


def test_case_1_all_stock():
    # 7.5M new shares; NI = 100 + 20 + 15 x 0.75 = 131.25 -> 131.25 / 57.5 = $2.28
    result = calculate_deal(**CASE_1_ALL_STOCK)
    assert result["eps_before"] == pytest.approx(2.00)
    assert round(result["years"][0]["eps_after"], 2) == 2.28
    assert round(result["years"][0]["accretion_pct"], 1) == 14.1


def test_case_1_all_debt():
    # NI = 131.25 - 300 x 7% x 0.75 = 115.5 -> / 50 = 2.31 -> +15.5%
    assert round(year(CASE_1_ALL_DEBT, 1)["accretion_pct"], 1) == 15.5


def test_case_1_half_stock_half_debt():
    assert round(year(CASE_1_HALF_HALF, 1)["accretion_pct"], 1) == 14.8


@pytest.mark.parametrize("n, eps, accretion", [(1, 1.94, -3.0), (2, 2.17, 8.7), (3, 2.37, 18.3)])
def test_case_2_multi_year(n, eps, accretion):
    y = year(CASE_2, n)
    assert round(y["eps_after"], 2) == eps
    assert round(y["accretion_pct"], 1) == accretion


def grid_cell(price_change, synergy_change, n):
    scenario = {
        **CASE_2,
        "purchase_price": CASE_2["purchase_price"] * (1 + price_change),
        "cost_synergies": CASE_2["cost_synergies"] * (1 + synergy_change),
        "revenue_synergies": CASE_2["revenue_synergies"] * (1 + synergy_change),
    }
    return year(scenario, n)["accretion_pct"]


def test_case_3_sensitivity_corners():
    assert round(grid_cell(0, 0, 3), 1) == 18.3
    assert grid_cell(0.20, -0.50, 3) == pytest.approx(7.3, abs=0.05)
    assert grid_cell(-0.20, 0.50, 3) == pytest.approx(29.6, abs=0.05)
    assert grid_cell(-0.20, 0.50, 1) == pytest.approx(2.5, abs=0.05)
    assert round(grid_cell(0, 0, 1), 1) == -3.0
    assert grid_cell(0.20, -0.50, 1) == pytest.approx(-8.4, abs=0.05)
    assert len(PRICE_CHANGES) == len(SYNERGY_CHANGES) == 5
