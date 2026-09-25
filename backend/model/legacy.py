# legacy.py
# Deals saved before the upgrade use the original flat input format with
# 3-year schedules. This turns them into a model-version-2 deal in simple mode.

from model.inputs import YEARS, DealInputV2


def is_legacy(data):
    return isinstance(data, dict) and "acquirer_net_income" in data


def extend(values, fill):
    """Pad a schedule to 5 years. `fill` is 'last' (keep the last value) or a number."""
    values = list(values)[:YEARS]
    pad = values[-1] if fill == "last" else fill
    return values + [pad] * (YEARS - len(values))


def legacy_to_v2(old):
    return DealInputV2(
        mode="simple",
        currency="USD",
        tax_rate=old["tax_rate"],
        acquirer={
            "net_income": old["acquirer_net_income"],
            "diluted_shares": old["acquirer_shares"],
            "share_price": old["acquirer_share_price"],
            "interest_rate_on_cash": old["interest_rate_on_cash"],
        },
        target={"net_income": old["target_net_income"]},
        offer={
            "price_input": "total",
            "purchase_price": old["purchase_price"],
            "pct_stock": old["pct_stock"],
        },
        funding={
            "mix": {
                "pct_cash": old["pct_cash"],
                "pct_debt": old["pct_debt"],
                "debt_rate": old["interest_rate_on_debt"],
            },
        },
        synergies={
            "cost": old["cost_synergies"],
            "cost_phase_in": extend(old["cost_synergy_phase_in"], "last"),
            "revenue": old["revenue_synergies"],
            "revenue_margin": old["revenue_synergy_margin"],
            "revenue_phase_in": extend(old["revenue_synergy_phase_in"], "last"),
            "integration_costs": old["integration_costs"],
            "integration_schedule": extend(old["integration_cost_schedule"], 0.0),
        },
    )


def parse_deal(data):
    """Accept either format and return a DealInputV2."""
    if is_legacy(data):
        return legacy_to_v2(data)
    return DealInputV2.model_validate(data)
