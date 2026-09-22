# main.py
# The API: lets other programs (like our website) use the calculator.

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from calculator import calculate_deal

app = FastAPI(title="Merger Synergy Calculator API")

# Allow our future Next.js website (at localhost:3000) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class DealInput(BaseModel):
    # The acquirer
    acquirer_net_income: float
    acquirer_shares: float = Field(gt=0)
    acquirer_share_price: float = Field(gt=0)
    # The target and the price
    target_net_income: float
    purchase_price: float = Field(gt=0)
    tax_rate: float = Field(ge=0, le=1)
    # How the deal is paid for
    pct_stock: float = Field(ge=0, le=1)
    pct_cash: float = Field(ge=0, le=1)
    pct_debt: float = Field(ge=0, le=1)
    interest_rate_on_cash: float = Field(ge=0, le=1)
    interest_rate_on_debt: float = Field(ge=0, le=1)
    # Cost synergies
    cost_synergies: float = Field(ge=0)
    cost_synergy_phase_in: list[float]
    # Revenue synergies
    revenue_synergies: float = Field(ge=0)
    revenue_synergy_margin: float = Field(ge=0, le=1)
    revenue_synergy_phase_in: list[float]
    # Integration costs
    integration_costs: float = Field(ge=0)
    integration_cost_schedule: list[float]


@app.get("/")
def health_check():
    return {"status": "The Merger Synergy Calculator API is running"}


@app.post("/calculate")
def calculate(deal: DealInput):
    try:
        return calculate_deal(**deal.model_dump())
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))