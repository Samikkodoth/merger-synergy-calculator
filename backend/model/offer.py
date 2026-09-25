# offer.py
# What is being bought and for how much: premium, enterprise value, implied
# multiples, and (for partial deals) the stake bought in each leg.


def ratio(top, bottom):
    """top / bottom, or None when the bottom is zero or negative."""
    return top / bottom if bottom > 0 else None


def treatment_for_stake(final_pct, override="auto"):
    if override != "auto":
        return override
    if final_pct > 0.5:
        return "consolidate"
    if final_pct >= 0.2:
        return "equity"
    return "investment"


def analyze_offer(deal):
    """Price per share, premium, equity value and EV for 100% of the target."""
    target, offer = deal.target, deal.offer
    per_share = offer.price_input == "per_share"

    if per_share:
        if target.diluted_shares <= 0 or offer.offer_price <= 0:
            raise ValueError("Enter the offer price and the target's diluted shares")
        equity_value = offer.offer_price * target.diluted_shares
    else:
        equity_value = offer.purchase_price

    net_debt = target.debt - target.cash
    enterprise_value = equity_value + net_debt + target.preferred_stock + target.minority_interest

    premium_pct = None
    if per_share and target.unaffected_price > 0:
        premium_pct = offer.offer_price / target.unaffected_price - 1

    if per_share:
        target_eps = ratio(target.net_income, target.diluted_shares)
        pe = offer.offer_price / target_eps if target_eps and target_eps > 0 else None
    else:
        pe = ratio(equity_value, target.net_income)

    return {
        "per_share": per_share,
        "offer_price": offer.offer_price if per_share else None,
        "unaffected_price": target.unaffected_price if per_share else None,
        "premium_pct": premium_pct,
        "equity_value": equity_value,
        "net_debt": net_debt,
        "enterprise_value": enterprise_value,
        "ev_revenue": ratio(enterprise_value, target.revenue),
        "ev_ebitda": ratio(enterprise_value, target.ebitda),
        "pe": pe,
    }


def analyze_stake(deal, offer_result):
    """The legs of the purchase, the final stake, and the accounting treatment.

    Only the cost of the shares actually bought is paid for (sources & uses).
    """
    stake, target = deal.stake, deal.target

    if not offer_result["per_share"]:
        # Simple mode: the whole company is bought for the typed price.
        legs = [{"name": "Purchase of 100% of the target", "pct": 1.0, "shares": None,
                 "price": None, "cost": offer_result["equity_value"]}]
        final_pct = 1.0
        existing_pct = 0.0
    else:
        shares = target.diluted_shares
        offer_price = deal.offer.offer_price
        open_offer_price = stake.open_offer_price or offer_price
        accepted_pct = stake.open_offer_pct * stake.acceptance_pct
        legs = []
        if stake.bought_pct > 0:
            legs.append({"name": "Negotiated purchase", "pct": stake.bought_pct,
                         "shares": stake.bought_pct * shares, "price": offer_price,
                         "cost": stake.bought_pct * shares * offer_price})
        if accepted_pct > 0:
            legs.append({"name": "Open offer", "pct": accepted_pct,
                         "shares": accepted_pct * shares, "price": open_offer_price,
                         "cost": accepted_pct * shares * open_offer_price})
        existing_pct = stake.existing_pct
        final_pct = existing_pct + stake.bought_pct + accepted_pct

    if final_pct > 1.0 + 1e-9:
        raise ValueError(f"The final stake adds up to {final_pct:.1%}, which is more than 100%")

    shares_acquired = sum(leg["shares"] or 0 for leg in legs)
    cost = sum(leg["cost"] for leg in legs)

    premium_paid = None
    if offer_result["per_share"] and target.unaffected_price > 0:
        premium_paid = sum((leg["price"] - target.unaffected_price) * leg["shares"] for leg in legs)

    return {
        "existing_pct": existing_pct,
        "final_pct": final_pct,
        "treatment": treatment_for_stake(final_pct, stake.treatment),
        "legs": legs,
        "shares_acquired": shares_acquired,
        "cost": cost,
        "premium_paid": premium_paid,
    }
