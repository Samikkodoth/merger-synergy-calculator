# financing.py
# How the deal is paid for: stock given to target holders, the exchange ratio,
# sources & uses of funds, and pro forma ownership.

# Sources and uses may differ by rounding only (1 unit of currency).
BALANCE_TOLERANCE = 1.0


def analyze_consideration(deal, offer_result, stake_result):
    acquirer_price = deal.acquirer.share_price
    stock_value = stake_result["cost"] * deal.offer.pct_stock
    exchange_ratio = None
    if offer_result["per_share"]:
        exchange_ratio = deal.offer.offer_price * deal.offer.pct_stock / acquirer_price
    return {
        "stock_value": stock_value,
        "cash_value": stake_result["cost"] - stock_value,
        "stock_per_share": exchange_ratio * acquirer_price if exchange_ratio is not None else None,
        "exchange_ratio": exchange_ratio,
        "shares_issued": stock_value / acquirer_price,
    }


def refinances_target_debt(deal, treatment):
    return deal.offer.debt_treatment == "refinanced" and treatment == "consolidate"


def resolve_funding(deal, offer_result, stake_result, consideration):
    """Sources & uses, with the balancing item (if any) sized to close the gap."""
    funding = deal.funding
    treatment = stake_result["treatment"]
    refinanced = deal.target.debt if refinances_target_debt(deal, treatment) else 0.0
    advisory = deal.fees.advisory_pct * offer_result["enterprise_value"]

    cash_used = funding.cash_used
    amounts = [t.amount for t in funding.tranches]
    fees = [t.fee_pct for t in funding.tranches]

    # Uses that must be paid for in cash, before financing fees
    cash_needed = stake_result["cost"] + refinanced + advisory - consideration["stock_value"]

    plug = funding.balancing_item
    if plug.startswith("tranche_"):
        k = int(plug[-1]) - 1
        if k >= len(amounts):
            raise ValueError(f"The balancing item is Tranche {k + 1}, but that tranche doesn't exist")
        others = cash_used + funding.new_equity_amount + sum(a for i, a in enumerate(amounts) if i != k)
        other_fees = sum(a * f for i, (a, f) in enumerate(zip(amounts, fees)) if i != k)
        amounts[k] = max(0.0, (cash_needed + other_fees - others) / (1 - fees[k]))
    elif plug == "cash":
        financing_fees = sum(a * f for a, f in zip(amounts, fees))
        cash_used = max(0.0, cash_needed + financing_fees - sum(amounts) - funding.new_equity_amount)

    financing_fees = sum(a * f for a, f in zip(amounts, fees))

    uses = [
        {"key": "equity", "label": "Purchase of target equity", "amount": stake_result["cost"]},
        {"key": "refinance", "label": "Target debt refinanced", "amount": refinanced},
        {"key": "advisory", "label": "Advisory fees", "amount": advisory},
        {"key": "financing_fees", "label": "Financing fees", "amount": financing_fees},
    ]
    sources = [
        {"key": "stock", "label": "Acquirer stock issued to target holders", "amount": consideration["stock_value"]},
        {"key": "cash", "label": "Acquirer cash on hand", "amount": cash_used},
    ]
    for i, (tranche, amount) in enumerate(zip(funding.tranches, amounts)):
        sources.append({"key": f"tranche_{i + 1}", "label": tranche.name, "amount": amount})
    sources.append({"key": "new_equity", "label": "New equity raised", "amount": funding.new_equity_amount})

    total_uses = sum(item["amount"] for item in uses)
    total_sources = sum(item["amount"] for item in sources)
    gap = total_sources - total_uses

    new_equity_price = funding.new_equity_price or deal.acquirer.share_price
    cash_available = None
    if deal.acquirer.cash is not None:
        cash_available = max(0.0, deal.acquirer.cash - deal.acquirer.min_cash)

    return {
        "uses": uses,
        "sources": sources,
        "total_uses": total_uses,
        "total_sources": total_sources,
        "gap": gap,
        "balanced": abs(gap) <= BALANCE_TOLERANCE,
        "cash_used": cash_used,
        "cash_available": cash_available,
        "tranche_amounts": amounts,
        "refinanced_debt": refinanced,
        "advisory_fees": advisory,
        "financing_fees": financing_fees,
        "new_equity_shares": funding.new_equity_amount / new_equity_price,
        "new_equity_price": new_equity_price,
    }


def analyze_ownership(deal, consideration, funding_result):
    existing = deal.acquirer.diluted_shares
    to_target = consideration["shares_issued"]
    to_investors = funding_result["new_equity_shares"]
    total = existing + to_target + to_investors
    return {
        "existing_shares": existing,
        "shares_to_target_holders": to_target,
        "shares_to_new_investors": to_investors,
        "pro_forma_shares": total,
        "existing_pct": existing / total,
        "target_holders_pct": to_target / total,
        "new_investors_pct": to_investors / total,
    }
