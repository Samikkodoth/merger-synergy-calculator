# engine.py
# Runs the whole model in order and collects warnings for the UI.

from model.financing import analyze_consideration, analyze_ownership, resolve_funding
from model.forecast import already_controlled, forecast_standalone
from model.inputs import YEARS, DealInputV2, Fees, PPA, Stake, Tranche, flat
from model.offer import analyze_offer, analyze_stake
from model.ppa import analyze_ppa
from model.proforma import run_years
from model.value import analyze_value


def check_adds_to_100(values, name):
    total = sum(values)
    if abs(total - 1.0) > 0.0001:
        raise ValueError(f"{name} must add up to 100%, but it adds up to {total:.0%}")


def apply_simple_mode(deal: DealInputV2) -> DealInputV2:
    """Simple mode = the original calculator: a typed purchase price paid with a
    stock / cash / debt mix, 0% growth, debt assumed, no fees, no PPA."""
    if deal.mode != "simple":
        return deal

    mix = deal.funding.mix
    check_adds_to_100([deal.offer.pct_stock, mix.pct_cash, mix.pct_debt], "Payment mix")

    d = deal.model_copy(deep=True)
    price = d.offer.purchase_price
    d.offer.price_input = "total"
    d.offer.debt_treatment = "assumed"
    d.stake = Stake()
    for company in (d.acquirer, d.target):
        company.revenue_growth = flat(0.0)
        company.net_income_growth = flat(0.0)
        company.ebitda_margin = None
    d.acquirer.cash = None
    d.target.book_value = None
    d.fees = Fees()
    d.ppa = PPA()
    d.funding.cash_used = price * mix.pct_cash
    d.funding.tranches = [Tranche(name="Acquisition debt", amount=price * mix.pct_debt, rate=mix.debt_rate)]
    d.funding.new_equity_amount = 0.0
    d.funding.balancing_item = "none"
    d.funding.fcf_conversion_pct = 0.0
    d.synergies.revenue_probability = 1.0
    d.synergies.dis_synergies = 0.0
    return d


def money(amount):
    return f"{amount:,.0f}"


def collect_issues(deal, stake_result, funding_result, ppa_result, years, value):
    issues = []

    def add(level, code, message):
        issues.append({"level": level, "code": code, "message": message})

    if not funding_result["balanced"]:
        gap = funding_result["gap"]
        side = "more" if gap > 0 else "less"
        add("error", "sources_uses_gap",
            f"Sources and uses don't balance: sources are {money(abs(gap))} {side} than uses. "
            "Adjust the funding, or pick a balancing item.")

    available = funding_result["cash_available"]
    if available is not None and funding_result["cash_used"] > available + 1:
        add("error", "cash_below_minimum",
            f"The acquirer would use {money(funding_result['cash_used'])} of cash, but only "
            f"{money(available)} is available above its minimum cash balance.")

    if ppa_result and ppa_result["goodwill"] < 0:
        add("warning", "negative_goodwill",
            "Goodwill is negative (a bargain purchase). Check the book value and write-ups.")

    treatment = stake_result["treatment"]
    if deal.offer.debt_treatment == "refinanced" and treatment != "consolidate":
        add("warning", "refinance_ignored",
            "Target debt can only be refinanced when the target is consolidated, so it is treated as assumed.")
    if treatment == "consolidate" and stake_result["final_pct"] < 1:
        add("note", "partial_goodwill",
            "Partial goodwill convention: write-ups are recorded at 100% and fully amortized; "
            "goodwill is only recognised on the acquirer's stake. Minority holders take their share "
            "of the target's net income after amortization.")
    if treatment == "equity":
        add("note", "equity_method",
            "Equity method: only the acquirer's share of the target's net income is included. "
            "The target's revenue, EBITDA and debt are not consolidated, and there is no purchase "
            "price allocation (a simplification).")
    if treatment == "investment":
        add("note", "financial_investment",
            "Below 20%, the holding is a financial investment: its EPS effect is limited to "
            "dividends, which are not modelled. Synergies are not modelled.")
    existing = stake_result["existing_pct"]
    if already_controlled(existing):
        add("note", "existing_stake",
            "The target is already consolidated, so enter the acquirer's figures as reported: they "
            "already include 100% of the target's revenue, EBITDA and debt, and its share of the "
            "target's net income after minority interest. Buying more only reduces the minority "
            "interest. It is an equity transaction, so there is no new goodwill or write-ups.")
    elif existing >= 0.2:
        add("note", "existing_stake",
            "Enter the acquirer's figures as reported: its net income already includes its existing "
            "stake's share of the target's net income, so only the additional stake counts as new "
            "income. For goodwill, the existing stake is valued at the offer price.")
    elif existing > 0:
        add("note", "existing_stake",
            "The existing stake is below 20%, so it is treated as a financial investment with no "
            "income in the acquirer's figures. For goodwill, it is valued at the offer price.")

    if any(y["credit"]["leverage_breach"] for y in years):
        add("warning", "leverage_breach",
            f"Total debt / EBITDA is above {deal.thresholds.max_leverage:.1f}x in at least one year.")
    if any(y["credit"]["coverage_breach"] for y in years):
        add("warning", "coverage_breach",
            f"EBITDA / interest is below {deal.thresholds.min_coverage:.1f}x in at least one year.")
    if not value["valid"]:
        add("warning", "value_rates", value["message"])
    if deal.funding.fcf_conversion_pct > 0:
        add("note", "cash_sweep",
            "Cash sweep is a simplification: cash for early repayment = pro forma cash net income "
            "x the FCF conversion %.")
    return issues


def run_model(deal: DealInputV2) -> dict:
    check_adds_to_100(deal.synergies.integration_schedule, "Integration cost schedule")
    deal = apply_simple_mode(deal)

    offer_result = analyze_offer(deal)
    stake_result = analyze_stake(deal, offer_result)
    consideration = analyze_consideration(deal, offer_result, stake_result)
    funding_result = resolve_funding(deal, offer_result, stake_result, consideration)
    ownership = analyze_ownership(deal, consideration, funding_result)
    ppa_result = analyze_ppa(deal, stake_result)
    standalone = forecast_standalone(deal, stake_result["existing_pct"])

    years, debt_schedule, run_rate = run_years(
        deal, standalone, stake_result, funding_result, ppa_result, ownership)

    value = analyze_value(
        deal,
        [y["synergies"]["net_after_tax_attributable"] for y in years],
        run_rate,
        stake_result["premium_paid"],
    )

    issues = collect_issues(deal, stake_result, funding_result, ppa_result, years, value)

    return {
        "model_version": 2,
        "mode": deal.mode,
        "currency": deal.currency,
        "valid": not any(issue["level"] == "error" for issue in issues),
        "issues": issues,
        "eps_today": deal.acquirer.net_income / deal.acquirer.diluted_shares,
        "offer": offer_result,
        "stake": stake_result,
        "consideration": consideration,
        "sources_uses": funding_result,
        "ownership": ownership,
        "ppa": ppa_result,
        "standalone": standalone,
        "debt_schedule": debt_schedule,
        "years": years,
        "value": value,
        "one_time": {"advisory_fees": funding_result["advisory_fees"]},
        "num_years": YEARS,
    }
