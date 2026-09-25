# value.py
# Is the premium worth it? Compare the present value of the synergies with the
# premium paid over the unaffected share price.
#
# Cash flows arrive at the end of each year. The terminal value is a growing
# perpetuity on the Year 5 run-rate synergies (integration costs are one-time,
# so they are left out of the run-rate).


def analyze_value(deal, net_synergies_after_tax, run_rate_after_tax, premium_paid):
    r = deal.valuation.discount_rate
    g = deal.valuation.terminal_growth
    years = len(net_synergies_after_tax)

    if r <= g:
        return {"valid": False, "discount_rate": r, "terminal_growth": g,
                "message": "The discount rate must be higher than the terminal growth rate."}

    yearly = [
        {"year": i + 1, "synergies": amount, "discount_factor": 1 / (1 + r) ** (i + 1),
         "present_value": amount / (1 + r) ** (i + 1)}
        for i, amount in enumerate(net_synergies_after_tax)
    ]
    pv_years = sum(item["present_value"] for item in yearly)
    terminal_value = run_rate_after_tax * (1 + g) / (r - g)
    pv_terminal = terminal_value / (1 + r) ** years
    pv_total = pv_years + pv_terminal

    return {
        "valid": True,
        "discount_rate": r,
        "terminal_growth": g,
        "years": yearly,
        "pv_forecast_years": pv_years,
        "run_rate": run_rate_after_tax,
        "terminal_value": terminal_value,
        "pv_terminal_value": pv_terminal,
        "pv_synergies": pv_total,
        "premium_paid": premium_paid,
        "value_created": pv_total - premium_paid if premium_paid is not None else None,
    }
