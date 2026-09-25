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

## Running it locally

You need Python 3 and Node.js.

**Backend** (in `backend/`):

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

It reads `DATABASE_URL` (a PostgreSQL connection string) from `backend/.env`, and
`ALLOWED_ORIGINS` (the website addresses allowed to call it; default `http://localhost:3000`).
On startup it creates the `deals` table, or adds any new columns to it.

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
Python model. No test needs the internet or a database.

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

Phase 1 uses only the numbers you type in; the app calls no outside data services.

## Hosting

Backend on Render (free plan; it sleeps when idle, so the first request can take up to a minute),
database on Neon (free plan), frontend on Vercel (Hobby). The database changes are additive only
(new columns with defaults), so deals saved by earlier versions still load. They open in simple
mode, with their 3-year schedules extended to 5 years.
