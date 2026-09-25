# sensitivity.py
# A 5x5 grid of scenarios along two chosen axes. The server runs every
# scenario, so the browser makes one request per grid.
#
# When a scenario changes how much cash is needed (a higher price, less stock),
# each funding source keeps its share of the funding. This matches how the
# original grid behaved (the payment mix stayed fixed as the price changed).

from model.engine import run_model
from model.financing import analyze_consideration, refinances_target_debt
from model.offer import analyze_offer, analyze_stake

STEPS = [-0.20, -0.10, 0.0, 0.10, 0.20]
RATE_STEPS = [-0.02, -0.01, 0.0, 0.01, 0.02]

AXES = {
    "price": "Purchase price change",
    "premium": "Premium",
    "synergies": "Synergies change",
    "pct_stock": "Stock consideration",
    "debt_rate": "Debt interest rate",
    "pct_debt": "Debt financing",
    "acceptance": "Open offer acceptance",
}


def axis_values(key, deal):
    """The five values along an axis, and the index of today's deal (or None)."""
    if key == "price":
        return STEPS, 2
    if key == "synergies":
        return [0.50, 0.25, 0.0, -0.25, -0.50], 2
    if key == "premium":
        if deal.offer.price_input != "per_share" or deal.target.unaffected_price <= 0:
            raise ValueError("The premium axis needs an offer price per share and an unaffected share price")
        base = deal.offer.offer_price / deal.target.unaffected_price - 1
        return [base + step for step in STEPS], 2
    if key == "debt_rate":
        base = debt_rate(deal)
        if base is None:
            raise ValueError("The debt interest rate axis needs a debt tranche")
        return [max(base + step, 0.0) for step in RATE_STEPS], 2
    if key == "acceptance":
        if deal.offer.price_input != "per_share" or deal.stake.open_offer_pct <= 0:
            raise ValueError("The acceptance axis needs an open offer")
        current = deal.stake.acceptance_pct
    elif key == "pct_stock":
        current = deal.offer.pct_stock
    elif key == "pct_debt":
        current = None
    else:
        raise ValueError(f"Unknown sensitivity axis: {key}")
    values = [0.0, 0.25, 0.5, 0.75, 1.0]
    base_index = next((i for i, v in enumerate(values) if current is not None and abs(v - current) < 1e-9), None)
    return values, base_index


def debt_rate(deal):
    if deal.mode == "simple":
        return deal.funding.mix.debt_rate
    return deal.funding.tranches[0].rate if deal.funding.tranches else None


def cash_needed_before_fees(deal):
    offer = analyze_offer(deal)
    stake = analyze_stake(deal, offer)
    consideration = analyze_consideration(deal, offer, stake)
    refinanced = deal.target.debt if refinances_target_debt(deal, stake["treatment"]) else 0.0
    return stake["cost"] + refinanced + deal.fees.advisory_pct * offer["enterprise_value"] - consideration["stock_value"]


def funding_weights(deal, resolved):
    """Each cash source's share of the base deal's cash funding."""
    amounts = [resolved["cash_used"], *resolved["tranche_amounts"], deal.funding.new_equity_amount]
    total = sum(amounts)
    if total <= 0:
        # An all-stock base deal: fund any new cash need with the first tranche, else cash.
        amounts = [0.0] * len(amounts)
        amounts[1 if deal.funding.tranches else 0] = 1.0
        total = 1.0
    return [a / total for a in amounts]


def set_debt_share(weights, share):
    """Split the cash-and-debt part of the weights: `share` to debt, the rest to cash."""
    cash, tranches, equity = weights[0], weights[1:-1], weights[-1]
    pool = cash + sum(tranches)
    debt_total = sum(tranches)
    if pool <= 0:
        pool = 1.0 - equity
    tranche_split = [t / debt_total for t in tranches] if debt_total > 0 else [1.0] + [0.0] * (len(tranches) - 1)
    return [pool * (1 - share), *[pool * share * s for s in tranche_split], equity]


def rebalance(deal, weights):
    """Resize the cash sources, keeping their shares, so sources equal uses."""
    fees = [t.fee_pct for t in deal.funding.tranches]
    need = cash_needed_before_fees(deal)
    fee_share = sum(w * f for w, f in zip(weights[1:-1], fees))
    total = max(need, 0.0) / (1 - fee_share)
    deal.funding.cash_used = weights[0] * total
    for tranche, w in zip(deal.funding.tranches, weights[1:-1]):
        tranche.amount = w * total
    deal.funding.new_equity_amount = weights[-1] * total
    deal.funding.balancing_item = "none"


def apply_axis(deal, key, value, base):
    """Change one input on `deal` (a copy); `base` is today's deal."""
    if key == "price":
        deal.offer.purchase_price = base.offer.purchase_price * (1 + value)
        deal.offer.offer_price = base.offer.offer_price * (1 + value)
        deal.stake.open_offer_price = base.stake.open_offer_price * (1 + value)
    elif key == "premium":
        new_price = base.target.unaffected_price * (1 + value)
        scale = new_price / base.offer.offer_price
        deal.offer.offer_price = new_price
        deal.stake.open_offer_price = base.stake.open_offer_price * scale
    elif key == "synergies":
        deal.synergies.cost = base.synergies.cost * (1 + value)
        deal.synergies.revenue = base.synergies.revenue * (1 + value)
    elif key == "pct_stock":
        deal.offer.pct_stock = value
        if deal.mode == "simple":
            mix = base.funding.mix
            rest = mix.pct_cash + mix.pct_debt
            debt_share = mix.pct_debt / rest if rest > 0 else 1.0
            deal.funding.mix.pct_debt = (1 - value) * debt_share
            deal.funding.mix.pct_cash = (1 - value) * (1 - debt_share)
    elif key == "debt_rate":
        shift = value - debt_rate(base)
        deal.funding.mix.debt_rate = max(base.funding.mix.debt_rate + shift, 0.0)
        for tranche, base_tranche in zip(deal.funding.tranches, base.funding.tranches):
            tranche.rate = max(base_tranche.rate + shift, 0.0)
    elif key == "pct_debt":
        if deal.mode == "simple":
            rest = 1 - deal.offer.pct_stock
            deal.funding.mix.pct_debt = rest * value
            deal.funding.mix.pct_cash = rest * (1 - value)
        elif not deal.funding.tranches:
            raise ValueError("The debt financing axis needs a debt tranche")
    elif key == "acceptance":
        deal.stake.acceptance_pct = value


def run_sensitivity(deal, x_axis="price", y_axis="synergies"):
    if x_axis == y_axis:
        raise ValueError("Pick two different axes")
    base_results = run_model(deal)
    x_values, x_base = axis_values(x_axis, deal)
    y_values, y_base = axis_values(y_axis, deal)

    weights = None
    if deal.mode != "simple":
        weights = funding_weights(deal, base_results["sources_uses"])

    cells = []
    for y_value in y_values:
        row = []
        for x_value in x_values:
            scenario = deal.model_copy(deep=True)
            apply_axis(scenario, x_axis, x_value, deal)
            apply_axis(scenario, y_axis, y_value, deal)
            if weights is not None:
                scenario_weights = weights
                for key, value in ((x_axis, x_value), (y_axis, y_value)):
                    if key == "pct_debt":
                        scenario_weights = set_debt_share(weights, value)
                rebalance(scenario, scenario_weights)
            results = run_model(scenario)
            row.append({
                "gaap": [y["gaap_accretion"] for y in results["years"]],
                "cash": [y["cash_accretion"] for y in results["years"]],
            })
        cells.append(row)

    return {
        "x_axis": {"key": x_axis, "label": AXES[x_axis], "values": x_values, "base_index": x_base},
        "y_axis": {"key": y_axis, "label": AXES[y_axis], "values": y_values, "base_index": y_base},
        "cells": cells,
        "base_valid": base_results["valid"],
    }
