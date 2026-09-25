# proforma.py
# The combined company, year by year: GAAP and cash EPS, accretion/dilution
# against the acquirer's standalone forecast, breakeven synergies, and credit
# metrics. The debt schedule is rolled forward inside the same loop because
# any cash sweep depends on each year's earnings.

from model.debt import DebtSchedule
from model.inputs import YEARS


def change(new, old):
    """Accretion (+) or dilution (-) as a fraction of the standalone figure."""
    return (new - old) / abs(old) if old != 0 else None


def safe_ratio(top, bottom):
    return top / bottom if bottom > 0 else None


def synergy_shares(treatment, stake, inside_target):
    """How much of each unit of synergy lands in (a) consolidated net income and
    (b) income attributable to the acquirer, and (c) in consolidated EBITDA."""
    if treatment == "consolidate":
        # 100% is consolidated; minority holders then take their share of the
        # synergies realised inside the target.
        return 1.0, 1.0 - (1.0 - stake) * inside_target, 1.0
    if treatment == "equity":
        # Synergies inside the acquirer count in full; those inside the target
        # only through the acquirer's share of its earnings.
        share = (1.0 - inside_target) + stake * inside_target
        return share, share, 1.0 - inside_target
    return 0.0, 0.0, 0.0


def run_years(deal, standalone, stake_result, funding_result, ppa_result, ownership):
    t = deal.tax_rate
    syn = deal.synergies
    acquirer, target = deal.acquirer, deal.target
    treatment = stake_result["treatment"]
    stake = stake_result["final_pct"]
    consolidated = treatment == "consolidate"
    refinanced = consolidated and deal.offer.debt_treatment == "refinanced"
    in_net_income, attributable, in_ebitda = synergy_shares(
        treatment, stake, deal.stake.synergies_inside_target_pct)
    inside = deal.stake.synergies_inside_target_pct

    schedule = DebtSchedule(deal.funding.tranches, funding_result["tranche_amounts"])
    shares = ownership["pro_forma_shares"]
    lost_interest = funding_result["cash_used"] * acquirer.interest_rate_on_cash * (1 - t)

    years = []
    for i in range(YEARS):
        year = i + 1
        acquirer_ni = standalone["acquirer"]["net_income"][i]
        target_ni_full = standalone["target"]["net_income"][i]
        standalone_eps = standalone["acquirer"]["eps"][i]

        # --- Synergies (pre-tax, 100%) ---
        cost = syn.cost * syn.cost_phase_in[i]
        revenue_profit = syn.revenue * syn.revenue_margin * syn.revenue_phase_in[i] * syn.revenue_probability
        dis = syn.dis_synergies * syn.dis_synergy_phase_in[i]
        integration = syn.integration_costs * syn.integration_schedule[i]
        synergy_ebitda = cost + revenue_profit - dis

        # --- The target's contribution ---
        if consolidated:
            target_ni = target_ni_full
            refinancing = target.interest_expense * (1 - t) if refinanced else 0.0
            amortization = (ppa_result["amortization"][i] if ppa_result else 0.0) * (1 - t)
            minority_interest = (1 - stake) * (
                target_ni_full + inside * (synergy_ebitda - integration) * (1 - t) - amortization)
        elif treatment == "equity":
            target_ni, refinancing, amortization, minority_interest = stake * target_ni_full, 0.0, 0.0, 0.0
        else:
            target_ni, refinancing, amortization, minority_interest = 0.0, 0.0, 0.0, 0.0

        # --- Financing ---
        interest = schedule.interest()
        fee_amortization = schedule.fee_amortization(year)

        components = {
            "acquirer_net_income": acquirer_ni,
            "target_net_income": target_ni,
            "refinancing_savings": refinancing,
            "cost_synergies": cost * (1 - t) * in_net_income,
            "revenue_synergies": revenue_profit * (1 - t) * in_net_income,
            "dis_synergies": -dis * (1 - t) * in_net_income,
            "integration_costs": -integration * (1 - t) * in_net_income,
            "amortization": -amortization,
            "new_interest": -interest * (1 - t),
            "financing_fees": -fee_amortization * (1 - t),
            "lost_interest_on_cash": -lost_interest,
            "minority_interest": -minority_interest,
        }
        gaap_ni = sum(components.values())
        gaap_eps = gaap_ni / shares

        # Cash EPS adds back the acquirer's share of the non-cash amortization
        # and the one-time integration costs.
        amortization_share = stake if consolidated else 0.0
        cash_ni = gaap_ni + amortization * amortization_share + integration * (1 - t) * attributable
        cash_eps = cash_ni / shares

        # Pre-tax synergies (cost + revenue profit - dis-synergies) at which
        # GAAP EPS equals standalone EPS, holding everything else fixed.
        breakeven = None
        if attributable > 0:
            ni_without_synergies = gaap_ni - synergy_ebitda * (1 - t) * attributable
            breakeven = (standalone_eps * shares - ni_without_synergies) / ((1 - t) * attributable)

        # --- Debt: repay, then read closing balances ---
        schedule.close_year(year, max(cash_ni, 0.0) * deal.funding.fcf_conversion_pct)

        # --- Credit metrics (end of year) ---
        ebitda = (standalone["acquirer"]["ebitda"][i]
                  + (standalone["target"]["ebitda"][i] if consolidated else 0.0)
                  + synergy_ebitda * in_ebitda)
        total_debt = acquirer.debt + (target.debt if consolidated and not refinanced else 0.0) + schedule.total_balance()
        cash = (target.cash if consolidated else 0.0)
        if acquirer.cash is not None:
            cash += max(acquirer.cash - funding_result["cash_used"], 0.0)
        interest_expense = (acquirer.interest_expense
                            + (target.interest_expense if consolidated and not refinanced else 0.0)
                            + interest + fee_amortization)
        # Ratios need real EBITDA figures, which simple mode doesn't ask for.
        has_ebitda = acquirer.ebitda > 0 or (consolidated and target.ebitda > 0)
        leverage = safe_ratio(total_debt, ebitda) if has_ebitda else None
        net_leverage = safe_ratio(total_debt - cash, ebitda) if has_ebitda else None
        coverage = safe_ratio(ebitda, interest_expense) if has_ebitda and ebitda > 0 else None

        years.append({
            "year": year,
            "standalone_eps": standalone_eps,
            "pro_forma_shares": shares,
            "gaap_net_income": gaap_ni,
            "gaap_eps": gaap_eps,
            "gaap_accretion": change(gaap_eps, standalone_eps),
            "cash_net_income": cash_ni,
            "cash_eps": cash_eps,
            "cash_accretion": change(cash_eps, standalone_eps),
            "components": components,
            "synergies": {
                "cost": cost,
                "revenue_profit": revenue_profit,
                "dis_synergies": dis,
                "integration_costs": integration,
                "net_pre_tax": synergy_ebitda - integration,
                "net_after_tax_attributable": (synergy_ebitda - integration) * (1 - t) * attributable,
            },
            "breakeven_synergies": breakeven,
            "credit": {
                "ebitda": ebitda,
                "total_debt": total_debt,
                "cash": cash,
                "net_debt": total_debt - cash,
                "interest_expense": interest_expense,
                "total_leverage": leverage,
                "net_leverage": net_leverage,
                "interest_coverage": coverage,
                "available": has_ebitda,
                "leverage_breach": leverage is not None and leverage > deal.thresholds.max_leverage,
                "coverage_breach": coverage is not None and coverage < deal.thresholds.min_coverage,
            },
        })

    run_rate = years[-1]["synergies"]
    run_rate_after_tax = (run_rate["cost"] + run_rate["revenue_profit"] - run_rate["dis_synergies"]) * (1 - t) * attributable

    return years, schedule.as_list(), run_rate_after_tax
