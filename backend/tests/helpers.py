# helpers.py
# Builds test deals: a small base deal plus any overrides, merged section by section.
from model.engine import run_model
from model.inputs import DealInputV2

M = 1_000_000

# Acquirer: $100M net income, 50M shares at $40 (EPS $2.00).
# Target: $20M net income, 10M shares, unaffected price $20, offer $26.
BASE = {
    "mode": "advanced",
    "tax_rate": 0.25,
    "acquirer": {"net_income": 100 * M, "diluted_shares": 50 * M, "share_price": 40},
    "target": {"net_income": 20 * M, "diluted_shares": 10 * M, "unaffected_price": 20},
    "offer": {"price_input": "per_share", "offer_price": 26, "pct_stock": 1.0},
}


def merge(base, overrides):
    result = dict(base)
    for key, value in overrides.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = merge(result[key], value)
        else:
            result[key] = value
    return result


def deal(**overrides):
    return DealInputV2.model_validate(merge(BASE, overrides))


def run(**overrides):
    return run_model(deal(**overrides))


def codes(results):
    return [issue["code"] for issue in results["issues"]]
