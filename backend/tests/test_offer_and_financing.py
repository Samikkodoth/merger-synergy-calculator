# Tests 4, 5 and 8 (section 6): offer structure, exchange ratio, sources & uses.
import pytest

from helpers import M, codes, run


def test_4_offer_structure():
    # Premium = 26 / 20 - 1 = 30%. Equity = 26 x 10M = 260M.
    # EV = 260 + net debt 40 = 300M. EV / EBITDA = 300 / 30 = 10.0x.
    offer = run(target={"debt": 40 * M, "ebitda": 30 * M})["offer"]
    assert offer["premium_pct"] == pytest.approx(0.30)
    assert offer["equity_value"] == pytest.approx(260 * M)
    assert offer["enterprise_value"] == pytest.approx(300 * M)
    assert offer["ev_ebitda"] == pytest.approx(10.0)


def test_offer_multiples_and_premium_paid():
    # Revenue 150M -> EV/Revenue = 300 / 150 = 2.0x. Target EPS = 20 / 10 = $2 -> P/E = 26 / 2 = 13x.
    # Net debt = 50 debt - 10 cash = 40. Premium paid = (26 - 20) x 10M = 60M.
    results = run(target={"debt": 50 * M, "cash": 10 * M, "revenue": 150 * M})
    assert results["offer"]["net_debt"] == pytest.approx(40 * M)
    assert results["offer"]["ev_revenue"] == pytest.approx(2.0)
    assert results["offer"]["pe"] == pytest.approx(13.0)
    assert results["stake"]["premium_paid"] == pytest.approx(60 * M)


def test_preferred_stock_and_minority_interest_add_to_ev():
    # EV = 260 + 0 net debt + 5 preferred + 7 minority interest = 272M
    results = run(target={"preferred_stock": 5 * M, "minority_interest": 7 * M})
    assert results["offer"]["enterprise_value"] == pytest.approx(272 * M)


def test_5_exchange_ratio_and_ownership():
    # Stock part = 26 x 50% = $13; ratio = 13 / 40 = 0.325x; 0.325 x 10M = 3.25M shares.
    # Target holders own 3.25 / (50 + 3.25) = 6.1%.
    results = run(offer={"pct_stock": 0.5}, target={"debt": 40 * M})
    consideration, ownership = results["consideration"], results["ownership"]
    assert consideration["stock_per_share"] == pytest.approx(13.0)
    assert consideration["exchange_ratio"] == pytest.approx(0.325)
    assert consideration["shares_issued"] == pytest.approx(3.25 * M)
    assert round(ownership["target_holders_pct"] * 100, 1) == 6.1


def test_new_equity_raised_and_three_way_ownership():
    # 50% stock: 3.25M shares to target holders. Raise $130M at $32.50 -> 4M new shares.
    # Total 57.25M shares: existing 87.3%, target 5.7%, new investors 7.0%.
    results = run(offer={"pct_stock": 0.5},
                  funding={"new_equity_amount": 130 * M, "new_equity_price": 32.5})
    ownership = results["ownership"]
    assert results["valid"]
    assert ownership["shares_to_new_investors"] == pytest.approx(4 * M)
    assert ownership["pro_forma_shares"] == pytest.approx(57.25 * M)
    assert ownership["existing_pct"] + ownership["target_holders_pct"] + ownership["new_investors_pct"] == pytest.approx(1.0)
    assert round(ownership["new_investors_pct"] * 100, 1) == 7.0


def totals(results):
    su = results["sources_uses"]
    return su["total_sources"], su["total_uses"]


def test_8_all_stock_deal_balances():
    results = run()
    sources, uses = totals(results)
    assert sources == pytest.approx(uses) == pytest.approx(260 * M)
    assert results["valid"]


def test_8_balancing_tranche_closes_the_gap_including_fees():
    # 50% stock = 130M. Cash still needed: 130M + advisory 1% x EV 300M = 133M.
    # The tranche has a 2% fee, so it must be 133 / 0.98 = 135.714M (fee 2.714M).
    results = run(
        offer={"pct_stock": 0.5},
        target={"debt": 40 * M},
        fees={"advisory_pct": 0.01},
        funding={"tranches": [{"amount": 0, "rate": 0.07, "fee_pct": 0.02}], "balancing_item": "tranche_1"},
    )
    su = results["sources_uses"]
    assert su["tranche_amounts"][0] == pytest.approx(133 * M / 0.98)
    assert su["financing_fees"] == pytest.approx(133 * M / 0.98 * 0.02)
    sources, uses = totals(results)
    assert sources == pytest.approx(uses)
    assert results["valid"]


def test_8_balancing_with_cash():
    # 100% cash deal: 260M of cash, with 100M of debt entered -> cash fills 160M.
    results = run(offer={"pct_stock": 0.0},
                  funding={"tranches": [{"amount": 100 * M, "rate": 0.07}], "balancing_item": "cash"})
    assert results["sources_uses"]["cash_used"] == pytest.approx(160 * M)
    assert results["valid"]


def test_8_unbalanced_setup_reports_the_gap():
    # 0% stock: 260M needed, only 200M of debt entered -> sources are 60M short.
    results = run(offer={"pct_stock": 0.0}, funding={"tranches": [{"amount": 200 * M, "rate": 0.07}]})
    assert not results["valid"]
    assert results["sources_uses"]["gap"] == pytest.approx(-60 * M)
    issue = next(i for i in results["issues"] if i["code"] == "sources_uses_gap")
    assert issue["level"] == "error"
    assert "60,000,000" in issue["message"] and "less" in issue["message"]


def test_refinanced_target_debt_is_a_use_of_funds():
    # 100% stock pays for equity (260M); refinancing 40M of target debt needs 40M of new debt.
    results = run(offer={"debt_treatment": "refinanced"}, target={"debt": 40 * M},
                  funding={"tranches": [{"amount": 40 * M, "rate": 0.07}]})
    su = results["sources_uses"]
    assert su["refinanced_debt"] == pytest.approx(40 * M)
    assert results["valid"]


def test_minimum_cash_balance_is_enforced():
    # Cash 100M, minimum 50M -> only 50M available, but 60M is used.
    results = run(offer={"pct_stock": 200 / 260},
                  acquirer={"cash": 100 * M, "min_cash": 50 * M},
                  funding={"cash_used": 60 * M})
    assert "cash_below_minimum" in codes(results)
    assert not results["valid"]


def test_balancing_item_must_exist():
    with pytest.raises(ValueError, match="Tranche 2"):
        run(funding={"balancing_item": "tranche_2"})
