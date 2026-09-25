# Tests 10 and 11 (section 6): partial acquisitions and open offers.
import pytest

from helpers import M, codes, run

# Target EBITDA 30M and debt 40M; acquirer EBITDA 200M. 100% stock, so sources = uses.
COMPANIES = {"acquirer": {"ebitda": 200 * M}, "target": {"ebitda": 30 * M, "debt": 40 * M}}


def test_10_consolidated_partial_acquisition():
    # 60% bought: 6M shares x $26 = 156M. Implied 100% equity value still 260M.
    # Minority interest = 40% x 20M = 8M -> 12M of target income attributable to the acquirer.
    results = run(stake={"bought_pct": 0.6}, **COMPANIES)
    stake, year = results["stake"], results["years"][0]
    assert stake["treatment"] == "consolidate"
    assert stake["cost"] == pytest.approx(156 * M)
    assert results["offer"]["equity_value"] == pytest.approx(260 * M)
    assert year["components"]["minority_interest"] == pytest.approx(-8 * M)
    assert year["components"]["target_net_income"] + year["components"]["minority_interest"] == pytest.approx(12 * M)
    # Credit metrics include 100% of the target: EBITDA 200 + 30, debt 40 (assumed).
    assert year["credit"]["ebitda"] == pytest.approx(230 * M)
    assert year["credit"]["total_debt"] == pytest.approx(40 * M)
    # Only the 156M actually paid goes through sources & uses.
    assert results["sources_uses"]["total_uses"] == pytest.approx(156 * M)
    assert "partial_goodwill" in codes(results)


def test_11_open_offer_full_acceptance():
    # 25% from the promoter + 26% open offer x 100% = 51% -> consolidate.
    # Shares bought 2.5M + 2.6M = 5.1M; cost 5.1M x $26 = 132.6M.
    stake = run(stake={"bought_pct": 0.25, "open_offer_pct": 0.26, "acceptance_pct": 1.0}, **COMPANIES)["stake"]
    assert stake["final_pct"] == pytest.approx(0.51)
    assert stake["treatment"] == "consolidate"
    assert stake["shares_acquired"] == pytest.approx(5.1 * M)
    assert stake["cost"] == pytest.approx(132.6 * M)


def test_11_open_offer_half_acceptance():
    # 25% + 26% x 50% = 38% -> equity method. Shares 2.5M + 1.3M = 3.8M; cost 98.8M.
    # The acquirer includes 38% x 20M = 7.6M; no target EBITDA or debt is consolidated.
    results = run(stake={"bought_pct": 0.25, "open_offer_pct": 0.26, "acceptance_pct": 0.5}, **COMPANIES)
    stake, year = results["stake"], results["years"][0]
    assert stake["final_pct"] == pytest.approx(0.38)
    assert stake["treatment"] == "equity"
    assert stake["shares_acquired"] == pytest.approx(3.8 * M)
    assert stake["cost"] == pytest.approx(98.8 * M)
    assert year["components"]["target_net_income"] == pytest.approx(7.6 * M)
    assert year["components"]["minority_interest"] == 0
    assert year["credit"]["ebitda"] == pytest.approx(200 * M)
    assert year["credit"]["total_debt"] == pytest.approx(0)
    assert results["ppa"] is None
    assert "equity_method" in codes(results)


def test_open_offer_at_a_different_price():
    # 25% at $26 (65M) + 26% at $28 (2.6M x 28 = 72.8M) = 137.8M.
    # Premium paid = 2.5M x 6 + 2.6M x 8 = 35.8M.
    stake = run(stake={"bought_pct": 0.25, "open_offer_pct": 0.26, "open_offer_price": 28})["stake"]
    assert stake["cost"] == pytest.approx(137.8 * M)
    assert stake["premium_paid"] == pytest.approx(35.8 * M)


def test_small_stake_is_a_financial_investment():
    # 15% stake: no target income, no synergies.
    results = run(stake={"bought_pct": 0.15}, synergies={"cost": 15 * M})
    year = results["years"][0]
    assert results["stake"]["treatment"] == "investment"
    assert year["components"]["target_net_income"] == 0
    assert year["components"]["cost_synergies"] == 0
    assert "financial_investment" in codes(results)


def test_treatment_can_be_overridden():
    stake = run(stake={"bought_pct": 0.45, "treatment": "consolidate"})["stake"]
    assert stake["treatment"] == "consolidate"


def test_partial_goodwill_counts_existing_stake_at_offer_price():
    # 10% already owned + 50% bought = 60%. Consideration for goodwill = 130M paid
    # + 10% x 10M x $26 (26M) = 156M. Goodwill = 156 - 60% x 100 book = 96M.
    ppa = run(stake={"existing_pct": 0.1, "bought_pct": 0.5}, target={"book_value": 100 * M})["ppa"]
    assert ppa["consideration"] == pytest.approx(156 * M)
    assert ppa["goodwill"] == pytest.approx(96 * M)


def test_minority_interest_shares_amortization_and_inside_synergies():
    # 60% stake. Write-up amortization 6M pre-tax (4.5M after tax), fully consolidated.
    # 50% of 15M cost synergies realised inside the target: 7.5 x 0.75 = 5.625M after tax.
    # Minority interest = 40% x (20 + 5.625 - 4.5) = 8.45M.
    results = run(stake={"bought_pct": 0.6, "synergies_inside_target_pct": 0.5},
                  target={"book_value": 100 * M}, ppa={"intangibles": 60 * M},
                  synergies={"cost": 15 * M})
    assert results["years"][0]["components"]["minority_interest"] == pytest.approx(-8.45 * M)


def test_equity_method_synergies_inside_target_count_at_stake():
    # 38% stake; 15M cost synergies, 40% inside the target.
    # Counted: 60% + 38% x 40% = 75.2% of 11.25M after tax = 8.46M.
    results = run(stake={"bought_pct": 0.38, "synergies_inside_target_pct": 0.4}, synergies={"cost": 15 * M})
    assert results["years"][0]["components"]["cost_synergies"] == pytest.approx(0.752 * 11.25 * M)


def test_stake_above_100_percent_is_rejected():
    with pytest.raises(ValueError, match="more than 100%"):
        run(stake={"existing_pct": 0.5, "bought_pct": 0.6})


# Acquirer figures are entered AS REPORTED, so they already include any stake
# held in the target before the deal.

def test_reported_net_income_already_includes_an_equity_stake():
    # 25% owned (equity method): reported NI = 100 own + 25% x 20M = 105M.
    # Standalone EPS = 105 / 50 = $2.10; the model must not add the 5M again.
    results = run(acquirer={"net_income": 105 * M, **COMPANIES["acquirer"]}, target=COMPANIES["target"],
                  stake={"existing_pct": 0.25, "bought_pct": 0.26})
    year = results["years"][0]
    assert results["standalone"]["acquirer"]["existing_stake_income"][0] == pytest.approx(5 * M)
    assert year["components"]["acquirer_net_income"] == pytest.approx(105 * M)
    assert year["standalone_eps"] == pytest.approx(2.10)
    assert results["eps_today"] == pytest.approx(2.10)


def test_buying_up_to_51_percent_only_credits_the_additional_stake():
    # 25% owned + 26% bought = 51% -> consolidate. Target NI 20M consolidated, minus the 5M
    # already in reported NI, minus minority interest 49% x 20 = 9.8M -> 5.2M new (26% x 20M).
    # All stock: 2.6M shares x $26 = 67.6M -> 1.69M new acquirer shares.
    # GAAP EPS = (105 + 5.2) / 51.69; accretion vs $2.10 standalone.
    results = run(acquirer={"net_income": 105 * M, **COMPANIES["acquirer"]}, target=COMPANIES["target"],
                  stake={"existing_pct": 0.25, "bought_pct": 0.26})
    year = results["years"][0]
    c = year["components"]
    assert results["stake"]["treatment"] == "consolidate"
    assert c["target_net_income"] + c["minority_interest"] == pytest.approx(5.2 * M)
    assert year["gaap_net_income"] == pytest.approx(110.2 * M)
    assert year["gaap_accretion"] == pytest.approx((110.2 / 51.69) / 2.10 - 1)
    # The equity-method stake wasn't in reported EBITDA or debt; consolidating adds 100% of the target.
    assert year["credit"]["ebitda"] == pytest.approx(230 * M)
    assert year["credit"]["total_debt"] == pytest.approx(40 * M)


def test_existing_equity_stake_bought_up_within_equity_method():
    # 25% owned + 13% bought = 38% (still equity method): new income = 13% x 20M = 2.6M.
    c = run(acquirer={"net_income": 105 * M}, stake={"existing_pct": 0.25, "bought_pct": 0.13})["years"][0]["components"]
    assert c["acquirer_net_income"] == pytest.approx(105 * M)
    assert c["target_net_income"] == pytest.approx(2.6 * M)


# 60% owned, so the target is already consolidated. Reported acquirer figures include 100% of
# the target: EBITDA 200 + 30 = 230M, debt 500 + 40 = 540M, interest 20 + 3 = 23M, and net
# income attributable to the parent 100 + 60% x 20 = 112M.
CONTROLLED = {
    "acquirer": {"net_income": 112 * M, "ebitda": 230 * M, "debt": 540 * M, "interest_expense": 23 * M},
    "target": {"ebitda": 30 * M, "debt": 40 * M, "interest_expense": 3 * M, "book_value": 100 * M},
    "stake": {"existing_pct": 0.6, "bought_pct": 0.4},
    "ppa": {"intangibles": 60 * M},
}


def test_buying_out_the_minority_of_a_controlled_target():
    # Buying the other 40% only removes the minority interest: +8M (40% x 20M).
    # Standalone EPS = 112 / 50 = $2.24. All stock: 4M x $26 / $40 = 2.6M new shares.
    results = run(**CONTROLLED)
    year = results["years"][0]
    c = year["components"]
    assert year["standalone_eps"] == pytest.approx(2.24)
    assert c["acquirer_net_income"] == pytest.approx(112 * M)
    assert c["target_net_income"] + c["minority_interest"] == pytest.approx(8 * M)
    assert year["gaap_net_income"] == pytest.approx(120 * M)
    assert year["gaap_accretion"] == pytest.approx((120 / 52.6) / 2.24 - 1)
    # An equity transaction: no new goodwill, write-ups or amortization.
    assert results["ppa"] is None
    assert c["amortization"] == 0


def test_credit_metrics_dont_double_count_an_already_consolidated_target():
    # Reported EBITDA (230), debt (540) and interest (23) already include the target, so
    # nothing is added: debt / EBITDA = 540 / 230.
    credit = run(**CONTROLLED)["years"][0]["credit"]
    assert credit["ebitda"] == pytest.approx(230 * M)
    assert credit["total_debt"] == pytest.approx(540 * M)
    assert credit["interest_expense"] == pytest.approx(23 * M)
    assert credit["total_leverage"] == pytest.approx(540 / 230)


def test_refinancing_debt_of_a_controlled_target_replaces_it():
    # Refinance the target's 40M (already inside the 540M) with a 40M new loan at 5%:
    # debt stays 540M; interest = 23 - 3 + 40 x 5% = 22M.
    credit = run(**{**CONTROLLED, "offer": {"pct_stock": 1.0, "debt_treatment": "refinanced"},
                    "funding": {"tranches": [{"amount": 40 * M, "rate": 0.05}]}})["years"][0]["credit"]
    assert credit["total_debt"] == pytest.approx(540 * M)
    assert credit["interest_expense"] == pytest.approx(22 * M)


def test_small_existing_stake_is_unchanged():
    # 10% is a financial investment before the deal: nothing in reported NI comes from it,
    # so buying 50% more (to 60%) adds 60% x 20M = 12M.
    results = run(stake={"existing_pct": 0.1, "bought_pct": 0.5})
    c = results["years"][0]["components"]
    assert results["years"][0]["standalone_eps"] == pytest.approx(2.00)
    assert c["target_net_income"] + c["minority_interest"] == pytest.approx(12 * M)
