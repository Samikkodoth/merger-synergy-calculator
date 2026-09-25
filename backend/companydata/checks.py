# checks.py
# Warnings about a company's auto-filled data: missing items, stale filings
# and numbers that look unusual. Nothing here changes a number; it only flags.

from datetime import date, timedelta

from companydata.xbrl import BASES, LABELS

# Fields the calculator fills in. Pre-tax income and income tax only feed the
# tax rate, so they are covered by it.
FILLED_FIELDS = [
    "revenue", "ebitda", "net_income", "interest_expense", "tax_rate",
    "cash", "book_equity", "total_debt", "diluted_shares", "shares_outstanding",
]

STALE_AFTER = timedelta(days=456)  # about 15 months
US_TAX_ROUGHLY = 0.21
ONE_TIME_GAP = 0.35  # net income more than 35% away from what operating income suggests


def issue(level, code, message, basis=None):
    """basis: "ttm" or "fy" when the warning only applies to that basis, else None."""
    return {"level": level, "code": code, "message": message, "basis": basis}


def value(profile, name, basis):
    return profile["fields"][name][basis]["value"]


def missing_fields(profile):
    found = []
    for name in FILLED_FIELDS:
        for basis in BASES:
            field = profile["fields"][name][basis]
            if field["value"] is not None:
                continue
            if name == "shares_outstanding":
                found.append(issue("note", "shares_fallback", "The cover page doesn't report shares outstanding, "
                                   "so the weighted average diluted count is used for the target.", basis))
            else:
                found.append(issue("warning", f"missing_{name}",
                                   f"{LABELS[name]} not found. {field['reason']}. Enter it manually.", basis))
    return found


def unusual_numbers(profile):
    found = []
    for basis in BASES:
        ebitda = value(profile, "ebitda", basis)
        if ebitda is not None and ebitda < 0:
            found.append(issue("warning", f"negative_ebitda_{basis}",
                               "EBITDA is negative. Multiples and credit metrics won't mean much.", basis))

        # Net income far from (operating income − interest) × (1 − 21%) suggests
        # one-time items such as gains on sales, impairments or legal charges.
        operating = value(profile, "operating_income", basis)
        income = value(profile, "net_income", basis)
        interest = value(profile, "interest_expense", basis) or 0
        if operating is not None and income is not None:
            expected = (operating - interest) * (1 - US_TAX_ROUGHLY)
            if expected > 0 and abs(income - expected) > ONE_TIME_GAP * expected:
                found.append(issue(
                    "warning", f"one_time_items_{basis}",
                    "Net income is far from what operating income suggests. There may be large "
                    "one-time items (gains, impairments, legal charges) or non-operating income "
                    "(e.g. from stakes in other companies): check the filing and consider entering "
                    "an adjusted figure.", basis))

        rate = value(profile, "tax_rate", basis)
        if rate is not None and not 0 <= rate <= 0.40:
            found.append(issue("warning", f"tax_rate_{basis}",
                               f"The effective tax rate is {rate:.1%}, outside the usual 0–40%. "
                               "Don't use it for the deal without checking why.", basis))
    return found


def review(profile, today=None):
    """All the warnings for one company."""
    today = today or date.today()
    found = missing_fields(profile)

    balance_date = profile.get("balance_date")
    if balance_date and date.fromisoformat(balance_date) < today - STALE_AFTER:
        found.append(issue("warning", "stale",
                           f"The latest filing with figures is for the period to {balance_date}, more than "
                           "15 months ago. The company may have stopped filing, or been acquired."))

    sic = profile.get("sic")
    if sic and 6000 <= int(sic) <= 6799:
        found.append(issue("warning", "financial_company",
                           f"{profile['industry']}: for banks, insurers and REITs, EBITDA, debt and interest "
                           "don't mean what they do for other companies. Treat those figures with care."))

    found.extend(unusual_numbers(profile))

    for name, growth in profile["growth"].items():
        if growth["value"] is None:
            found.append(issue("note", f"no_growth_{name}",
                               f"No historical {LABELS[name].lower()} growth: {growth['reason']}."))
    return found
