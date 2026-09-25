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


def test_existing_stake_income_is_in_standalone_net_income():
    # 25% already owned (equity method before the deal): 25% x 20M = 5M is already
    # the acquirer's, so standalone NI = 100 + 5 = 105M and standalone EPS = 105 / 50 = $2.10.
    results = run(stake={"existing_pct": 0.25, "bought_pct": 0.26}, **COMPANIES)
    year = results["years"][0]
    assert results["standalone"]["acquirer"]["existing_stake_income"][0] == pytest.approx(5 * M)
    assert year["components"]["acquirer_net_income"] == pytest.approx(105 * M)
    assert year["standalone_eps"] == pytest.approx(2.10)
    assert results["eps_today"] == pytest.approx(2.10)


def test_buying_up_to_51_percent_only_credits_the_additional_stake():
    # 25% owned + 26% bought = 51% -> consolidate. Target NI 20M consolidated, minus the 5M
    # already in standalone NI, minus minority interest 49% x 20 = 9.8M -> 5.2M new (26% x 20M).
    # All stock: 2.6M shares x $26 = 67.6M -> 1.69M new acquirer shares.
    # GAAP EPS = (105 + 5.2) / 51.69; accretion vs $2.10 standalone.
    results = run(stake={"existing_pct": 0.25, "bought_pct": 0.26}, **COMPANIES)
    year = results["years"][0]
    c = year["components"]
    assert results["stake"]["treatment"] == "consolidate"
    assert c["target_net_income"] + c["minority_interest"] == pytest.approx(5.2 * M)
    assert year["gaap_net_income"] == pytest.approx(110.2 * M)
    assert year["gaap_accretion"] == pytest.approx((110.2 / 51.69) / 2.10 - 1)


def test_existing_equity_stake_bought_up_within_equity_method():
    # 25% owned + 13% bought = 38% (still equity method): new income = 13% x 20M = 2.6M.
    c = run(stake={"existing_pct": 0.25, "bought_pct": 0.13})["years"][0]["components"]
    assert c["acquirer_net_income"] == pytest.approx(105 * M)
    assert c["target_net_income"] == pytest.approx(2.6 * M)


def test_existing_controlling_stake_bought_to_100_percent():
    # 60% owned (already consolidated): standalone includes 60% x 20M = 12M.
    # Buying the other 40% adds 8M, with no minority interest left.
    c = run(stake={"existing_pct": 0.6, "bought_pct": 0.4})["years"][0]["components"]
    assert c["acquirer_net_income"] == pytest.approx(112 * M)
    assert c["target_net_income"] + c["minority_interest"] == pytest.approx(8 * M)


def test_small_existing_stake_adds_no_standalone_income():
    # 10% is a financial investment before the deal: its dividends aren't modelled.
    results = run(stake={"existing_pct": 0.1, "bought_pct": 0.5})
    assert results["years"][0]["standalone_eps"] == pytest.approx(2.00)
