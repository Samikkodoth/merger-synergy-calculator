# Test case 9: reading financials from saved SEC files for three real companies,
# checking each field comes from the expected tag and period. The files are the
# SEC's own data, trimmed (see fixtures/sec/trim_sample.py). Amounts in $M.
import json
import os
from datetime import date

import pytest

from companydata.checks import review
from companydata.xbrl import UnsupportedCompany, parse_company

M = 1_000_000
FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures", "sec")
TODAY = date(2026, 9, 25)


def load(cik, ticker):
    with open(os.path.join(FIXTURES, f"companyfacts_{cik}.json")) as f:
        facts = json.load(f)
    with open(os.path.join(FIXTURES, f"submissions_{cik}.json")) as f:
        submissions = json.load(f)
    return parse_company(facts, submissions, ticker)


@pytest.fixture(scope="module")
def apple():
    return load("0000320193", "AAPL")


@pytest.fixture(scope="module")
def coke():
    return load("0000021344", "KO")


@pytest.fixture(scope="module")
def microsoft():
    return load("0000789019", "MSFT")


def field(profile, name, basis="ttm"):
    return profile["fields"][name][basis]


def roles(result):
    return [(p["role"], p["tag"], p["start"], p["end"], p["form"]) for p in result["periods"]]


# ---------------------------------------------------------------- Apple (fiscal year ends in September)

def test_apple_company_details(apple):
    assert apple["name"] == "Apple Inc."
    assert apple["cik"] == "0000320193"
    assert apple["industry"] == "Electronic Computers"
    assert apple["filings"]["annual"]["accession"] == "0000320193-25-000079"
    assert apple["filings"]["quarterly"]["accession"] == "0000320193-26-000020"
    assert apple["bases"]["ttm"] == "Twelve months to 2026-06-27"
    assert apple["bases"]["fy"] == "Fiscal year ended 2025-09-27"


def test_apple_revenue_ttm_is_fiscal_year_plus_ytd_minus_prior_ytd(apple):
    # Apple stopped using "Revenues" in 2018, so the second tag in the list is used.
    # TTM = FY to Sep 2025 (416,161) + 9 months to Jun 2026 (364,357) − 9 months to Jun 2025 (313,695)
    revenue = field(apple, "revenue")
    assert revenue["value"] == (416_161 + 364_357 - 313_695) * M == 466_823 * M
    tag = "RevenueFromContractWithCustomerExcludingAssessedTax"
    assert roles(revenue) == [
        ("Fiscal year", tag, "2024-09-29", "2025-09-27", "10-K"),
        ("Plus: year to date", tag, "2025-09-28", "2026-06-27", "10-Q"),
        ("Less: same period last year", tag, "2024-09-29", "2025-06-28", "10-Q"),
    ]
    assert revenue["periods"][0]["filed"] == "2025-10-31"
    assert revenue["periods"][0]["url"] == (
        "https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm")


def test_apple_latest_fiscal_year(apple):
    assert field(apple, "revenue", "fy")["value"] == 416_161 * M
    assert field(apple, "net_income", "fy")["value"] == 112_010 * M
    # EBITDA = operating income 133,050 + D&A 11,698
    ebitda = field(apple, "ebitda", "fy")
    assert ebitda["value"] == (133_050 + 11_698) * M
    assert ebitda["tags"] == ["OperatingIncomeLoss", "DepreciationDepletionAndAmortization"]


def test_apple_net_income_and_tax_rate_ttm(apple):
    # 112,010 + 101,464 − 84,544
    assert field(apple, "net_income")["value"] == 128_930 * M
    # Tax 20,719 + 21,638 − 15,381 = 26,976 over pre-tax 132,729 + 123,102 − 99,925 = 155,906
    assert field(apple, "tax_rate")["value"] == pytest.approx(26_976 / 155_906)


def test_apple_balance_sheet_is_the_latest_10q(apple):
    debt = field(apple, "total_debt")
    # Term debt 82,300 + commercial paper 1,997
    assert debt["value"] == (82_300 + 1_997) * M
    assert debt["tags"] == ["LongTermDebt", "CommercialPaper"]
    assert all(p["end"] == "2026-06-27" and p["form"] == "10-Q" for p in debt["periods"])
    assert "Operating leases are not included" in debt["note"]
    assert field(apple, "cash")["value"] == 39_544 * M
    assert field(apple, "book_equity")["value"] == 107_520 * M
    # The balance sheet is the same whichever basis is chosen
    assert field(apple, "cash", "fy") == field(apple, "cash", "ttm")


def test_apple_shares(apple):
    # Cover page of the Jun 2026 10-Q, as of 17 Jul 2026
    shares = field(apple, "shares_outstanding")
    assert shares["value"] == 14_594_180_000
    assert shares["as_of"] == "2026-07-17"
    assert shares["tags"] == ["dei:EntityCommonStockSharesOutstanding"]
    assert "Options" in shares["note"]
    # Weighted average diluted: the latest quarter for TTM, the fiscal year for FY
    assert field(apple, "diluted_shares")["value"] == 14_714_676_000
    assert roles(field(apple, "diluted_shares"))[0][2:4] == ("2026-03-29", "2026-06-27")
    assert field(apple, "diluted_shares", "fy")["value"] == 15_004_697_000


def test_apple_interest_expense_is_reported_missing_not_guessed(apple):
    # Apple stopped tagging interest expense after fiscal 2023
    assert field(apple, "interest_expense")["value"] is None
    assert field(apple, "ebitda")["value"] is not None
    warnings = [(w["code"], w["basis"]) for w in review(apple, TODAY)]
    assert warnings == [("missing_interest_expense", "ttm"), ("missing_interest_expense", "fy")]


def test_apple_historical_growth(apple):
    # Revenue FY2022 394,328 → FY2025 416,161 over 3 years
    growth = apple["growth"]["revenue"]
    assert growth["value"] == pytest.approx((416_161 / 394_328) ** (1 / 3) - 1)
    assert growth["from"]["end"] == "2022-09-24"
    assert growth["to"]["end"] == "2025-09-27"


# ---------------------------------------------------------------- Coca-Cola (different tags; filing lag)

def test_coke_uses_the_latest_10q_that_has_numbers(coke):
    # The Jul 2026 10-Q is listed, but its numbers aren't in the company facts yet
    assert coke["filings"]["quarterly"]["accession"] == "0001628280-26-028802"
    assert coke["balance_date"] == "2026-04-03"


def test_coke_revenue_uses_the_revenues_tag(coke):
    revenue = field(coke, "revenue")
    # FY 2025 47,941 + Q1 2026 12,472 − Q1 2025 11,129
    assert revenue["value"] == 49_284 * M
    assert revenue["tags"] == ["Revenues"]


def test_coke_debt_falls_back_to_the_second_tag(coke):
    # "LongTermDebt" stopped in 2024, so the next option in the list is used
    debt = field(coke, "total_debt")
    assert debt["tags"] == ["LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities", "CommercialPaper"]
    assert debt["value"] == (43_558 + 250) * M


def test_coke_interest_and_ebitda(coke):
    # Interest 1,654 + 375 − 387; EBITDA = operating income 14,462 + D&A 1,047
    assert field(coke, "interest_expense")["value"] == 1_642 * M
    assert field(coke, "ebitda")["value"] == (14_462 + 1_047) * M


def test_coke_flags_net_income_far_from_operating_income(coke):
    # Expected ≈ (14,462 − 1,642) × 79% = 10,128 vs net income 13,701: 35% above
    codes = [(w["code"], w["basis"]) for w in review(coke, TODAY)]
    assert ("one_time_items_ttm", "ttm") in codes


# ---------------------------------------------------------------- Microsoft (10-K is the latest filing)

def test_microsoft_ttm_equals_the_fiscal_year_after_a_10k(microsoft):
    assert microsoft["filings"]["quarterly"] is None
    assert microsoft["bases"]["ttm"] == "Fiscal year ended 2026-06-30"
    assert field(microsoft, "revenue") == field(microsoft, "revenue", "fy")
    assert field(microsoft, "revenue")["value"] == 331_839 * M


def test_microsoft_d_and_a_adds_depreciation_and_amortization(microsoft):
    # No combined D&A tag: depreciation 34,300 + amortization of intangibles 4,700
    d_and_a = field(microsoft, "d_and_a")
    assert d_and_a["tags"] == ["Depreciation", "AmortizationOfIntangibleAssets"]
    assert d_and_a["value"] == 39_000 * M
    assert field(microsoft, "ebitda")["value"] == (155_237 + 39_000) * M


def test_microsoft_interest_uses_a_fallback_tag(microsoft):
    interest = field(microsoft, "interest_expense")
    assert interest["tags"] == ["InterestExpenseNonoperating"]
    assert interest["value"] == 3_051 * M


def test_microsoft_debt_without_short_term_borrowings(microsoft):
    debt = field(microsoft, "total_debt")
    assert debt["value"] == 40_294 * M
    assert "no short-term borrowings reported" in debt["note"]
    assert review(microsoft, TODAY) == []


# ---------------------------------------------------------------- Made-up files for edge cases

def fact(val, end, accn, start=None, form="10-K", filed="2026-02-01"):
    row = {"val": val, "end": end, "accn": accn, "form": form, "filed": filed}
    if start:
        row["start"] = start
    return row


K = "0000000001-26-000001"


def made_up(gaap, dei=None, sic="3571", forms=("10-K",), report_dates=("2025-12-31",), accessions=(K,)):
    facts = {"entityName": "Test Co", "facts": {"us-gaap": {
        tag: {"units": {"USD" if tag != "WeightedAverageNumberOfDilutedSharesOutstanding" else "shares": rows}}
        for tag, rows in gaap.items()}}}
    if dei is not None:
        facts["facts"]["dei"] = {"EntityCommonStockSharesOutstanding": {"units": {"shares": dei}}}
    submissions = {
        "cik": 1, "name": "Test Co", "sic": sic, "sicDescription": "Test industry", "fiscalYearEnd": "1231",
        "filings": {"recent": {
            "accessionNumber": list(accessions), "filingDate": ["2026-02-01"] * len(forms),
            "reportDate": list(report_dates), "form": list(forms), "primaryDocument": ["doc.htm"] * len(forms)}},
    }
    return facts, submissions


def year(val, tag_end="2025-12-31", start="2025-01-01"):
    return [fact(val, tag_end, K, start)]


def test_first_tag_with_a_value_for_the_period_wins():
    # "Revenues" exists but only for an older year, so the next tag is used
    gaap = {
        "Revenues": [fact(90, "2024-12-31", K, "2024-01-01")],
        "RevenueFromContractWithCustomerExcludingAssessedTax": year(100),
        "NetIncomeLoss": year(10),
    }
    profile = parse_company(*made_up(gaap), "TEST")
    assert profile["fields"]["revenue"]["fy"]["value"] == 100
    assert profile["fields"]["revenue"]["fy"]["tags"] == ["RevenueFromContractWithCustomerExcludingAssessedTax"]


def test_cover_shares_missing_falls_back_with_a_note():
    gaap = {"NetIncomeLoss": year(10), "WeightedAverageNumberOfDilutedSharesOutstanding": year(50)}
    profile = parse_company(*made_up(gaap, dei=[]), "TEST")
    assert profile["fields"]["shares_outstanding"]["fy"]["value"] is None
    codes = [w["code"] for w in review(profile, date(2026, 3, 1))]
    assert "shares_fallback" in codes


def test_cover_shares_from_several_classes_are_added_up():
    dei = [fact(30, "2026-01-20", K, filed="2026-02-01"), fact(20, "2026-01-20", K, filed="2026-02-01")]
    profile = parse_company(*made_up({"NetIncomeLoss": year(10)}, dei=dei), "TEST")
    shares = profile["fields"]["shares_outstanding"]["fy"]
    assert shares["value"] == 50
    assert "Sum of 2 share classes" in shares["note"]


def test_warnings_for_unusual_numbers():
    gaap = {
        "OperatingIncomeLoss": year(-50),
        "DepreciationDepletionAndAmortization": year(10),
        "NetIncomeLoss": year(-30),
        "IncomeTaxExpenseBenefit": year(30),
        "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest": year(60),
    }
    profile = parse_company(*made_up(gaap, sic="6021"), "TEST")
    codes = {w["code"] for w in review(profile, date(2026, 3, 1))}
    # EBITDA −50 + 10 = −40; tax rate 30 / 60 = 50%; SIC 6021 is a bank
    assert {"negative_ebitda_fy", "tax_rate_fy", "financial_company"} <= codes


def test_one_time_items_flag():
    # Expected net income (100 − 0) × 79% = 79; reported 200 is far above it
    gaap = {"OperatingIncomeLoss": year(100), "NetIncomeLoss": year(200)}
    profile = parse_company(*made_up(gaap), "TEST")
    assert "one_time_items_fy" in {w["code"] for w in review(profile, date(2026, 3, 1))}


def test_old_filings_are_flagged_as_stale():
    profile = parse_company(*made_up({"NetIncomeLoss": year(10)}), "TEST")
    assert "stale" not in {w["code"] for w in review(profile, date(2026, 12, 31))}
    # More than 15 months after the Dec 2025 balance sheet
    assert "stale" in {w["code"] for w in review(profile, date(2027, 4, 15))}


def test_ttm_is_missing_when_the_10q_does_not_follow_the_10k():
    q = "0000000001-26-000002"
    gaap = {"NetIncomeLoss": [
        fact(100, "2025-12-31", K, "2025-01-01"),
        # Year to date starting in 2027, not right after the fiscal year in the 10-K
        fact(30, "2027-03-31", q, "2027-01-01", form="10-Q"),
        fact(20, "2026-03-31", q, "2026-01-01", form="10-Q"),
    ]}
    profile = parse_company(*made_up(gaap, forms=("10-Q", "10-K"), report_dates=("2027-03-31", "2025-12-31"),
                                     accessions=(q, K)), "TEST")
    assert profile["fields"]["net_income"]["ttm"]["value"] is None
    assert profile["fields"]["net_income"]["fy"]["value"] == 100


def test_growth_is_not_meaningful_after_a_loss():
    gaap = {"NetIncomeLoss": [fact(-5, "2022-12-31", K, "2022-01-01"), fact(10, "2025-12-31", K, "2025-01-01")]}
    profile = parse_company(*made_up(gaap), "TEST")
    assert profile["growth"]["net_income"]["value"] is None
    assert "loss" in profile["growth"]["net_income"]["reason"]


def test_foreign_filers_are_not_supported():
    facts, submissions = made_up({"NetIncomeLoss": year(10)}, forms=("20-F",))
    with pytest.raises(UnsupportedCompany, match="foreign company"):
        parse_company(facts, submissions, "TEST")


def test_figures_not_in_usd_are_not_supported():
    facts, submissions = made_up({"NetIncomeLoss": year(10)})
    facts["facts"]["us-gaap"]["NetIncomeLoss"]["units"] = {"EUR": year(10)}
    with pytest.raises(UnsupportedCompany, match="EUR"):
        parse_company(facts, submissions, "TEST")
