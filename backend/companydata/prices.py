# prices.py
# Share prices, behind a small adapter so the provider can be swapped.
#
# The provider is Tiingo, used only when TIINGO_API_KEY is set. Tiingo's free
# plan is for internal use only, so the key is set on a laptop, never on the
# public site. Without a key, price fields stay manual.

import os
from datetime import date, timedelta

import httpx

LOCAL_ONLY = "Automatic prices available in local use only. Enter share prices manually."

# Enough calendar days to span any run of weekends and market holidays
LOOKBACK_DAYS = 14


class PriceNotFound(Exception):
    pass


class PriceUnavailable(Exception):
    pass


class TiingoSource:
    """Daily closes from Tiingo's end-of-day API."""

    name = "Tiingo"
    URL = "https://api.tiingo.com/tiingo/daily/{ticker}/prices"

    def __init__(self, api_key, timeout=20):
        self._key = api_key
        self._timeout = timeout

    def daily_closes(self, ticker, start, end):
        """[{"date": "2026-09-24", "close": 231.5, "split_factor": 1.0}, ...], oldest first."""
        try:
            response = httpx.get(
                self.URL.format(ticker=ticker),
                params={"startDate": start.isoformat(), "endDate": end.isoformat()},
                headers={"Authorization": f"Token {self._key}"},
                timeout=self._timeout,
            )
        except httpx.HTTPError as error:
            raise PriceUnavailable(f"Couldn't reach Tiingo ({error.__class__.__name__}).")
        if response.status_code == 404:
            raise PriceNotFound(f"Tiingo has no prices for {ticker}.")
        if response.status_code != 200:
            raise PriceUnavailable(f"Tiingo returned an error ({response.status_code}).")
        return [
            {"date": row["date"][:10], "close": row["close"], "split_factor": row.get("splitFactor", 1.0)}
            for row in response.json()
        ]


def configured_source():
    """The price source to use, or None when no key is set."""
    key = os.getenv("TIINGO_API_KEY", "").strip()
    return TiingoSource(key) if key else None


def split_note(factor):
    return f"Adjusted for share splits since then (÷{factor:g}), to match today's share count."


def lookup_prices(source, ticker, announced=None, today=None):
    """The latest close and, given an announcement date, the unaffected price:
    the last close before that date, adjusted for any later share splits."""
    today = today or date.today()
    if source is None:
        return {"available": False, "message": LOCAL_ONLY}

    start = min(announced or today, today) - timedelta(days=LOOKBACK_DAYS)
    rows = source.daily_closes(ticker, start, today)
    if not rows:
        raise PriceNotFound(f"No recent prices for {ticker}.")

    latest = rows[-1]
    result = {
        "available": True,
        "source": source.name,
        "ticker": ticker,
        "current": {"price": latest["close"], "date": latest["date"]},
        "unaffected": None,
    }
    if announced is not None:
        before = [row for row in rows if row["date"] < announced.isoformat()]
        if not before:
            result["unaffected_message"] = (
                f"No trading day in the {LOOKBACK_DAYS} days before {announced.isoformat()}.")
        else:
            close = before[-1]
            factor = 1.0
            for row in rows:
                if row["date"] > close["date"]:
                    factor *= row["split_factor"] or 1.0
            result["unaffected"] = {
                "price": close["close"] / factor,
                "date": close["date"],
                "announced": announced.isoformat(),
                "raw_close": close["close"],
                "split_factor": factor,
                "note": split_note(factor) if factor != 1.0 else None,
            }
    return result
