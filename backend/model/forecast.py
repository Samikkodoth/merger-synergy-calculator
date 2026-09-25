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
    """The share of target net income the acquirer already earns before the deal.

    A stake of 20% or more is equity-accounted, or consolidated if it is already
    controlling; either way the income attributable to the acquirer is
    stake % x target net income. Below 20% it is a financial investment whose
    dividends aren't modelled.
    """
    return existing_pct if existing_pct >= 0.2 else 0.0


def forecast_standalone(deal, existing_pct=0.0):
    """`existing_pct` is the stake in the target owned before the deal. Its share
    of target net income is part of the acquirer's standalone net income (the
    typed acquirer net income is taken to exclude it)."""
    target = forecast_company(deal.target)
    share = existing_stake_share(existing_pct)
    acquirer = forecast_company(deal.acquirer)
    acquirer["own_net_income"] = acquirer["net_income"]
    acquirer["existing_stake_income"] = [share * ni for ni in target["net_income"]]
    acquirer["net_income"] = [own + stake for own, stake in zip(acquirer["own_net_income"], acquirer["existing_stake_income"])]
    acquirer["eps"] = [ni / deal.acquirer.diluted_shares for ni in acquirer["net_income"]]
    return {"acquirer": acquirer, "target": target}
