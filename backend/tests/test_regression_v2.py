# Regression tests 1-3 (section 6) through the NEW engine in simple mode.
# The numbers must match the original calculator exactly.
import pytest

from calculator import calculate_deal
from legacy_cases import CASE_1_ALL_DEBT, CASE_1_ALL_STOCK, CASE_1_HALF_HALF, CASE_2
from model.engine import run_model
from model.legacy import legacy_to_v2, parse_deal
from model.sensitivity import run_sensitivity


def new_year(old_inputs, n):
    return run_model(legacy_to_v2(old_inputs))["years"][n - 1]


@pytest.mark.parametrize("case, eps, accretion", [
    (CASE_1_ALL_STOCK, 2.28, 14.1),
    (CASE_1_ALL_DEBT, 2.31, 15.5),
    (CASE_1_HALF_HALF, 2.30, 14.8),
])
def test_case_1(case, eps, accretion):
    y = new_year(case, 1)
    assert round(y["gaap_eps"], 2) == eps
    assert round(y["gaap_accretion"] * 100, 1) == accretion


@pytest.mark.parametrize("n, eps, accretion", [(1, 1.94, -3.0), (2, 2.17, 8.7), (3, 2.37, 18.3)])
def test_case_2(n, eps, accretion):
    y = new_year(CASE_2, n)
    assert round(y["gaap_eps"], 2) == eps
    assert round(y["gaap_accretion"] * 100, 1) == accretion


@pytest.mark.parametrize("case", [CASE_1_ALL_STOCK, CASE_1_ALL_DEBT, CASE_1_HALF_HALF, CASE_2])
def test_matches_original_calculator_to_the_cent(case):
    old = calculate_deal(**case)
    for n in range(1, 4):
        new = new_year(case, n)
        assert new["gaap_eps"] == pytest.approx(old["years"][n - 1]["eps_after"], abs=1e-9)
        assert new["gaap_accretion"] * 100 == pytest.approx(old["years"][n - 1]["accretion_pct"], abs=1e-9)


def test_simple_mode_has_no_errors_or_warnings():
    results = run_model(legacy_to_v2(CASE_2))
    assert results["valid"]
    assert [i for i in results["issues"] if i["level"] != "note"] == []


def test_old_three_year_schedules_extend_to_five_years():
    # Phase-ins stay at their Year 3 level; integration costs are 0% after Year 3.
    new = legacy_to_v2(CASE_2)
    assert new.synergies.cost_phase_in == [0.5, 0.75, 1.0, 1.0, 1.0]
    assert new.synergies.revenue_phase_in == [0.0, 0.5, 1.0, 1.0, 1.0]
    assert new.synergies.integration_schedule == [0.6, 0.3, 0.1, 0.0, 0.0]


def test_parse_deal_accepts_both_formats():
    assert parse_deal(CASE_2).mode == "simple"
    assert parse_deal(legacy_to_v2(CASE_2).model_dump()).mode == "simple"


def grid_year(grid, row, col, n):
    return grid["cells"][row][col]["gaap"][n - 1] * 100


def test_case_3_sensitivity_grid():
    # Columns: price -20%..+20%; rows: synergies +50%..-50%.
    grid = run_sensitivity(legacy_to_v2(CASE_2), "price", "synergies")
    assert round(grid_year(grid, 2, 2, 3), 1) == 18.3
    assert grid_year(grid, 4, 4, 3) == pytest.approx(7.3, abs=0.05)   # price +20%, synergies -50%
    assert grid_year(grid, 0, 0, 3) == pytest.approx(29.6, abs=0.05)  # price -20%, synergies +50%
    assert grid_year(grid, 0, 0, 1) == pytest.approx(2.5, abs=0.05)
    assert round(grid_year(grid, 2, 2, 1), 1) == -3.0
    assert grid_year(grid, 4, 4, 1) == pytest.approx(-8.4, abs=0.05)
