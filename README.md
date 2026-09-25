# Merger Synergy Calculator

An accretion/dilution model for mergers and acquisitions. Enter a deal and see, for each of the
next five years, whether it raises or lowers the buyer's earnings per share (EPS), what the buyer
pays, how it's financed, and whether the synergies justify the premium.

- **Simple mode** is the original calculator: a purchase price paid with a mix of stock, cash and
  debt, plus cost and revenue synergies and integration costs.
- **Advanced mode** adds offer terms (premium, EV, implied multiples), partial stakes and open
  offers, sources & uses, up to three debt tranches with amortization, fees and an optional cash
  sweep, standalone forecasts, purchase price allocation, GAAP and cash EPS, breakeven synergies,
  credit metrics, value creation, and a configurable sensitivity grid.
- **Currency:** USD ($M / $B) or INR (₹ crore / ₹ lakh crore). This changes labels and units
  only, never the maths.
- **Excel export:** the whole model as an `.xlsx` with live formulas.
- **Fill from SEC filings:** type the buyer's and target's tickers to fill in their financials
  from their latest 10-K and 10-Q (US SEC filers only). Every filled field shows its source.

## Running it locally

You need Python 3 and Node.js.

**Backend** (in `backend/`):

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

It reads these settings from `backend/.env` (never commit that file):

| Setting | What it is |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `ALLOWED_ORIGINS` | Website addresses allowed to call the API (default `http://localhost:3000`) |
| `SEC_USER_AGENT` | A name and contact email, e.g. `Merger Synergy Calculator you@example.com`. The SEC requires one; without it, company lookup is switched off |
| `TIINGO_API_KEY` | Optional. Turns on automatic share prices. **Set it on your own computer only** (see below) |

On startup it creates the `deals` and `data_cache` tables, or adds any new columns.

**Frontend** (in `frontend/`):

```bash
npm install
npm run dev
```

It calls the API at `NEXT_PUBLIC_API_URL` (default `http://127.0.0.1:8000`). Open
http://localhost:3000.

## Tests

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest
```

```bash
cd frontend
npm test
```

The backend tests cover every calculation, including the example cases in `UPGRADE_PLAN.md`
(section 6). They also recalculate the Excel export's formulas and check that they match the
Python model. Company lookup is tested with saved SEC data for Apple, Coca-Cola and Microsoft
(`backend/tests/fixtures/sec/`, trimmed by `trim_sample.py` there). No test needs the internet or
a database.

## How the model works

The code lives in `backend/model/`, one file per step. `engine.py` runs them in order.

| Step | File |
|---|---|
| Offer price, premium, EV, multiples; stake bought in each leg | `offer.py` |
| Exchange ratio, sources & uses, pro forma ownership | `financing.py` |
| Purchase price allocation (goodwill, write-ups, deferred tax) | `ppa.py` |
| Standalone forecasts for Years 1–5 | `forecast.py` |
| Debt tranches: interest, amortization, fees, cash sweep | `debt.py` |
| Pro forma net income, GAAP and cash EPS, breakeven synergies, credit metrics | `proforma.py` |
| Present value of synergies vs premium paid | `value.py` |
| Sensitivity grids | `sensitivity.py` |
| Old saved deals → simple mode | `legacy.py` |

### Conventions and simplifications

- The deal closes at the start of Year 1. One tax rate applies to all pre-tax items.
- Accretion is measured against the acquirer's **standalone forecast EPS for the same year**.
- Only the equity purchase price is paid for through the deal financing. Target debt is either
  assumed (its interest is already in the target's net income) or refinanced at close.
- Interest is charged on each tranche's **opening balance** for the year, which avoids circular
  calculations. Financing fees are spread evenly over each tranche's term. A tranche still
  outstanding after its term is assumed to be refinanced on the same terms.
- The **cash sweep** is a simplification: pro forma cash net income × an FCF conversion %,
  applied after mandatory amortization, to tranches in order.
- Advisory fees are a one-time cost at close and are left out of recurring EPS.
- **Partial acquisitions** use the partial goodwill convention. Write-ups are recorded at 100%
  and fully amortized, goodwill is recognised only on the acquirer's stake, and minority holders
  take their share of the target's net income after amortization and after synergies realised
  inside the target. Savings from refinancing target debt are not shared with minority holders.
- **Enter acquirer figures as reported**, the way they appear in filings. They already include
  any stake held in the target before the deal, so the model never adds it again:
  - **20–50% owned (equity method):** reported net income already includes stake % × target net
    income. Standalone EPS uses the reported figure, and the deal adds only the additional stake.
  - **Over 50% owned (already consolidated):** reported revenue, EBITDA, cash, debt and interest
    already include 100% of the target, and net income is after minority interest. Buying more
    only reduces the minority interest; the target's EBITDA and debt are not added again in the
    credit metrics. If the target's debt is refinanced, it is replaced rather than added.
    Buying more of a company that is already controlled is an equity transaction, so there is no
    new goodwill, write-ups or amortization.
  - **Below 20%:** a financial investment. Nothing in the acquirer's figures comes from it. For
    goodwill, a stake owned before the deal is valued at the offer price.
- **Equity method (20–50%):** only the acquirer's share of the target's net income is included.
  There is no PPA and nothing of the target is consolidated. **Below 20%**, the holding is a
  financial investment: dividends aren't modelled and synergies aren't counted.
- **Sensitivity grids:** when a scenario needs more or less cash, each funding source keeps its
  share of the funding.
- **Value creation:** end-of-year discounting. The terminal value is a growing perpetuity on
  the Year 5 run-rate synergies (excluding one-time integration costs).
- **Excel export:** every tab is live formulas linked to the Inputs tab, except Sensitivities,
  which holds fixed values (Python can't create Excel data tables).

## Data sources

### Company financials: SEC EDGAR (free, no key)

The code is in `backend/companydata/`. It uses the SEC's free APIs: `company_tickers.json`
(ticker → company number), `submissions` (company details, industry, filing list) and
`companyfacts` (every number tagged in the filings). Requests carry the `SEC_USER_AGENT` contact
and are spaced at no more than 5 a second (the SEC's limit is 10). Each company's processed
figures are cached in the database for a day; the SEC's raw files (up to 15 MB) are not stored.

What gets filled, for each company:

| Field | How |
|---|---|
| Revenue, EBITDA, net income, interest expense, tax rate | Last twelve months (latest fiscal year + this year to date − the same period last year) or the latest fiscal year, your choice |
| EBITDA | Operating income + depreciation & amortization |
| Effective tax rate | Income tax ÷ pre-tax income. Shown with a "use" button, as one rate applies to the whole deal |
| Cash, total debt, book equity | The latest balance sheet (10-K or 10-Q), whichever basis is chosen |
| Total debt | Long-term debt including the part due within a year, plus short-term borrowings. Operating leases are not included |
| Buyer's diluted shares | Weighted average diluted shares (the latest quarter, or the fiscal year), as reported EPS uses |
| Target's shares | Shares outstanding from the latest filing's cover page, with its "as of" date; the weighted average diluted count if the cover page has none. Options, RSUs and convertibles are not included |
| Historical growth | 3-year revenue and net income growth, labelled "historical, not a forecast". Only used if you click "Use as forecast" |

Companies tag the same item differently, so each field tries an ordered list of XBRL tags and
records the one it used (`backend/companydata/xbrl.py`).

Every filled field has a tag you can open to see the company, filing type, period, filing date,
XBRL tag and a link to the filing:

- **Auto · verify:** filled from a filing, not yet checked. Click "Mark as checked" when you have.
- **Checked:** you confirmed it. **Manual:** you edited it (the source's figure is kept for reference).
- **Not in filings:** the field is left blank for you to enter. Nothing is guessed.
- **You fill this:** forecasts, synergies, integration costs, PPA, the offer price and the
  tax rate have no free source.

Warnings are shown for missing items, filings more than 15 months old, negative EBITDA, net income
far from what operating income suggests (one-time or non-operating items), tax rates outside
0–40%, banks/insurers/REITs, several listed share classes, and cover-page share counts far from
the diluted count.

Limits:

- **US SEC filers only**, reporting in USD under US GAAP. Foreign filers (20-F/40-F), Indian
  (NSE/BSE) and private companies need manual entry; Indian deals work fully in ₹ crore.
- The SEC adds a filing's numbers to its data a little after the filing appears, so a very recent
  10-Q may not be used yet.
- Some companies don't tag some items (Apple, for example, stopped tagging interest expense);
  those fields are marked "Not in filings". A tag with a negative value for an item that can't be
  negative (revenue, D&A, interest, shares) is not trusted.
- Changing between "Last twelve months" and "Latest fiscal year" refills the company figures,
  replacing any edits to them.

### Share prices: Tiingo (optional, local use only)

With `TIINGO_API_KEY` set, the buyer's share price and the target's **unaffected price** are the
last close before the announcement date (default: today), adjusted for any share splits since.
Prices are cached for a day. The provider sits behind a small adapter
(`backend/companydata/prices.py`), so it can be swapped.

Tiingo's free plan is for **internal use only** (no public display), so the key is set on your
own computer and **not** on Render. Without it, the price fields stay manual with the note
"Automatic prices available in local use only". Stooq (free, no key) now blocks automated
downloads, and Yahoo Finance's terms don't allow this use, so neither is used.

To turn prices on locally: create a free account at tiingo.com (no card needed), copy your API
token from the account page, and add `TIINGO_API_KEY=<your token>` to `backend/.env`.

## Hosting

Backend on Render (free plan; it sleeps when idle, so the first request can take up to a minute),
database on Neon (free plan), frontend on Vercel (Hobby). On Render, set `SEC_USER_AGENT` (but not
`TIINGO_API_KEY`). The database changes are additive only (new columns with defaults, and a new
`data_cache` table), so deals saved by earlier versions still load. They open in simple
mode, with their 3-year schedules extended to 5 years.
