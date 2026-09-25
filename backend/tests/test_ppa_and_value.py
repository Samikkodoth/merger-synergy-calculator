# Tests 6 and 7 (section 6): purchase price allocation and value creation.
import pytest

from helpers import M, codes, run


def test_6_ppa():
    # Equity price 260M, book 100M, intangibles 60M over 10 years, tax 25%.
    # DTL = 60 x 25% = 15M. Goodwill = 260 - (100 + 60 - 15) = 115M.
    # Amortization = 60 / 10 = 6M pre-tax = 4.5M after tax.
    results = run(target={"book_value": 100 * M}, ppa={"intangibles": 60 * M, "intangibles_life": 10})
    ppa = results["ppa"]
    assert ppa["deferred_tax_liability"] == pytest.approx(15 * M)
    assert ppa["goodwill"] == pytest.approx(115 * M)
    assert ppa["amortization"] == pytest.approx([6 * M] * 5)
    assert results["years"][0]["components"]["amortization"] == pytest.approx(-4.5 * M)


def test_ppa_intangibles_as_share_of_excess_and_ppe():
    # Excess = 260 - 100 = 160M; 50% -> intangibles 80M. PP&E write-up 20M over 4 years.
    # DTL = (80 + 20) x 25% = 25M. Goodwill = 260 - (100 + 100 - 25) = 85M.
    # Year 1-4 amortization = 80/10 + 20/4 = 13M; Year 5 = 8M (PP&E fully depreciated).
    results = run(target={"book_value": 100 * M},
                  ppa={"intangibles_input": "pct_of_excess", "intangibles": 0.5,
                       "ppe_writeup": 20 * M, "ppe_life": 4})
    ppa = results["ppa"]
    assert ppa["intangibles_write_up"] == pytest.approx(80 * M)
    assert ppa["goodwill"] == pytest.approx(85 * M)
    assert ppa["amortization"] == pytest.approx([13 * M] * 4 + [8 * M])


def test_negative_goodwill_warns():
    # Book value 300M exceeds the 260M price.
    assert "negative_goodwill" in codes(run(target={"book_value": 300 * M}))


def test_no_ppa_without_book_value():
    assert run()["ppa"] is None


def test_7_value_creation():
    # Pre-tax cost synergies 15M from Year 1 -> 11.25M after tax, every year.
    # r = 10%, g = 0% -> PV = 11.25 / 0.10 = 112.5M (5 years + terminal value).
    # Premium paid = (26 - 20) x 10M = 60M -> value created = 52.5M.
    value = run(synergies={"cost": 15 * M}, valuation={"discount_rate": 0.10, "terminal_growth": 0.0})["value"]
    assert value["pv_synergies"] == pytest.approx(112.5 * M)
    assert value["premium_paid"] == pytest.approx(60 * M)
    assert value["value_created"] == pytest.approx(52.5 * M)


def test_value_creation_with_growth_and_integration_costs():
    # 11.25M after-tax synergies; integration 20M in Year 1 (15M after tax), r = 10%, g = 2%.
    # Years: Y1 = 11.25 - 15 = -3.75, Y2-5 = 11.25.
    # TV = 11.25 x 1.02 / 0.08 = 143.4375M, discounted by 1.1^5.
    value = run(synergies={"cost": 15 * M, "integration_costs": 20 * M},
                valuation={"discount_rate": 0.10, "terminal_growth": 0.02})["value"]
    flows = [-3.75, 11.25, 11.25, 11.25, 11.25]
    expected = sum(f / 1.1 ** (i + 1) for i, f in enumerate(flows)) + 143.4375 / 1.1 ** 5
    assert value["terminal_value"] == pytest.approx(143.4375 * M)
    assert value["pv_synergies"] == pytest.approx(expected * M)


def test_discount_rate_must_exceed_growth():
    results = run(valuation={"discount_rate": 0.03, "terminal_growth": 0.03})
    assert results["value"]["valid"] is False
    assert "value_rates" in codes(results)
