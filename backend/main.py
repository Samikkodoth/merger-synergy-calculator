# main.py
# The API: lets other programs (like our website) use the calculator.
import os
import re
from contextlib import asynccontextmanager
from datetime import date
from typing import Any, Literal, Optional

from fastapi import Body, FastAPI, HTTPException, Path, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field, ValidationError

import database
from companydata import prices as price_data
from companydata.sec import SecClient, SecNotConfigured, SecUnavailable, user_agent
from companydata.service import CompanyData, DatabaseCache, UnknownTicker
from companydata.xbrl import UnsupportedCompany
from excel_export import workbook_bytes
from model.engine import run_model
from model.legacy import parse_deal
from model.sensitivity import AXES, run_sensitivity


@asynccontextmanager
async def lifespan(app):
    # Make sure the deals table exists when the server starts
    database.create_table()
    yield


app = FastAPI(title="Merger Synergy Calculator API", lifespan=lifespan)

# Which websites may call this API. Online, this is set on the hosting service.
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip().rstrip("/") for origin in ALLOWED_ORIGINS],
    allow_methods=["*"],
    allow_headers=["*"],
    # Lets the website read the file name of an Excel download
    expose_headers=["Content-Disposition"],
)

# Company lookups (SEC filings and share prices), cached in the database
company_data = CompanyData(SecClient(), DatabaseCache())

Axis = Literal[tuple(AXES)]


class SensitivityRequest(BaseModel):
    inputs: dict[str, Any]
    x_axis: Axis = "price"
    y_axis: Axis = "synergies"


class ExportRequest(SensitivityRequest):
    name: str = Field("Deal", max_length=200)


class SaveDealRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    inputs: dict[str, Any]


def readable(error: ValidationError) -> str:
    first = error.errors()[0]
    where = ".".join(str(part) for part in first["loc"])
    return f"{where}: {first['msg']}" if where else first["msg"]


def load_deal(data):
    """Parse either input format; bad inputs become a 422 with a readable message."""
    try:
        return parse_deal(data)
    except ValidationError as error:
        raise HTTPException(status_code=422, detail=readable(error))


def run_or_400(function, *args):
    try:
        return function(*args)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.get("/")
def health_check():
    return {"status": "The Merger Synergy Calculator API is running"}


@app.post("/calculate")
def calculate(inputs: dict[str, Any] = Body(...)):
    return run_or_400(run_model, load_deal(inputs))


@app.post("/sensitivity")
def sensitivity(body: dict[str, Any] = Body(...)):
    # The original app posted the deal itself; that still works (price x synergies).
    if "inputs" not in body:
        body = {"inputs": body}
    try:
        request = SensitivityRequest.model_validate(body)
    except ValidationError as error:
        raise HTTPException(status_code=422, detail=readable(error))
    deal = load_deal(request.inputs)
    return run_or_400(run_sensitivity, deal, request.x_axis, request.y_axis)


@app.post("/export")
def export_excel(request: ExportRequest):
    deal = load_deal(request.inputs)
    run_or_400(run_model, deal)
    try:
        grid = run_sensitivity(deal, request.x_axis, request.y_axis)
    except ValueError:
        grid = None  # The chosen axes don't apply to this deal; export without a grid.
    filename = re.sub(r"[^A-Za-z0-9 _-]", "", request.name).strip().replace(" ", "_") or "Deal"
    return Response(
        content=workbook_bytes(deal, grid),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}.xlsx"'},
    )


@app.post("/deals")
def save_new_deal(request: SaveDealRequest):
    deal = load_deal(request.inputs)
    results = run_or_400(run_model, deal)
    saved = database.save_deal(request.name, deal.model_dump(), results, 2, deal.currency)
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
    saved = database.get_deal(deal_id)
    if saved is None:
        raise HTTPException(status_code=404, detail="Deal not found")
    # Old deals are converted to the new format (simple mode) and recalculated,
    # so the results always have the current shape.
    deal = load_deal(saved["inputs"])
    return {
        "id": saved["id"],
        "name": saved["name"],
        "created_at": saved["created_at"],
        "currency": deal.currency,
        "inputs": deal.model_dump(),
        "results": run_or_400(run_model, deal),
    }


@app.delete("/deals/{deal_id}")
def remove_deal(deal_id: int):
    if not database.delete_deal(deal_id):
        raise HTTPException(status_code=404, detail="Deal not found")
    return {"deleted": deal_id}


# ---------------------------------------------------------------- Company data (SEC filings and prices)

Ticker = Path(pattern=r"^[A-Za-z0-9.\-]{1,12}$", description="e.g. AAPL or BRK.B")


def company_data_errors(function, *args):
    """Turn lookup problems into clear messages with the right status code."""
    try:
        return function(*args)
    except SecNotConfigured as error:
        raise HTTPException(status_code=503, detail=str(error))
    except (UnknownTicker, price_data.PriceNotFound) as error:
        raise HTTPException(status_code=404, detail=str(error))
    except UnsupportedCompany as error:
        raise HTTPException(status_code=422, detail=str(error))
    except (SecUnavailable, price_data.PriceUnavailable) as error:
        raise HTTPException(status_code=502, detail=str(error))


@app.get("/company-data/status")
def company_data_status():
    """Which automatic data is available on this server."""
    try:
        user_agent()
        sec = True
    except SecNotConfigured:
        sec = False
    has_prices = price_data.configured_source() is not None
    return {"sec": sec, "prices": has_prices, "prices_message": None if has_prices else price_data.LOCAL_ONLY}


@app.get("/company/{ticker}")
def get_company(ticker: str = Ticker):
    return company_data_errors(company_data.company, ticker)


@app.get("/price/{ticker}")
def get_price(ticker: str = Ticker, announced: Optional[date] = Query(None, description="Announcement date")):
    if announced is not None and announced > date.today():
        raise HTTPException(status_code=422, detail="The announcement date can't be in the future.")
    return company_data_errors(company_data.prices, ticker, announced)
