# service.py
# Company lookups with a cache: each company is fetched from the SEC at most
# once a day, and share prices at most once a day per ticker and date.
#
# Only the processed result is cached (a few KB), never the SEC's raw file
# (up to 15 MB), to stay well inside the free database's 0.5 GB.

import logging
import time
from datetime import date, datetime, timedelta, timezone

from companydata import checks, prices, xbrl
from companydata.sec import (
    COMPANYFACTS_URL, SUBMISSIONS_URL, TICKERS_URL, SecNotFound, normalize_ticker, ticker_map,
)

log = logging.getLogger(__name__)

COMPANY_MAX_AGE = timedelta(days=1)
PRICE_MAX_AGE = timedelta(days=1)
TICKERS_MAX_AGE_SECONDS = 24 * 60 * 60


class UnknownTicker(Exception):
    pass


class MemoryCache:
    """Stand-in cache for tests, and the fallback when the database is down."""

    def __init__(self):
        self.rows = {}

    def get(self, key):
        return self.rows.get(key)

    def put(self, key, payload):
        self.rows[key] = (payload, datetime.now(timezone.utc))


class DatabaseCache:
    """The data_cache table. A database problem never stops a lookup; it just isn't cached."""

    def get(self, key):
        import database
        try:
            row = database.cache_get(key)
        except Exception:
            log.exception("Reading the cache failed")
            return None
        return None if row is None else (row["payload"], row["fetched_at"])

    def put(self, key, payload):
        import database
        try:
            database.cache_put(key, payload)
        except Exception:
            log.exception("Writing the cache failed")


def fresh(cached, max_age):
    if cached is None:
        return None
    payload, fetched_at = cached
    return payload if datetime.now(timezone.utc) - fetched_at < max_age else None


class CompanyData:
    def __init__(self, client, cache):
        self.client = client
        self.cache = cache
        self._tickers = None
        self._tickers_loaded = 0.0

    # ------------------------------------------------------------ Tickers

    def tickers(self):
        # Kept in memory only: it's 800 KB, and Render restarts the server after it sleeps.
        if self._tickers is None or time.monotonic() - self._tickers_loaded > TICKERS_MAX_AGE_SECONDS:
            self._tickers = ticker_map(self.client.get_json(TICKERS_URL))
            self._tickers_loaded = time.monotonic()
        return self._tickers

    def resolve(self, ticker):
        symbol = normalize_ticker(ticker)
        company = self.tickers().get(symbol)
        if company is None:
            raise UnknownTicker(f"{symbol} isn't a ticker the SEC knows. Only US SEC filers are covered.")
        return symbol, company

    # ------------------------------------------------------------ Financials

    def company(self, ticker, today=None):
        symbol, company = self.resolve(ticker)
        key = f"sec:company:{company['cik']}"
        profile = fresh(self.cache.get(key), COMPANY_MAX_AGE)
        if profile is None or profile.get("parser_version") != xbrl.PARSER_VERSION:
            profile = self.fetch_company(symbol, company["cik"])
            profile["fetched_at"] = datetime.now(timezone.utc).isoformat()
            self.cache.put(key, profile)
        # The ticker typed may be another share class of the same company
        profile = {**profile, "ticker": symbol}
        # Worked out on every request, so "out of date" is judged against today
        return {**profile, "warnings": checks.review(profile, today)}

    def fetch_company(self, symbol, cik):
        submissions = self.client.get_json(SUBMISSIONS_URL.format(cik=cik))
        try:
            facts = self.client.get_json(COMPANYFACTS_URL.format(cik=cik))
        except SecNotFound:
            raise xbrl.UnsupportedCompany(
                "The SEC has no financial data (XBRL) for this company. Enter its figures manually.")
        return xbrl.parse_company(facts, submissions, symbol)

    # ------------------------------------------------------------ Prices

    def prices(self, ticker, announced=None, today=None):
        today = today or date.today()
        source = prices.configured_source()
        if source is None:
            return prices.lookup_prices(None, ticker)
        symbol = normalize_ticker(ticker)
        key = f"price:{source.name}:{symbol}:{announced.isoformat() if announced else 'latest'}:{today.isoformat()}"
        cached = fresh(self.cache.get(key), PRICE_MAX_AGE)
        if cached is not None:
            return cached
        result = prices.lookup_prices(source, symbol, announced, today)
        self.cache.put(key, result)
        return result
