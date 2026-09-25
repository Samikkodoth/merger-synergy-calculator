# inputs.py
# The shape of a deal (model version 2). Every amount is a raw number in one
# currency (e.g. 300_000_000, not "300M"); every percentage is a fraction (0.25).
# Every advanced feature defaults to "off", so a deal that only fills in the
# basics behaves exactly like the original calculator.

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator

YEARS = 5


def five_years(values, name):
    if len(values) != YEARS:
        raise ValueError(f"{name} must have one value for each of the {YEARS} years")
    return values


def flat(value):
    return [value] * YEARS


class Acquirer(BaseModel):
    share_price: float = Field(gt=0)
    diluted_shares: float = Field(gt=0)
    net_income: float
    revenue: float = Field(0, ge=0)
    ebitda: float = 0
    revenue_growth: list[float] = flat(0.0)
    net_income_growth: list[float] = flat(0.0)
    # None = keep the base-year EBITDA margin in every year
    ebitda_margin: Optional[list[float]] = None
    debt: float = Field(0, ge=0)
    # None = not entered, so the minimum-cash check is skipped
    cash: Optional[float] = Field(None, ge=0)
    min_cash: float = Field(0, ge=0)
    interest_expense: float = Field(0, ge=0)
    interest_rate_on_cash: float = Field(0, ge=0, le=1)

    @field_validator("revenue_growth", "net_income_growth", "ebitda_margin")
    @classmethod
    def check_years(cls, values, info):
        return values if values is None else five_years(values, info.field_name)


class Target(BaseModel):
    net_income: float
    diluted_shares: float = Field(0, ge=0)
    unaffected_price: float = Field(0, ge=0)
    revenue: float = Field(0, ge=0)
    ebitda: float = 0
    revenue_growth: list[float] = flat(0.0)
    net_income_growth: list[float] = flat(0.0)
    ebitda_margin: Optional[list[float]] = None
    debt: float = Field(0, ge=0)
    cash: float = Field(0, ge=0)
    preferred_stock: float = Field(0, ge=0)
    minority_interest: float = Field(0, ge=0)
    interest_expense: float = Field(0, ge=0)
    # None = not entered, so no purchase price allocation is done
    book_value: Optional[float] = None

    @field_validator("revenue_growth", "net_income_growth", "ebitda_margin")
    @classmethod
    def check_years(cls, values, info):
        return values if values is None else five_years(values, info.field_name)


class Offer(BaseModel):
    # "total": the user types the equity purchase price (simple mode).
    # "per_share": the price comes from offer price x target diluted shares.
    price_input: Literal["total", "per_share"] = "total"
    purchase_price: float = Field(0, ge=0)
    offer_price: float = Field(0, ge=0)
    # Share of the price paid to target holders in acquirer stock
    pct_stock: float = Field(0, ge=0, le=1)
    debt_treatment: Literal["assumed", "refinanced"] = "assumed"


class Stake(BaseModel):
    existing_pct: float = Field(0, ge=0, le=1)
    bought_pct: float = Field(1, ge=0, le=1)
    open_offer_pct: float = Field(0, ge=0, le=1)
    # 0 = same as the offer price
    open_offer_price: float = Field(0, ge=0)
    acceptance_pct: float = Field(1, ge=0, le=1)
    treatment: Literal["auto", "consolidate", "equity", "investment"] = "auto"
    synergies_inside_target_pct: float = Field(0, ge=0, le=1)


class Tranche(BaseModel):
    name: str = Field("Term loan", max_length=60)
    amount: float = Field(0, ge=0)
    rate: float = Field(0, ge=0, le=1)
    term_years: int = Field(5, ge=1, le=30)
    amortization_pct: float = Field(0, ge=0, le=1)
    fee_pct: float = Field(0, ge=0, le=0.5)


class Mix(BaseModel):
    # Simple mode: how the purchase price is paid, as in the original app.
    # The stock share is Offer.pct_stock; these two cover the rest.
    pct_cash: float = Field(0, ge=0, le=1)
    pct_debt: float = Field(0, ge=0, le=1)
    debt_rate: float = Field(0, ge=0, le=1)


class Funding(BaseModel):
    mix: Mix = Mix()
    cash_used: float = Field(0, ge=0)
    tranches: list[Tranche] = Field(default_factory=list, max_length=3)
    new_equity_amount: float = Field(0, ge=0)
    # 0 = issue at the acquirer's share price
    new_equity_price: float = Field(0, ge=0)
    # Which source automatically fills any gap between sources and uses
    balancing_item: Literal["none", "cash", "tranche_1", "tranche_2", "tranche_3"] = "none"
    # Share of pro forma cash net income used to repay debt early (0 = off)
    fcf_conversion_pct: float = Field(0, ge=0, le=1)


class Fees(BaseModel):
    advisory_pct: float = Field(0, ge=0, le=1)


class PPA(BaseModel):
    intangibles_input: Literal["amount", "pct_of_excess"] = "amount"
    # An amount, or a fraction of the excess purchase price
    intangibles: float = Field(0, ge=0)
    intangibles_life: float = Field(10, gt=0)
    ppe_writeup: float = Field(0, ge=0)
    ppe_life: float = Field(10, gt=0)


class Synergies(BaseModel):
    cost: float = Field(0, ge=0)
    cost_phase_in: list[float] = flat(1.0)
    revenue: float = Field(0, ge=0)
    revenue_margin: float = Field(0, ge=0, le=1)
    revenue_phase_in: list[float] = flat(1.0)
    revenue_probability: float = Field(1, ge=0, le=1)
    dis_synergies: float = Field(0, ge=0)
    dis_synergy_phase_in: list[float] = flat(1.0)
    integration_costs: float = Field(0, ge=0)
    integration_schedule: list[float] = [1.0, 0.0, 0.0, 0.0, 0.0]

    @field_validator("cost_phase_in", "revenue_phase_in", "dis_synergy_phase_in", "integration_schedule")
    @classmethod
    def check_years(cls, values, info):
        return five_years(values, info.field_name)


class Thresholds(BaseModel):
    max_leverage: float = Field(4.0, ge=0)
    min_coverage: float = Field(3.0, ge=0)


class Valuation(BaseModel):
    discount_rate: float = Field(0.10, ge=0, le=1)
    terminal_growth: float = Field(0.0, ge=-1, le=1)


class DealInputV2(BaseModel):
    model_version: Literal[2] = 2
    mode: Literal["simple", "advanced"] = "advanced"
    currency: Literal["USD", "INR"] = "USD"
    tax_rate: float = Field(ge=0, lt=1)
    acquirer: Acquirer
    target: Target
    offer: Offer = Offer()
    stake: Stake = Stake()
    funding: Funding = Funding()
    fees: Fees = Fees()
    ppa: PPA = PPA()
    synergies: Synergies = Synergies()
    thresholds: Thresholds = Thresholds()
    valuation: Valuation = Valuation()
    # Where auto-filled numbers came from (SEC filings, share prices) and whether
    # the user has checked them. Saved with the deal; the maths never reads it.
    data_sources: dict[str, Any] = Field(default_factory=dict)
