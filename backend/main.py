# main.py
# The API: lets other programs (like our website) use the calculator.

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import database
from calculator import calculate_deal

app = FastAPI(title="Merger Synergy Calculator API")

# Allow our future Next.js website (at localhost:3000) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Make sure the deals table exists when the server starts
database.create_table()


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


class SaveDealRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    inputs: DealInput


def run_calculation(inputs):
    try:
        return calculate_deal(**inputs)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.get("/")
def health_check():
    return {"status": "The Merger Synergy Calculator API is running"}


@app.post("/calculate")
def calculate(deal: DealInput):
    return run_calculation(deal.model_dump())


@app.post("/deals")
def save_new_deal(request: SaveDealRequest):
    inputs = request.inputs.model_dump()
    results = run_calculation(inputs)
    saved = database.save_deal(request.name, inputs, results)
    return {
        "id": saved["id"],
        "name": saved["name"],
        "created_at": saved["created_at"],
        "results": results,
    }


@app.get("/deals")
def get_all_deals():
    return database.list_deals()


@app.get("/deals/{deal_id}")
def get_one_deal(deal_id: int):
    deal = database.get_deal(deal_id)
    if deal is None:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


@app.delete("/deals/{deal_id}")
def remove_deal(deal_id: int):
    if not database.delete_deal(deal_id):
        raise HTTPException(status_code=404, detail="Deal not found")
    return {"deleted": deal_id}

PRICE_CHANGES = [-0.20, -0.10, 0.0, 0.10, 0.20]
SYNERGY_CHANGES = [0.50, 0.25, 0.0, -0.25, -0.50]


@app.post("/sensitivity")
def sensitivity(deal: DealInput):
    base = deal.model_dump()
    grid = []

    for synergy_change in SYNERGY_CHANGES:
        row = []
        for price_change in PRICE_CHANGES:
            scenario = {
                **base,
                "purchase_price": base["purchase_price"] * (1 + price_change),
                "cost_synergies": base["cost_synergies"] * (1 + synergy_change),
                "revenue_synergies": base["revenue_synergies"] * (1 + synergy_change),
            }
            results = run_calculation(scenario)
            row.append([year["accretion_pct"] for year in results["years"]])
        grid.append(row)

    return {
        "price_changes": PRICE_CHANGES,
        "synergy_changes": SYNERGY_CHANGES,
        "accretion": grid,
    }