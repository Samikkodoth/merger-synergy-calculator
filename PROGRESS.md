# Progress

Tracks the upgrade described in `UPGRADE_PLAN.md`. All work is on the `ib-upgrade` branch;
`main` (which the live site deploys from) is unchanged until the merge is approved.

| Phase | Status |
|---|---|
| 1. Finance model | **Done**, awaiting browser testing and approval to merge |
| 2. Automatic company data (SEC EDGAR) | **Done**, awaiting browser testing and approval |
| 3. Recent deals discovery | Not started |

## Phase 1: finance model

### What was built

**Backend** (`backend/model/`, one file per step, run in order by `engine.py`):

- **Offer structure:** offer price or premium, equity value, EV (with net debt, preferred stock
  and minority interest), EV/Revenue, EV/EBITDA, P/E, premium paid. Target debt assumed or
  refinanced.
- **Partial acquisitions and open offers:** existing stake, negotiated stake, open offer size,
  price and acceptance; final stake; consolidation / equity method / financial investment
  (automatic by stake, or overridden); minority interest, including synergies realised inside
  the target.
- **Consideration:** cash/stock split, exchange ratio, shares issued, new equity raised at its
  own issue price, pro forma ownership.
- **Sources & uses:** equity purchase, debt refinanced, advisory fees, financing fees; stock,
  cash on hand (with a minimum cash balance check), up to 3 debt tranches, new equity. An
  optional balancing item closes any gap; otherwise the gap is reported and results are marked
  invalid.
- **Standalone forecasts** for Years 1–5 (revenue and net income growth, EBITDA margin).
  Accretion is measured against the acquirer's standalone EPS for the same year.
- **Purchase price allocation:** intangibles (amount or % of excess price) and PP&E write-ups,
  deferred tax, goodwill (negative goodwill warns), straight-line amortization.
- **Debt schedule:** interest on opening balances, mandatory amortization, financing fees
  amortized over each term, optional cash sweep.
- **Synergies:** cost and revenue synergies with phase-ins, revenue probability haircut,
  dis-synergies, integration costs (must total 100%).
- **Results each year:** GAAP and cash EPS and accretion, breakeven synergies, credit metrics
  (debt/EBITDA, net debt/EBITDA, EBITDA/interest) with editable limits, value creation (PV of
  synergies plus terminal value vs premium paid).
- **Sensitivity grids:** any two of purchase price, premium, synergies, % stock, debt rate,
  % debt financing and open offer acceptance; GAAP or cash EPS; any year. One request per grid.
- **Excel export:** Inputs, Sources & Uses, PPA, Debt Schedule, Pro Forma EPS, Credit, Value
  Creation and Sensitivities tabs, with live formulas throughout except Sensitivities.
- **Currency:** USD ($M / $B) or INR (₹ crore / ₹ lakh crore); labels only, never the maths.
- **API:** `/calculate`, `/sensitivity` (with axes), `/export`, `/deals`. Both the original and
  the new input format are accepted.
- **Database:** additive only. The `deals` table gained `model_version` (default 1) and
  `currency` (default USD).

**Frontend:** inputs grouped into tabs (Deal terms, Financing, Forecasts, Accounting,
Synergies, Settings) with a Simple/Advanced switch and a currency setting. New panels: premium
and multiples, sources & uses, ownership, credit metrics, value creation, plus messages
(errors, warnings, notes). The tombstone, year strip (GAAP and cash, 5 years), EPS bridge
(now with amortization, refinancing and fee steps), synergy timeline and sensitivity grid are
updated. Adds an Excel download, true minus signs, and a layout that works at phone width.

### Backward compatibility

- **Simple mode** reproduces the original calculator exactly (regression tests 1–3).
- **Old saved deals** load in simple mode, with their 3-year schedules extended to 5 years
  (phase-ins keep their Year 3 level; integration costs are 0% after Year 3). They are
  recalculated on load.
- Running locally is unchanged (`uvicorn main:app --reload` in `backend`, `npm run dev` in
  `frontend`).

### Input convention: acquirer figures are as reported

Acquirer figures are entered as they appear in filings (and as Phase 2 will auto-fill them), so
they already include any stake held in the target before the deal:

- **20–50% owned (equity method):** reported net income already includes stake % × target net
  income. Standalone EPS uses it as-is; the deal credits only the additional stake.
- **Over 50% owned (already consolidated):** reported revenue, EBITDA, cash, debt and interest
  include 100% of the target, and net income is after minority interest. Buying more only
  reduces minority interest; nothing is added again in the credit metrics, and refinanced
  target debt is replaced, not added. It's an equity transaction, so there is no new PPA.
- **Below 20%:** a financial investment; nothing in the acquirer's figures comes from it.

### Simplifications (also listed in the README)

- Interest is charged on opening balances. The optional "average balance" method was skipped,
  as the plan allowed.
- The cash sweep uses pro forma cash net income × an FCF conversion %.
- A tranche still outstanding after its term is assumed to be refinanced on the same terms.
- Partial goodwill convention. Savings from refinancing target debt are not shared with
  minority holders.
- The equity method has no PPA; financial investments (below 20%) model no dividends or
  synergies.
- For a 20–50% existing stake, the part of reported net income that comes from the stake is
  taken as stake % × the target's forecast net income for that year.
- In sensitivity grids, each funding source keeps its share of the funding when a scenario needs
  more or less cash.
- The Excel Sensitivities tab holds fixed values (Python can't create Excel data tables).
- Switching an old simple-mode deal to Advanced asks for the offer price and target diluted
  shares, which old deals never stored.

### Tests

- **Backend: 98 pytest tests**, covering every case in section 6 of the plan plus a
  hand-checked test for each other calculation. They also recalculate the Excel formulas for six
  different deals and check they match the Python model. They need no internet or database
  (the API tests use an in-memory stand-in).
- **Frontend: 14 vitest tests** for number formatting, unit conversion and the form.
- `npm run build` and lint pass. The app was checked in the browser at desktop and 375px phone
  width, with no console errors.

Run them with `python -m pytest` in `backend` (after `pip install -r requirements-dev.txt`) and
`npm test` in `frontend`.

### Commits

| Commit | What |
|---|---|
| `878bf8c` | Add the IB upgrade plan |
| `4ba0a59` | Add pytest and regression tests for today's calculator |
| `e7cc040` | Add the model v2 finance engine with tests |
| `816f599` | Serve model v2 from the API and store deal version and currency |
| `539f59d` | Add Excel export with live formulas |
| `205804f` | Rebuild the frontend for model v2 |
| `2ac71ee` | Count an existing stake's income in standalone net income |
| `60386e6` | Treat acquirer inputs as reported figures |

### Before merging to `main`

- Test in the browser (checklist below).
- After the merge, check the first Render build log. `requirements.txt` was converted from
  UTF‑16 to UTF‑8, and the first start adds the two new columns to the Neon database.

**Browser checklist**

1. Simple example: Years 1–3 show $1.94 / −3.0%, $2.17 / +8.7%, $2.37 / +18.3%.
2. Load an old saved deal: same numbers as before the upgrade.
3. Advanced: premium and offer price update each other; sources & uses balance; removing the
   balancing item shows a red gap message.
4. Stake: 25% bought + a 26% open offer at 50% acceptance switches to the equity method, with a
   note.
5. Existing stake: 25% already owned, with reported net income $105M, gives standalone EPS $2.10.
6. INR: EPS unchanged, amounts in ₹ crore.
7. Sensitivity: every "Compare" option, GAAP vs cash, each year.
8. Download Excel: change an input on the Inputs tab and check that the other tabs update.
9. Phone width: no sideways scrolling.

## Phase 2: automatic company data

### What was built

**Backend** (`backend/companydata/`):

- `sec.py`: SEC requests with the `SEC_USER_AGENT` contact, at most 5 a second; ticker → CIK.
- `xbrl.py`: reads the SEC's company facts. For each company: revenue, EBITDA (operating income +
  D&A), net income, interest expense, effective tax rate and diluted shares, for the last twelve
  months (FY + year to date − prior year to date) or the latest fiscal year; cash, total debt and
  book equity from the latest balance sheet; shares outstanding from the cover page with its
  "as of" date; 3-year historical growth. Each field tries an ordered list of XBRL tags and
  records the tag, period, filing and link it used.
- `checks.py`: warnings for missing items, stale filings, negative EBITDA, likely one-time or
  non-operating items, odd tax rates, banks/insurers/REITs, several share classes and share
  counts that don't agree.
- `prices.py`: Tiingo, only when `TIINGO_API_KEY` is set (local use only); otherwise prices stay
  manual. Unaffected price = last close before the announcement date, adjusted for later splits.
- `service.py`: caches each company for a day and prices per day, in a new `data_cache` table
  (additive). A database problem never stops a lookup.
- New endpoints: `GET /company/{ticker}`, `GET /price/{ticker}?announced=YYYY-MM-DD`,
  `GET /company-data/status`. Deals can store `data_sources`, which the maths ignores.

**Frontend:** a "Fill from SEC filings" box above the form (tickers, announcement date, last
twelve months or latest fiscal year). Filled fields get a tag (Auto · verify, Checked, Manual,
Not in filings, You fill this) that opens the source: company, filing, period, filing date, XBRL
tag and a link. Tabs with fields to look at get a dot. Each company's warnings, historical growth
and effective tax rate are shown, and growth and tax rate are only used when you click "use".
Sources are saved with deals.

### Decisions

- **Target shares:** cover-page shares outstanding (`dei:EntityCommonStockSharesOutstanding`),
  falling back to the weighted average diluted count. Always "verify"; options and other dilution
  are not included. **Buyer shares:** weighted average diluted, which is what reported EPS uses.
- **Both share prices** are the last close before the announcement date (default today), so the
  exchange ratio uses pre-announcement prices. The latest close is shown in the source details.
- **Prices:** Tiingo, local only (its free plan is internal use only). Stooq now blocks
  automated downloads; Yahoo's terms don't allow this use.
- One `data_cache` table for both SEC data and prices, instead of the two tables in the plan.
- Missing figures are cleared (the field turns red), not left at old values.

### Found by testing real companies

- The SEC adds a filing's numbers a little after the filing appears (Coca-Cola's latest 10-Q),
  so only filings with numbers already available are used.
- Disney's 10-K tags interest expense as negative, its 10-Qs as positive. Items that can't be
  negative now skip such a tag and try the next; otherwise they're missing, with the reason.
- Berkshire and Alphabet have several share classes; the cover-page count may cover only one.
  These now get a warning.
- Apple and JPMorgan don't tag interest expense in a usable way: shown as "Not in filings".

### Simplifications

- US GAAP filers reporting in USD only (no 20-F/40-F, IFRS or non-USD filers).
- The balance sheet is always the latest one, whichever income basis is chosen.
- Total debt excludes operating leases; for banks, debt and EBITDA aren't meaningful (warned).
- The "one-time items" warning is a rule of thumb: net income more than 35% away from
  (operating income − interest) × (1 − 21%).
- Switching between TTM and fiscal year refills the company fields, replacing edits to them.
- Company data is USD, so lookup is off while the currency is INR.

### Tests

- **Backend: 148 pytest tests** (98 from Phase 1 + 50 new). Test case 9 uses saved, trimmed
  SEC data for Apple, Coca-Cola and Microsoft and checks each field's value, tag, period and
  filing, including the TTM arithmetic, fallback tags and the filing lag. Made-up files cover the
  edge cases and every warning; fake SEC and price sources cover the cache and the API.
- **Frontend: 26 vitest tests** (14 + 12 new) for filling the form, field status and saving.
- `npm run build` and lint pass. Checked in the browser against the live SEC (MSFT buying KO),
  including at 375px phone width, with no console errors.

### Commits

| Commit | What |
|---|---|
| `a2f7809` | Add SEC EDGAR company lookup and a price adapter |
| `a1ccacd` | Distrust negative expenses and flag multiple share classes |
| `0f5a82e` | Add "Fill from SEC filings" to the frontend |

### Before merging to `main`

- On Render, add the setting `SEC_USER_AGENT` = `Merger Synergy Calculator kodothsamik@gmail.com`.
  Do **not** add `TIINGO_API_KEY` there.
- `requirements.txt` now includes `httpx` (and its dependencies `httpcore` and `certifi`).
- The first start creates the `data_cache` table in Neon.

**Browser checklist**

1. Type `MSFT` and `KO`, click Fetch: both cards appear; the Deal terms, Financing, Forecasts,
   Accounting and Synergies tabs get a dot; buyer EPS is about $17.95.
2. Click a field's "Auto · verify" tag: the source shows the filing, period, tag and a working
   "View filing" link. "Mark as checked" turns it to "✓ Checked".
3. Edit an auto-filled field: its tag becomes "Manual" and shows what the filing said.
4. Try `AAPL` as the buyer: interest expense is "Not in filings" and blank (red) until you fill it.
5. Try `TSM` (foreign filer) and `ZZZZ`: clear error messages, nothing filled.
6. Try `BRK.B`: share-class and bank/insurer warnings.
7. Switch "Figures" to "Latest fiscal year": the numbers change to the fiscal year.
8. "Use as forecast" and "Use for the deal" fill growth and the tax rate; nothing else does.
9. Save the deal, reload the page, load it: the tags come back.
10. Without `TIINGO_API_KEY`: the note "Automatic prices available in local use only", and
    share prices marked "You fill this". With the key (optional): prices fill in.
11. Phone width: no sideways scrolling.

## Phase 3: next

Not started.
