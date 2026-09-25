# sec.py
# Fetches data from the SEC's free EDGAR APIs, following the SEC's rules:
# a User-Agent with a contact email (from the SEC_USER_AGENT setting) and well
# under 10 requests per second.

import os
import threading
import time

import httpx

TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json"
COMPANYFACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"

MIN_SECONDS_BETWEEN_REQUESTS = 0.2  # at most 5 per second


class SecNotConfigured(Exception):
    pass


class SecNotFound(Exception):
    pass


class SecUnavailable(Exception):
    pass


def user_agent():
    value = os.getenv("SEC_USER_AGENT", "").strip()
    if "@" not in value:
        raise SecNotConfigured(
            "Company lookup isn't set up: the SEC_USER_AGENT setting (a name and contact email) is missing.")
    return value


class SecClient:
    def __init__(self, agent=None, timeout=30):
        self._agent = agent
        self._timeout = timeout
        self._lock = threading.Lock()
        self._last_request = 0.0

    def get_json(self, url):
        headers = {"User-Agent": self._agent or user_agent(), "Accept-Encoding": "gzip, deflate"}
        # Space requests out, even when several arrive at once
        with self._lock:
            wait = self._last_request + MIN_SECONDS_BETWEEN_REQUESTS - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            self._last_request = time.monotonic()
        try:
            response = httpx.get(url, headers=headers, timeout=self._timeout)
        except httpx.HTTPError as error:
            raise SecUnavailable(f"Couldn't reach the SEC ({error.__class__.__name__}). Try again shortly.")
        if response.status_code == 404:
            raise SecNotFound(url)
        if response.status_code != 200:
            raise SecUnavailable(f"The SEC returned an error ({response.status_code}). Try again shortly.")
        return response.json()


def normalize_ticker(ticker):
    """The SEC writes share classes with a dash: BRK.B → BRK-B."""
    return ticker.strip().upper().replace(".", "-").replace("/", "-")


def ticker_map(raw):
    """company_tickers.json → {"AAPL": {"cik": "0000320193", "name": "Apple Inc."}, ...}"""
    return {
        normalize_ticker(row["ticker"]): {"cik": str(row["cik_str"]).zfill(10), "name": row["title"]}
        for row in raw.values()
    }
