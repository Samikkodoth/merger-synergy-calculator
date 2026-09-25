# forecast.py
# Standalone forecasts for Years 1-5: what each company would earn without the deal.

from model.inputs import YEARS


def grow(base, growth_rates):
    values, current = [], base
    for rate in growth_rates:
        current *= 1 + rate
        values.append(current)
    return values


def forecast_company(company):
    revenue = grow(company.revenue, company.revenue_growth)
    net_income = grow(company.net_income, company.net_income_growth)

    if company.revenue > 0:
        margins = company.ebitda_margin or [company.ebitda / company.revenue] * YEARS
        ebitda = [r * m for r, m in zip(revenue, margins)]
    else:
        ebitda = [company.ebitda] * YEARS

    return {"revenue": revenue, "ebitda": ebitda, "net_income": net_income}


def existing_stake_share(existing_pct):
    """The share of target net income already in the acquirer's reported net income.

    A stake of 20% or more is equity-accounted, or consolidated if it is already
    controlling (with minority interest deducted); either way the income
    attributable to the acquirer is stake % x target net income. Below 20% it is
    a financial investment whose dividends aren't modelled.
    """
    return existing_pct if existing_pct >= 0.2 else 0.0


def already_controlled(existing_pct):
    """Above 50%, the acquirer's reported revenue, EBITDA and debt already include
    100% of the target."""
    return existing_pct > 0.5


def forecast_standalone(deal, existing_pct=0.0):
    """Acquirer figures are entered AS REPORTED, so they already include any stake
    held in the target before the deal. `existing_stake_income` records how much
    of the acquirer's net income comes from that stake, so the pro forma model
    only credits the additional stake."""
    target = forecast_company(deal.target)
    share = existing_stake_share(existing_pct)
    acquirer = forecast_company(deal.acquirer)
    acquirer["existing_stake_income"] = [share * ni for ni in target["net_income"]]
    acquirer["eps"] = [ni / deal.acquirer.diluted_shares for ni in acquirer["net_income"]]
    return {"acquirer": acquirer, "target": target}
