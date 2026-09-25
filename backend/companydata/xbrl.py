# xbrl.py
# Turns the SEC's "company facts" (every number a company has tagged in its
# 10-K and 10-Q filings) into the figures the calculator needs, and records
# exactly where each one came from. No network code here, so it can be tested
# with saved files.
#
# Companies tag the same item in different ways, so each field has an ordered
# list of options. The first option with a value for the period we need wins.
# An option is (required tags, optional tags); its value is the sum of the tags
# found. Most options are a single tag.

from datetime import date, timedelta

# Bump when the output shape or the rules change, so cached results are rebuilt.
PARSER_VERSION = 2


def one(tag):
    return ([tag], [])


# Items from the income statement or cash flow statement (amounts over a period)
FLOW_FIELDS = {
    "revenue": [
        one("Revenues"),
        one("RevenueFromContractWithCustomerExcludingAssessedTax"),
        one("RevenueFromContractWithCustomerIncludingAssessedTax"),
        one("SalesRevenueNet"),
        one("RevenuesNetOfInterestExpense"),
    ],
    "operating_income": [one("OperatingIncomeLoss")],
    "d_and_a": [
        one("DepreciationDepletionAndAmortization"),
        one("DepreciationAmortizationAndAccretionNet"),
        one("DepreciationAndAmortization"),
        (["Depreciation"], ["AmortizationOfIntangibleAssets"]),
    ],
    "net_income": [
        one("NetIncomeLoss"),
        one("NetIncomeLossAvailableToCommonStockholdersBasic"),
        one("ProfitLoss"),
    ],
    "interest_expense": [
        one("InterestExpense"),
        one("InterestExpenseNonoperating"),
        one("InterestExpenseDebt"),
        one("InterestAndDebtExpense"),
    ],
    "income_tax": [one("IncomeTaxExpenseBenefit")],
    "pretax_income": [
        one("IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest"),
        one("IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments"),
    ],
}

# Items from the balance sheet (amounts on a date)
BALANCE_FIELDS = {
    "cash": [
        one("CashAndCashEquivalentsAtCarryingValue"),
        one("CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"),
        one("Cash"),
    ],
    "book_equity": [
        one("StockholdersEquity"),
        one("StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"),
    ],
}

# Total debt = long-term debt (including the part due within a year) + short-term borrowings
LONG_TERM_DEBT = [
    one("LongTermDebt"),
    one("LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities"),
    (["LongTermDebtNoncurrent"], ["LongTermDebtCurrent"]),
    (["LongTermDebtAndCapitalLeaseObligations"], ["LongTermDebtAndCapitalLeaseObligationsCurrent"]),
]
SHORT_TERM_DEBT = [
    one("ShortTermBorrowings"),
    ([], ["CommercialPaper", "OtherShortTermBorrowings"]),
]

DILUTED_SHARES = [one("WeightedAverageNumberOfDilutedSharesOutstanding")]
COVER_SHARES_TAG = "EntityCommonStockSharesOutstanding"

LABELS = {
    "revenue": "Revenue",
    "operating_income": "Operating income",
    "d_and_a": "Depreciation & amortization",
    "ebitda": "EBITDA",
    "net_income": "Net income",
    "interest_expense": "Interest expense",
    "income_tax": "Income tax",
    "pretax_income": "Pre-tax income",
    "tax_rate": "Effective tax rate",
    "cash": "Cash",
    "book_equity": "Book value of equity",
    "total_debt": "Total debt",
    "diluted_shares": "Diluted shares (weighted average)",
    "shares_outstanding": "Shares outstanding",
}

ALL_TAGS = sorted({
    tag
    for options in [*FLOW_FIELDS.values(), *BALANCE_FIELDS.values(), LONG_TERM_DEBT, SHORT_TERM_DEBT, DILUTED_SHARES]
    for required, optional in options
    for tag in required + optional
})

BASES = ("ttm", "fy")


class UnsupportedCompany(Exception):
    """The company doesn't file 10-Ks/10-Qs with US GAAP figures in USD."""


def to_date(text):
    return date.fromisoformat(text)


def days(fact):
    return (to_date(fact["end"]) - to_date(fact["start"])).days + 1


# ---------------------------------------------------------------- Filings

def filing_url(cik, accession, document=None):
    folder = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession.replace('-', '')}"
    return f"{folder}/{document}" if document else f"{folder}/{accession}-index.htm"


def filings_index(submissions):
    """Every recent filing by accession number, newest first."""
    recent = submissions["filings"]["recent"]
    cik = submissions["cik"]
    index = {}
    for i, accession in enumerate(recent["accessionNumber"]):
        index[accession] = {
            "form": recent["form"][i],
            "accession": accession,
            "report_date": recent["reportDate"][i] or None,
            "filed": recent["filingDate"][i],
            "url": filing_url(cik, accession, recent["primaryDocument"][i] or None),
        }
    return index


def accessions_with_facts(companyfacts):
    gaap = companyfacts.get("facts", {}).get("us-gaap", {})
    return {fact["accn"] for body in gaap.values() for rows in body["units"].values() for fact in rows}


def latest_filings(submissions, companyfacts):
    """The latest 10-K, and the latest 10-Q if it is newer than that 10-K.

    The SEC adds a filing's numbers to the company facts a little after the
    filing appears, so only filings whose numbers are there already count.
    """
    index = filings_index(submissions)
    usable = accessions_with_facts(companyfacts)

    def latest(form):
        return next((f for f in index.values()
                     if f["form"] == form and f["report_date"] and f["accession"] in usable), None)

    annual, quarterly = latest("10-K"), latest("10-Q")
    if annual and quarterly and quarterly["report_date"] <= annual["report_date"]:
        quarterly = None
    return annual, quarterly, index


# ---------------------------------------------------------------- Looking up one tag

class Facts:
    def __init__(self, companyfacts, index, cik):
        self.gaap = companyfacts.get("facts", {}).get("us-gaap", {})
        self.dei = companyfacts.get("facts", {}).get("dei", {})
        self.index = index
        self.cik = cik

    def of(self, tag, unit="USD", taxonomy="us-gaap"):
        source = self.gaap if taxonomy == "us-gaap" else self.dei
        return source.get(tag, {}).get("units", {}).get(unit, [])

    def filing(self, accession):
        known = self.index.get(accession)
        if known:
            return known
        return {"form": None, "accession": accession, "report_date": None, "filed": None,
                "url": filing_url(self.cik, accession)}


def period(fact, role, tag, facts):
    filing = facts.filing(fact["accn"])
    return {
        "role": role,
        "tag": tag,
        "value": fact["val"],
        "start": fact.get("start"),
        "end": fact["end"],
        "form": fact.get("form") or filing["form"],
        "filed": fact.get("filed") or filing["filed"],
        "accession": fact["accn"],
        "url": filing["url"],
    }


def instant(facts, tag, unit, accession, end):
    for fact in facts.of(tag, unit):
        if fact["accn"] == accession and fact["end"] == end and "start" not in fact:
            return fact
    return None


def duration(facts, tag, unit, accession, end, min_days, max_days):
    """The longest period in this filing ending on `end` with a length in range."""
    found = [
        f for f in facts.of(tag, unit)
        if f["accn"] == accession and f["end"] == end and "start" in f and min_days <= days(f) <= max_days
    ]
    return max(found, key=days, default=None)


def prior_ytd(facts, tag, unit, accession, current):
    """The same year-to-date period one year earlier, as shown for comparison in the same 10-Q."""
    end = to_date(current["end"])
    length = days(current)
    for fact in facts.of(tag, unit):
        if fact["accn"] != accession or "start" not in fact:
            continue
        gap = (end - to_date(fact["end"])).days
        if 357 <= gap <= 372 and abs(days(fact) - length) <= 7:
            return fact
    return None


# ---------------------------------------------------------------- Values for one period basis

def flow_value(facts, tag, unit, basis, annual, quarterly):
    """One tag's value for a basis, with the facts it was built from.

    "fy":  the latest fiscal year, from the 10-K.
    "ttm": trailing twelve months = fiscal year + this year to date − the same
           period last year. If the 10-K is the latest filing, TTM = fiscal year.
    """
    if annual is None:
        return None
    fy = duration(facts, tag, unit, annual["accession"], annual["report_date"], 350, 380)
    if fy is None:
        return None
    if basis == "fy" or quarterly is None:
        return fy["val"], [period(fy, "Fiscal year", tag, facts)]

    ytd = duration(facts, tag, unit, quarterly["accession"], quarterly["report_date"], 60, 349)
    if ytd is None:
        return None
    # This year's year-to-date must start right after the fiscal year in the 10-K
    if abs((to_date(ytd["start"]) - to_date(fy["end"])).days - 1) > 7:
        return None
    before = prior_ytd(facts, tag, unit, quarterly["accession"], ytd)
    if before is None:
        return None
    value = fy["val"] + ytd["val"] - before["val"]
    return value, [
        period(fy, "Fiscal year", tag, facts),
        period(ytd, "Plus: year to date", tag, facts),
        period(before, "Less: same period last year", tag, facts),
    ]


def pick(options, lookup):
    """Try each option in order; return the first with all its required tags found."""
    for required, optional in options:
        found = [(tag, lookup(tag)) for tag in required]
        if any(result is None for _, result in found):
            continue
        extra = [(tag, lookup(tag)) for tag in optional]
        parts = found + [(tag, result) for tag, result in extra if result is not None]
        if not parts:
            continue
        return {
            "value": sum(result[0] for _, result in parts),
            "tags": [tag for tag, _ in parts],
            "periods": [p for _, result in parts for p in result[1]],
        }
    return None


def missing(reason):
    return {"value": None, "tags": [], "periods": [], "reason": reason}


# Items that can't be negative. A negative value usually means the company
# flipped the sign in one filing, so that tag isn't trusted.
NON_NEGATIVE = {"revenue", "d_and_a", "interest_expense", "diluted_shares"}


def flow_field(facts, name, basis, annual, quarterly, unit="USD", options=None):
    options = options or FLOW_FIELDS[name]
    rejected = []

    def lookup(tag):
        result = flow_value(facts, tag, unit, basis, annual, quarterly)
        if result is not None and name in NON_NEGATIVE and any(p["value"] < 0 for p in result[1]):
            rejected.append(tag)
            return None
        return result

    found = pick(options, lookup)
    if found:
        return found
    if rejected:
        return missing(f"{LABELS[name]} is negative in at least one filing ({', '.join(rejected)}), "
                       "which suggests the sign differs between filings")
    return missing(f"No {LABELS[name].lower()} found for this period in the filings")


def balance_field(facts, name, options, filing):
    if filing is None:
        return missing("No 10-K or 10-Q found")

    def lookup(tag):
        fact = instant(facts, tag, "USD", filing["accession"], filing["report_date"])
        return None if fact is None else (fact["val"], [period(fact, "Balance sheet", tag, facts)])

    return pick(options, lookup)


def total_debt(facts, filing):
    long_term = balance_field(facts, "total_debt", LONG_TERM_DEBT, filing)
    if long_term is None:
        return missing("No debt tags found on the latest balance sheet. The company may have no "
                       "debt, or tags it differently: check the balance sheet")
    short_term = balance_field(facts, "total_debt", SHORT_TERM_DEBT, filing)
    result = long_term
    note = "Long-term debt including the part due within a year"
    if short_term:
        result = {
            "value": long_term["value"] + short_term["value"],
            "tags": long_term["tags"] + short_term["tags"],
            "periods": long_term["periods"] + short_term["periods"],
        }
        note += ", plus short-term borrowings"
    else:
        note += "; no short-term borrowings reported"
    result["note"] = note + ". Operating leases are not included."
    return result


def diluted_shares(facts, basis, annual, quarterly):
    """Weighted average diluted shares: the latest quarter for TTM, the fiscal year for FY."""
    tag = DILUTED_SHARES[0][0][0]
    if basis == "ttm" and quarterly is not None:
        fact = duration(facts, tag, "shares", quarterly["accession"], quarterly["report_date"], 80, 100)
        if fact is not None:
            return {"value": fact["val"], "tags": [tag], "periods": [period(fact, "Latest quarter", tag, facts)]}
    return flow_field(facts, "diluted_shares", "fy", annual, None, unit="shares", options=DILUTED_SHARES)


def cover_shares(facts):
    """Shares outstanding from the cover page of the latest filing, with its "as of" date."""
    rows = facts.of(COVER_SHARES_TAG, "shares", taxonomy="dei")
    if not rows:
        return missing("The filings' cover pages don't report shares outstanding")
    latest = max(rows, key=lambda f: (f.get("filed", ""), f["end"]))
    same = [f for f in rows if f["accn"] == latest["accn"] and f["end"] == latest["end"]]
    values = sorted({f["val"] for f in same})
    result = {
        "value": sum(values),
        "tags": [f"dei:{COVER_SHARES_TAG}"],
        "periods": [period(latest, f"Cover page, as of {latest['end']}", f"dei:{COVER_SHARES_TAG}", facts)],
        "as_of": latest["end"],
        "note": "Basic shares outstanding. Options, RSUs and convertibles are not included.",
    }
    if len(values) > 1:
        result["note"] += f" Sum of {len(values)} share classes."
    return result


def combine(name, first, second, how):
    """EBITDA and the tax rate are built from two other fields."""
    if first["value"] is None or second["value"] is None:
        absent = LABELS[name].lower()
        return missing(f"Can't work out {absent}: " + (first.get("reason") or second.get("reason")))
    if how == "add":
        value = first["value"] + second["value"]
    else:
        if second["value"] == 0:
            return missing("Pre-tax income is zero")
        value = first["value"] / second["value"]
    return {"value": value, "tags": first["tags"] + second["tags"], "periods": first["periods"] + second["periods"]}


# ---------------------------------------------------------------- Historical growth

def annual_series(facts, options):
    """Fiscal-year values from all 10-Ks, by year-end date. Later filings win (restatements)."""
    series = {}
    for required, _ in options:
        if len(required) != 1:
            continue
        tag = required[0]
        by_end = {}
        for fact in facts.of(tag):
            if str(fact.get("form", "")).startswith("10-K") and "start" in fact and 350 <= days(fact) <= 380:
                current = by_end.get(fact["end"])
                if current is None or fact.get("filed", "") > current.get("filed", ""):
                    by_end[fact["end"]] = fact
        for end, fact in by_end.items():
            series.setdefault(end, (tag, fact))
    return series


def cagr(facts, name, annual, years=3):
    """Compound annual growth over the last `years` fiscal years. Historical, not a forecast."""
    if annual is None:
        return {"value": None, "reason": "No 10-K found"}
    series = annual_series(facts, FLOW_FIELDS[name])
    latest_end = to_date(annual["report_date"])
    target = latest_end - timedelta(days=round(365.25 * years))
    base_end = next((end for end in series if abs((to_date(end) - target).days) <= 10), None)
    if annual["report_date"] not in series or base_end is None:
        return {"value": None, "reason": f"Fewer than {years + 1} fiscal years of data"}
    (start_tag, start), (end_tag, end) = series[base_end], series[annual["report_date"]]
    if start["val"] <= 0 or end["val"] <= 0:
        return {"value": None, "reason": "Not meaningful: a loss in the first or last year"}
    return {
        "value": (end["val"] / start["val"]) ** (1 / years) - 1,
        "years": years,
        "from": {"end": base_end, "value": start["val"], "tag": start_tag},
        "to": {"end": annual["report_date"], "value": end["val"], "tag": end_tag},
    }


# ---------------------------------------------------------------- The whole company

def check_supported(companyfacts, submissions, annual, quarterly):
    gaap = companyfacts.get("facts", {}).get("us-gaap", {})
    if annual is None and quarterly is None:
        forms = {f for f in submissions["filings"]["recent"]["form"] if f in ("20-F", "40-F", "6-K")}
        extra = " It files as a foreign company (20-F/40-F)." if forms else ""
        raise UnsupportedCompany(f"No 10-K or 10-Q filings found.{extra} Enter this company's figures manually.")
    if not gaap:
        raise UnsupportedCompany("No US GAAP figures in the filings. Enter this company's figures manually.")
    income = gaap.get("NetIncomeLoss", {}).get("units", {})
    if income and "USD" not in income:
        raise UnsupportedCompany(
            f"Figures are reported in {', '.join(income)}, not USD. Enter this company's figures manually.")


def parse_company(companyfacts, submissions, ticker):
    """Everything the calculator can fill in for one company, with sources."""
    annual, quarterly, index = latest_filings(submissions, companyfacts)
    check_supported(companyfacts, submissions, annual, quarterly)
    facts = Facts(companyfacts, index, submissions["cik"])
    balance_filing = quarterly or annual

    fields = {}
    for basis in BASES:
        values = {name: flow_field(facts, name, basis, annual, quarterly) for name in FLOW_FIELDS}
        values["ebitda"] = combine("ebitda", values["operating_income"], values["d_and_a"], "add")
        values["tax_rate"] = combine("tax_rate", values["income_tax"], values["pretax_income"], "divide")
        values["diluted_shares"] = diluted_shares(facts, basis, annual, quarterly)
        for name, value in values.items():
            fields.setdefault(name, {})[basis] = value

    # The balance sheet is always the latest one, whichever basis is chosen
    balance = {name: balance_field(facts, name, options, balance_filing) for name, options in BALANCE_FIELDS.items()}
    balance = {name: value or missing(f"No {LABELS[name].lower()} on the latest balance sheet")
               for name, value in balance.items()}
    balance["total_debt"] = total_debt(facts, balance_filing)
    balance["shares_outstanding"] = cover_shares(facts)
    for name, value in balance.items():
        fields[name] = {basis: value for basis in BASES}

    def basis_label(basis):
        if basis == "fy" or quarterly is None:
            return f"Fiscal year ended {annual['report_date']}" if annual else "Not available"
        return f"Twelve months to {quarterly['report_date']}"

    return {
        "parser_version": PARSER_VERSION,
        "ticker": ticker.upper(),
        "cik": str(submissions["cik"]).zfill(10),
        "name": submissions.get("name") or companyfacts.get("entityName"),
        "sic": submissions.get("sic") or None,
        "industry": submissions.get("sicDescription") or None,
        "fiscal_year_end": submissions.get("fiscalYearEnd") or None,
        "filings": {"annual": annual, "quarterly": quarterly},
        "balance_date": balance_filing["report_date"] if balance_filing else None,
        "bases": {basis: basis_label(basis) for basis in BASES},
        "fields": fields,
        "growth": {name: cagr(facts, name, annual) for name in ("revenue", "net_income")},
    }
