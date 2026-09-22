# calculator.py
# Version 3: multi-year view with cost synergies, revenue synergies,
# integration costs, and any mix of stock / cash / debt.


def check_adds_to_100(values, name):
    total = sum(values)
    if abs(total - 1.0) > 0.0001:
        raise ValueError(f"{name} must add up to 100%, but it adds up to {total:.0%}")


def calculate_deal(
    acquirer_net_income,
    acquirer_shares,
    acquirer_share_price,
    target_net_income,
    purchase_price,
    tax_rate,
    pct_stock,
    pct_cash,
    pct_debt,
    interest_rate_on_cash,
    interest_rate_on_debt,
    cost_synergies,
    cost_synergy_phase_in,
    revenue_synergies,
    revenue_synergy_margin,
    revenue_synergy_phase_in,
    integration_costs,
    integration_cost_schedule,
):
    # --- Safety checks ---
    check_adds_to_100([pct_stock, pct_cash, pct_debt], "Payment mix")
    check_adds_to_100(integration_cost_schedule, "Integration cost schedule")

    num_years = len(cost_synergy_phase_in)
    if len(revenue_synergy_phase_in) != num_years or len(integration_cost_schedule) != num_years:
        raise ValueError("All yearly schedules must cover the same number of years")

    # --- Things that stay the same every year ---
    eps_before = acquirer_net_income / acquirer_shares

    new_shares_issued = purchase_price * pct_stock / acquirer_share_price
    total_shares_after = acquirer_shares + new_shares_issued

    lost_interest_income = purchase_price * pct_cash * interest_rate_on_cash * (1 - tax_rate)
    new_interest_expense = purchase_price * pct_debt * interest_rate_on_debt * (1 - tax_rate)

    # --- Things that change each year ---
    yearly_results = []

    for i in range(num_years):
        cost_syn = cost_synergies * cost_synergy_phase_in[i]
        rev_syn_profit = revenue_synergies * revenue_synergy_margin * revenue_synergy_phase_in[i]
        integration = integration_costs * integration_cost_schedule[i]

        net_synergies_pre_tax = cost_syn + rev_syn_profit - integration
        net_synergies_after_tax = net_synergies_pre_tax * (1 - tax_rate)

        combined_net_income = (
            acquirer_net_income
            + target_net_income
            + net_synergies_after_tax
            - lost_interest_income
            - new_interest_expense
        )
        eps_after = combined_net_income / total_shares_after
        accretion_pct = (eps_after - eps_before) / eps_before * 100

        yearly_results.append({
            "year": i + 1,
            "cost_synergies": cost_syn,
            "revenue_synergy_profit": rev_syn_profit,
            "integration_costs": integration,
            "eps_after": eps_after,
            "accretion_pct": accretion_pct,
        })

    return {
        "eps_before": eps_before,
        "new_shares_issued": new_shares_issued,
        "new_interest_expense": new_interest_expense,
        "lost_interest_income": lost_interest_income,
        "years": yearly_results,
    }


def millions(amount):
    return f"${amount / 1_000_000:,.2f}M"


def print_results(results):
    print(f"\nEPS before deal: ${results['eps_before']:.2f}")
    print(f"New shares issued: {results['new_shares_issued']:,.0f}")
    print(f"Interest on new debt (after tax): {millions(results['new_interest_expense'])}")
    print(f"Lost interest on cash (after tax): {millions(results['lost_interest_income'])}")
    print()

    print(f"{'Year':<6}{'Cost Syn':>12}{'Rev Syn':>12}{'Integration':>14}{'EPS':>9}{'Accretion':>12}")

    for year in results["years"]:
        eps_text = f"${year['eps_after']:.2f}"
        accretion_text = f"{year['accretion_pct']:+.1f}%"
        print(
            f"{year['year']:<6}"
            f"{millions(year['cost_synergies']):>12}"
            f"{millions(year['revenue_synergy_profit']):>12}"
            f"{millions(year['integration_costs']):>14}"
            f"{eps_text:>9}"
            f"{accretion_text:>12}"
        )

    # --- Find the first year the deal becomes accretive ---
    first_accretive_year = None
    for year in results["years"]:
        if year["accretion_pct"] >= 0:
            first_accretive_year = year["year"]
            break

    print()
    if first_accretive_year is None:
        print("The deal is dilutive in every year shown.")
    elif first_accretive_year == 1:
        print("The deal is accretive from Year 1.")
    else:
        print(f"The deal is dilutive at first and becomes accretive in Year {first_accretive_year}.")


if __name__ == "__main__":
    deal = {
        # The acquirer
        "acquirer_net_income": 100_000_000,
        "acquirer_shares": 50_000_000,
        "acquirer_share_price": 40,
        # The target and the price
        "target_net_income": 20_000_000,
        "purchase_price": 300_000_000,
        "tax_rate": 0.25,
        # How the deal is paid for
        "pct_stock": 0.5,
        "pct_cash": 0.0,
        "pct_debt": 0.5,
        "interest_rate_on_cash": 0.04,
        "interest_rate_on_debt": 0.07,
        # Cost synergies: full yearly amount + how much arrives each year
        "cost_synergies": 15_000_000,
        "cost_synergy_phase_in": [0.50, 0.75, 1.00],
        # Revenue synergies: extra sales + profit margin + phase-in
        "revenue_synergies": 40_000_000,
        "revenue_synergy_margin": 0.20,
        "revenue_synergy_phase_in": [0.00, 0.50, 1.00],
        # Integration costs: one-time total + how it is spread across years
        "integration_costs": 30_000_000,
        "integration_cost_schedule": [0.60, 0.30, 0.10],
    }

    results = calculate_deal(**deal)
    print_results(results)