# ppa.py
# Purchase price allocation: write the target's assets up to fair value,
# book a deferred tax liability on the write-ups, and call the rest goodwill.
#
# Partial deals use the "partial goodwill" convention: write-ups are recorded
# at 100% (and fully amortized in the consolidated accounts), but goodwill is
# only recognised on the acquirer's share. A stake owned before the deal is
# counted at the offer price.

from model.inputs import YEARS


def straight_line(amount, life, year):
    """The part of `amount` expensed in `year` (1-based) over `life` years."""
    share_of_year = min(max(life - (year - 1), 0.0), 1.0)
    return amount / life * share_of_year


def analyze_ppa(deal, stake_result):
    target, ppa, tax = deal.target, deal.ppa, deal.tax_rate
    if stake_result["treatment"] != "consolidate" or target.book_value is None:
        return None

    stake = stake_result["final_pct"]
    consideration = stake_result["cost"]
    if deal.offer.price_input == "per_share":
        consideration += stake_result["existing_pct"] * target.diluted_shares * deal.offer.offer_price

    book = target.book_value
    # The excess over book value, scaled up to 100% of the company
    excess = consideration / stake - book
    if ppa.intangibles_input == "pct_of_excess":
        intangibles = ppa.intangibles * max(excess, 0.0)
    else:
        intangibles = ppa.intangibles

    write_ups = intangibles + ppa.ppe_writeup
    dtl = write_ups * tax
    fair_value_net_assets = book + write_ups - dtl
    goodwill = consideration - stake * fair_value_net_assets

    amortization = [
        straight_line(intangibles, ppa.intangibles_life, year)
        + straight_line(ppa.ppe_writeup, ppa.ppe_life, year)
        for year in range(1, YEARS + 1)
    ]

    return {
        "consideration": consideration,
        "stake_pct": stake,
        "book_value": book,
        "excess_purchase_price": excess,
        "intangibles_write_up": intangibles,
        "ppe_write_up": ppa.ppe_writeup,
        "deferred_tax_liability": dtl,
        "fair_value_net_assets": fair_value_net_assets,
        "goodwill": goodwill,
        "amortization": amortization,
    }
