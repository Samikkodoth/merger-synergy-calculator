# Forecasts, pro forma EPS, cash EPS, breakeven synergies, debt, fees, credit, currency.
import pytest

from helpers import M, codes, deal, run
from model.engine import run_model

DEBT_DEAL = {"offer": {"pct_stock": 0.0}}


def tranche(amount, **extra):
    return {"funding": {"tranches": [{"amount": amount, **extra}]}}


def test_accretion_is_measured_against_standalone_forecast():
    # Acquirer NI grows 10% a year: Year 1 standalone EPS = 110 / 50 = $2.20.
    # Pro forma (all stock, 6.5M new shares): (110 + 20) / 56.5 = $2.3009 -> +4.6%.
    year = run(acquirer={"net_income_growth": [0.1] * 5})["years"][0]
    assert year["standalone_eps"] == pytest.approx(2.20)
    assert year["gaap_eps"] == pytest.approx(130 / 56.5)
    assert year["gaap_accretion"] == pytest.approx((130 / 56.5) / 2.2 - 1)


def test_forecast_growth_compounds_and_margins():
    # Revenue 1,000 growing 5%: Y2 = 1,102.5. Base margin 20% (EBITDA 200) -> Y2 EBITDA 220.5.
    standalone = run(acquirer={"revenue": 1000 * M, "ebitda": 200 * M, "revenue_growth": [0.05] * 5})["standalone"]
    assert standalone["acquirer"]["revenue"][1] == pytest.approx(1102.5 * M)
    assert standalone["acquirer"]["ebitda"][1] == pytest.approx(220.5 * M)


def test_debt_schedule_with_amortization():
    # 260M at 10%, 20% of the original amount repaid each year (52M).
    # Interest is on the opening balance: 26.0, 20.8, 15.6, 10.4, 5.2.
    results = run(**DEBT_DEAL, **tranche(260 * M, rate=0.10, amortization_pct=0.2))
    rows = results["debt_schedule"][0]["years"]
    assert [r["interest"] / M for r in rows] == pytest.approx([26.0, 20.8, 15.6, 10.4, 5.2])
    assert rows[-1]["ending"] == pytest.approx(0)
    # Year 2 GAAP NI = 100 + 20 - 20.8 x 0.75 = 104.4
    assert results["years"][1]["gaap_net_income"] == pytest.approx(104.4 * M)


def test_financing_fees_are_amortized_into_interest():
    # 2% fee on a 260M tranche = 5.2M, spread over 4 years = 1.3M/year, 0 in Year 5.
    # Balancing: the fee is itself a use, so set the tranche as the balancing item.
    results = run(**DEBT_DEAL, funding={"tranches": [{"rate": 0.0, "fee_pct": 0.02, "term_years": 4}],
                                       "balancing_item": "tranche_1"})
    fees = [y["components"]["financing_fees"] for y in results["years"]]
    fee = results["sources_uses"]["financing_fees"]
    assert fee == pytest.approx(260 * M / 0.98 * 0.02)
    assert fees == pytest.approx([-fee / 4 * 0.75] * 4 + [0.0])


def test_cash_sweep_repays_debt_early():
    # 260M at 0%, sweep 50% of cash net income. Year 1 cash NI = 100 + 20 = 120 -> 60M repaid.
    rows = run(**DEBT_DEAL, funding={"tranches": [{"amount": 260 * M}],
                                     "fcf_conversion_pct": 0.5})["debt_schedule"][0]["years"]
    assert rows[0]["sweep"] == pytest.approx(60 * M)
    assert rows[1]["beginning"] == pytest.approx(200 * M)


def test_sweep_goes_to_tranches_in_order_after_mandatory():
    # Cash NI 120M x 50% = 60M. Tranche 1 mandatory 10M; the remaining 50M sweeps tranche 1 (40M left) then 10M of tranche 2.
    results = run(**DEBT_DEAL, funding={"fcf_conversion_pct": 0.5, "tranches": [
        {"amount": 50 * M, "amortization_pct": 0.2}, {"amount": 210 * M}]})
    t1, t2 = (t["years"][0] for t in results["debt_schedule"])
    assert (t1["mandatory"], t1["sweep"], t1["ending"]) == pytest.approx((10 * M, 40 * M, 0))
    assert (t2["sweep"], t2["ending"]) == pytest.approx((10 * M, 200 * M))


def test_refinancing_adds_back_target_interest():
    # Target pays 4M of interest; refinanced -> +3M after tax. New debt 40M at 0% replaces it.
    results = run(offer={"debt_treatment": "refinanced"}, target={"debt": 40 * M, "interest_expense": 4 * M},
                  **tranche(40 * M))
    assert results["years"][0]["components"]["refinancing_savings"] == pytest.approx(3 * M)


def test_cash_eps_adds_back_amortization_and_integration():
    # Amortization 6M (4.5 after tax), integration 20M in Year 1 (15 after tax).
    # Cash NI Year 1 = GAAP NI + 4.5 + 15.
    year = run(target={"book_value": 100 * M}, ppa={"intangibles": 60 * M},
               synergies={"integration_costs": 20 * M})["years"][0]
    assert year["cash_net_income"] - year["gaap_net_income"] == pytest.approx(19.5 * M)
    assert year["cash_eps"] == pytest.approx(year["cash_net_income"] / year["pro_forma_shares"])


def test_synergy_haircut_and_dis_synergies():
    # Revenue synergies 40M x 20% margin x 50% probability = 4M. Dis-synergies 2M x 50% phase-in = 1M.
    year = run(synergies={"revenue": 40 * M, "revenue_margin": 0.2, "revenue_probability": 0.5,
                          "dis_synergies": 2 * M, "dis_synergy_phase_in": [0.5] * 5})["years"][0]
    assert year["synergies"]["revenue_profit"] == pytest.approx(4 * M)
    assert year["synergies"]["dis_synergies"] == pytest.approx(1 * M)


def test_breakeven_synergies():
    # All-debt at 7% for 260M: after-tax interest = 13.65M. NI without synergies = 100 + 20 - 13.65 = 106.35.
    # Standalone EPS $2 x 50M = 100 -> accretive already: breakeven = (100 - 106.35) / 0.75 = -8.47M.
    # Offer $60 (600M): interest = 31.5M -> NI 88.5 -> breakeven = 11.5 / 0.75 = 15.33M.
    assert run(**DEBT_DEAL, **tranche(260 * M, rate=0.07))["years"][0]["breakeven_synergies"] == pytest.approx(-6.35 / 0.75 * M)
    breakeven = run(offer={"pct_stock": 0.0, "offer_price": 60}, **tranche(600 * M, rate=0.07))["years"][0]["breakeven_synergies"]
    assert breakeven == pytest.approx(11.5 / 0.75 * M)
    # Check: with exactly that much synergy, EPS equals standalone EPS.
    check = run(offer={"pct_stock": 0.0, "offer_price": 60}, **tranche(600 * M, rate=0.07),
                synergies={"cost": breakeven})["years"][0]
    assert check["gaap_eps"] == pytest.approx(2.0)


def test_credit_metrics_and_flags():
    # EBITDA 150 + 30 = 180M. Debt: acquirer 500 + target 40 + new 260 = 800M -> 4.44x (above 4.0x).
    # Interest: 20 + 3 + 260 x 8% (20.8) = 43.8M -> coverage 4.11x.
    results = run(**DEBT_DEAL, **tranche(260 * M, rate=0.08),
                  acquirer={"ebitda": 150 * M, "debt": 500 * M, "interest_expense": 20 * M},
                  target={"ebitda": 30 * M, "debt": 40 * M, "interest_expense": 3 * M})
    credit = results["years"][0]["credit"]
    assert credit["total_leverage"] == pytest.approx(800 / 180)
    assert credit["interest_coverage"] == pytest.approx(180 / 43.8)
    assert credit["leverage_breach"] and not credit["coverage_breach"]
    assert "leverage_breach" in codes(results)


def test_credit_net_debt_uses_remaining_cash():
    # Acquirer cash 100M, 60M used -> 40M left; target cash 10M. New debt 200M -> net debt 150M.
    credit = run(offer={"pct_stock": 0.0}, acquirer={"ebitda": 100 * M, "cash": 100 * M},
                 target={"cash": 10 * M},
                 funding={"cash_used": 60 * M, "tranches": [{"amount": 200 * M}]})["years"][0]["credit"]
    assert credit["cash"] == pytest.approx(50 * M)
    assert credit["net_debt"] == pytest.approx(150 * M)


def test_advisory_fees_are_one_time_not_in_eps():
    # 2% x EV 260M = 5.2M, funded with cash; EPS unaffected apart from lost interest (0% here).
    with_fees = run(fees={"advisory_pct": 0.02}, funding={"cash_used": 5.2 * M})
    without = run()
    assert with_fees["one_time"]["advisory_fees"] == pytest.approx(5.2 * M)
    assert with_fees["years"][0]["gaap_eps"] == pytest.approx(without["years"][0]["gaap_eps"])
    assert with_fees["valid"]


def test_12_currency_changes_labels_only():
    usd = run_model(deal(currency="USD", synergies={"cost": 15 * M}))
    inr = run_model(deal(currency="INR", synergies={"cost": 15 * M}))
    assert inr["currency"] == "INR" and usd["currency"] == "USD"
    inr.pop("currency"); usd.pop("currency")
    assert inr == usd


def test_integration_schedule_must_total_100():
    with pytest.raises(ValueError, match="Integration cost schedule"):
        run(synergies={"integration_schedule": [0.5, 0.2, 0, 0, 0]})


def test_simple_mode_ignores_hidden_advanced_inputs():
    # Advanced-only inputs typed earlier (fees, growth, book value) must not leak into simple mode.
    results = run(mode="simple", offer={"price_input": "total", "purchase_price": 260 * M},
                  acquirer={"net_income_growth": [0.1] * 5}, fees={"advisory_pct": 0.05},
                  target={"book_value": 100 * M}, ppa={"intangibles": 60 * M})
    assert results["ppa"] is None
    assert results["one_time"]["advisory_fees"] == 0
    assert results["years"][0]["standalone_eps"] == pytest.approx(2.0)
    assert "cash_sweep" not in codes(results)
