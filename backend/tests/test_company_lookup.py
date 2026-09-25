# Company lookups: prices (with a fake source), the daily cache, and the API.
# Nothing here uses the internet.
import json
import os
from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

import main
from companydata import prices
from companydata.prices import LOCAL_ONLY, PriceNotFound, lookup_prices
from companydata.sec import SecClient, SecNotConfigured, SecNotFound, normalize_ticker, ticker_map
from companydata.service import CompanyData, DatabaseCache, MemoryCache, UnknownTicker
from companydata.xbrl import PARSER_VERSION, UnsupportedCompany

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures", "sec")


# ---------------------------------------------------------------- Prices

class FakePrices:
    name = "Fake"

    def __init__(self, rows):
        self.rows = rows
        self.calls = 0

    def daily_closes(self, ticker, start, end):
        self.calls += 1
        return [r for r in self.rows if start.isoformat() <= r["date"] <= end.isoformat()]


def row(day, close, split=1.0):
    return {"date": day, "close": close, "split_factor": split}


# Thu 18 Sep 2026 … Thu 24 Sep 2026 (no trading on the weekend)
WEEK = [row("2026-09-17", 19.0), row("2026-09-18", 20.0), row("2026-09-21", 22.0),
        row("2026-09-22", 23.0), row("2026-09-23", 24.0), row("2026-09-24", 25.0)]


def test_no_key_means_manual_prices():
    result = lookup_prices(None, "AAPL", date(2026, 9, 21))
    assert result == {"available": False, "message": LOCAL_ONLY}


def test_unaffected_price_is_the_last_close_before_the_announcement():
    # Announced Monday 21 Sep: the last close before it is Friday 18 Sep ($20)
    result = lookup_prices(FakePrices(WEEK), "BETA", date(2026, 9, 21), today=date(2026, 9, 25))
    assert result["unaffected"]["price"] == 20.0
    assert result["unaffected"]["date"] == "2026-09-18"
    assert result["unaffected"]["note"] is None
    assert result["current"] == {"price": 25.0, "date": "2026-09-24"}


def test_unaffected_price_is_adjusted_for_later_splits():
    # A 2-for-1 split on 22 Sep: the $20 close before it equals $10 in today's shares
    rows = [*WEEK[:3], row("2026-09-22", 11.5, split=2.0), *WEEK[4:]]
    result = lookup_prices(FakePrices(rows), "BETA", date(2026, 9, 21), today=date(2026, 9, 25))
    assert result["unaffected"]["price"] == 10.0
    assert result["unaffected"]["raw_close"] == 20.0
    assert "split" in result["unaffected"]["note"]


def test_no_prices_at_all():
    with pytest.raises(PriceNotFound):
        lookup_prices(FakePrices([]), "NONE", None, today=date(2026, 9, 25))


def test_tiingo_is_used_only_with_a_key(monkeypatch):
    monkeypatch.delenv("TIINGO_API_KEY", raising=False)
    assert prices.configured_source() is None
    monkeypatch.setenv("TIINGO_API_KEY", "abc")
    assert prices.configured_source().name == "Tiingo"


# ---------------------------------------------------------------- SEC client and tickers

def test_user_agent_is_required(monkeypatch):
    monkeypatch.delenv("SEC_USER_AGENT", raising=False)
    with pytest.raises(SecNotConfigured):
        SecClient().get_json("https://www.sec.gov/files/company_tickers.json")


def test_ticker_map_and_share_classes():
    raw = {"0": {"cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc."},
           "1": {"cik_str": 1067983, "ticker": "BRK-B", "title": "Berkshire Hathaway"}}
    tickers = ticker_map(raw)
    assert tickers["AAPL"] == {"cik": "0000320193", "name": "Apple Inc."}
    assert normalize_ticker(" brk.b ") == "BRK-B"
    assert normalize_ticker("brk.b") in tickers


# ---------------------------------------------------------------- The service and its cache

def fixture(name):
    with open(os.path.join(FIXTURES, name)) as f:
        return json.load(f)


class FakeSec:
    """Answers like the SEC, from the saved files."""

    def __init__(self):
        self.calls = []

    def get_json(self, url):
        self.calls.append(url)
        if url.endswith("company_tickers.json"):
            return {"0": {"cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc."},
                    "1": {"cik_str": 789019, "ticker": "MSFT", "title": "Microsoft"},
                    "2": {"cik_str": 99, "ticker": "NOXBRL", "title": "No XBRL Corp"}}
        cik = url.split("CIK")[1][:10]
        if "companyfacts" in url:
            if cik == "0000000099":
                raise SecNotFound(url)
            return fixture(f"companyfacts_{cik}.json")
        if cik == "0000000099":
            return {"cik": 99, "name": "No XBRL Corp", "filings": {"recent": {}}}
        return fixture(f"submissions_{cik}.json")


def test_company_lookup_and_daily_cache():
    sec, cache = FakeSec(), MemoryCache()
    data = CompanyData(sec, cache)
    first = data.company("aapl", today=date(2026, 9, 25))
    assert first["name"] == "Apple Inc."
    assert first["ticker"] == "AAPL"
    assert [w["code"] for w in first["warnings"]] == ["missing_interest_expense"] * 2
    requests = len(sec.calls)  # tickers + submissions + company facts
    assert requests == 3

    # Asked again the same day: no new requests to the SEC
    again = data.company("AAPL", today=date(2026, 9, 25))
    assert again["fields"] == first["fields"]
    assert len(sec.calls) == requests

    # A day later the cached copy is stale, so it's fetched again
    payload, fetched_at = cache.rows["sec:company:0000320193"]
    cache.rows["sec:company:0000320193"] = (payload, fetched_at - timedelta(days=1, minutes=1))
    data.company("AAPL", today=date(2026, 9, 26))
    assert len(sec.calls) == requests + 2


def test_cached_results_from_an_older_parser_are_rebuilt():
    sec, cache = FakeSec(), MemoryCache()
    cache.rows["sec:company:0000320193"] = ({"parser_version": PARSER_VERSION - 1}, datetime.now(timezone.utc))
    profile = CompanyData(sec, cache).company("AAPL")
    assert profile["parser_version"] == PARSER_VERSION


def test_unknown_ticker():
    with pytest.raises(UnknownTicker, match="Only US SEC filers"):
        CompanyData(FakeSec(), MemoryCache()).company("ZZZZ")


def test_company_without_financial_data():
    with pytest.raises(UnsupportedCompany, match="no financial data"):
        CompanyData(FakeSec(), MemoryCache()).company("NOXBRL")


def test_a_database_problem_does_not_stop_a_lookup(monkeypatch):
    import database

    def broken(*args):
        raise RuntimeError("database is down")

    monkeypatch.setattr(database, "cache_get", broken)
    monkeypatch.setattr(database, "cache_put", broken)
    profile = CompanyData(FakeSec(), DatabaseCache()).company("MSFT")
    assert profile["name"] == "MICROSOFT CORP"


def test_prices_are_cached_per_day(monkeypatch):
    fake = FakePrices(WEEK)
    monkeypatch.setattr(prices, "configured_source", lambda: fake)
    data = CompanyData(FakeSec(), MemoryCache())
    first = data.prices("beta", date(2026, 9, 21), today=date(2026, 9, 25))
    second = data.prices("BETA", date(2026, 9, 21), today=date(2026, 9, 25))
    assert first == second
    assert fake.calls == 1


def test_prices_without_a_key(monkeypatch):
    monkeypatch.delenv("TIINGO_API_KEY", raising=False)
    result = CompanyData(FakeSec(), MemoryCache()).prices("AAPL", date(2026, 9, 21))
    assert result["available"] is False


# ---------------------------------------------------------------- The API

@pytest.fixture
def api(monkeypatch):
    monkeypatch.setattr(main, "company_data", CompanyData(FakeSec(), MemoryCache()))
    monkeypatch.setenv("SEC_USER_AGENT", "Test app test@example.com")
    monkeypatch.delenv("TIINGO_API_KEY", raising=False)
    return TestClient(main.app)


def test_api_company(api):
    response = api.get("/company/MSFT")
    assert response.status_code == 200
    body = response.json()
    assert body["fields"]["revenue"]["ttm"]["value"] == 331_839_000_000
    assert isinstance(body["warnings"], list)


def test_api_errors_are_readable(api):
    assert api.get("/company/ZZZZ").status_code == 404
    assert api.get("/company/NOXBRL").status_code == 422
    assert api.get("/company/not a ticker!").status_code in (404, 422)


def test_api_without_the_sec_setting(api, monkeypatch):
    monkeypatch.delenv("SEC_USER_AGENT")
    monkeypatch.setattr(main, "company_data", CompanyData(SecClient(), MemoryCache()))
    response = api.get("/company/AAPL")
    assert response.status_code == 503
    assert "SEC_USER_AGENT" in response.json()["detail"]
    assert api.get("/company-data/status").json()["sec"] is False


def test_api_status_and_prices_without_a_key(api):
    assert api.get("/company-data/status").json() == {"sec": True, "prices": False, "prices_message": LOCAL_ONLY}
    response = api.get("/price/AAPL", params={"announced": "2026-01-05"})
    assert response.status_code == 200
    assert response.json() == {"available": False, "message": LOCAL_ONLY}


def test_api_prices_with_a_source(api, monkeypatch):
    # The API uses the real date, so the fake prices are the last few days
    days = [(date.today() - timedelta(days=n)).isoformat() for n in (3, 2, 1)]
    monkeypatch.setattr(prices, "configured_source", lambda: FakePrices([row(d, 10.0 + i) for i, d in enumerate(days)]))
    body = api.get("/price/BETA", params={"announced": days[2]}).json()
    assert body["unaffected"] == {**body["unaffected"], "price": 11.0, "date": days[1]}
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    assert api.get("/price/BETA", params={"announced": tomorrow}).status_code == 422
