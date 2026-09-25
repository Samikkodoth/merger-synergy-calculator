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


def forecast_standalone(deal):
    acquirer = forecast_company(deal.acquirer)
    acquirer["eps"] = [ni / deal.acquirer.diluted_shares for ni in acquirer["net_income"]]
    return {"acquirer": acquirer, "target": forecast_company(deal.target)}
