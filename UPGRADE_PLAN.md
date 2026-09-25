# Upgrade plan: Merger Synergy Calculator → IB-grade accretion/dilution tool

You are working on my existing project in this folder. Read this whole document before doing anything, then follow the working agreement in section 1.

---

## 0. Who I am and how to work with me

- I'm learning finance and I'm **not a developer**. You own all technical decisions. Explain what you're doing in plain language, briefly.
- When I need to do something myself (create an account, add an environment variable, click something on Render, Vercel, Neon, or GitHub), give me exact step-by-step instructions.
- **Everything must be free.** No paid APIs, no paid plans, nothing that asks for a credit card. If something in this plan can't be done for free, stop, tell me, and either propose a free alternative or skip it. Do **not** use the Claude/Anthropic API or any other paid AI service inside the app.

---

## 1. Working agreement

1. **Explore first, then plan.** Read the codebase, then give me a written plan for Phase 1 (which files you'll add or change, and any risks). Wait for my approval before writing code.
2. **Use a new git branch** (e.g. `ib-upgrade`). Don't touch `main` until I approve, because the live site deploys from `main`.
3. **Three phases, one at a time.** At the end of each phase, stop and give me:
   - a plain-language summary of what changed,
   - the results of the full test suite,
   - a checklist of what I should test in the browser,
   - anything you simplified, skipped, or couldn't do.
4. **Tests are mandatory.** All finance logic gets automated `pytest` tests, including every test case in section 6. All tests must pass before you say a phase is done. Tests must not depend on the internet (use saved sample data for anything that normally comes from an API).
5. **Don't break what works.** Existing saved deals must still load. Database changes must be additive (new columns or tables, with defaults). The app must still run locally the same way (`uvicorn main:app --reload` in `backend`, `npm run dev` in `frontend`).
6. **Secrets** go only in environment variables (`.env` locally, the hosting dashboard online). Never commit them.
7. **Stay within free hosting.** The backend is on Render's free plan (it sleeps when idle), the database on Neon's free plan (0.5 GB), and the frontend on Vercel Hobby. Don't add anything that needs a paid plan, an always-on worker, or a paid scheduler.
8. **Commit often**, with clear messages.

---

## 2. The current app (read the code to confirm)

**`backend/` (Python)**
- `calculator.py`: `calculate_deal(...)` takes acquirer net income, shares, and share price; target net income; purchase price; tax rate; payment mix (stock/cash/debt %); interest rates on cash and debt; cost synergies with a phase-in; revenue synergies with a margin and phase-in; integration costs with a yearly spread. It returns EPS before, new shares, financing costs, and per-year EPS and accretion %.
- `main.py`: FastAPI with `/calculate`, `/sensitivity` (5×5 grid: purchase price −20%…+20% × synergies +50%…−50%), and `/deals` (save, list, load, delete). CORS origins come from the `ALLOWED_ORIGINS` env var.
- `database.py`: psycopg, `deals` table (id, name, inputs JSONB, results JSONB, created_at). `DATABASE_URL` comes from the environment.

**`frontend/` (Next.js App Router + TypeScript + Tailwind v4 + Recharts)**
- Design system in `app/globals.css`: color tokens (ink, ink-soft, paper, rule, brass, gain, loss) and a **strict type scale** (`text-caption`, `text-body`, `text-heading`, `text-title`, `text-figure`, `text-display`). Two font weights only (400, 600). The serif font (Libre Caslon) is used **only** in the Tombstone component; everything else uses Public Sans.
- Components: `DealCalculator` (owns state, debounced live recalculation), `DealForm`, `NumberField`, `Tombstone`, `YearStrip`, `EpsBridge`, `SynergyTimeline`, `SensitivityTable`, `YearToggle`, `ResultsTable`, `SavedDealsList`, `ApiStatus`.
- `lib/`: `api.ts` (API URL from `NEXT_PUBLIC_API_URL`), `dealForm.ts` (field definitions and unit conversion), `format.ts`, `types.ts`, `bridge.ts`, `chartColors.ts`.

**UI rules for anything new**
- Reuse the existing tokens, type scale, and component patterns.
- Numbers are right-aligned with tabular figures.
- Negative numbers use a true minus sign (−) before the currency symbol, e.g. `−$2.76` and `−$3,500M`. Fix `formatEps`, `formatMillions`, and the chart axis formatters if they don't do this yet.
- Accretion is shown with ▲/▼ as well as color, never color alone.
- Everything must work at phone width.
- Large numbers should read well (e.g. `$110.0B` rather than `$110,000M` where sensible).

---

## 3. PHASE 1: Upgrade the finance model

### 3.0 Conventions
- The deal closes at the start of Year 1. Model Years 1–5.
- One tax rate applies to all pre-tax items unless stated otherwise.
- The backend works in raw amounts of one currency; the UI keeps friendly units ($M, %, etc.).
- **Currency and units setting:** USD ($M / $B) or INR (₹ crore / ₹ lakh crore). This only changes labels and display units, never the maths. Share prices are in the same currency (₹ or $). Saved deals remember their currency; old deals default to USD.
- **Simple mode:** with all new features off or zero, results must match today's model exactly (regression tests 1–3 in section 6). In simple mode the user enters a purchase price directly (as today), target debt is treated as assumed, growth is 0%, and there are no fees or purchase accounting.

### 3.1 Offer structure
Inputs: target unaffected share price (the last price before the deal was announced), offer price per share **or** premium % (either one computes the other), target diluted shares, target net debt (debt − cash), preferred stock and minority interest (default 0).

- Premium % = offer price ÷ unaffected price − 1
- Equity purchase price = offer price × target diluted shares
- Enterprise value (EV) = equity purchase price + net debt + preferred stock + minority interest
- Implied multiples: EV / Revenue, EV / EBITDA, offer price / target EPS (P/E)
- Premium paid in dollars = (offer price − unaffected price) × target diluted shares

Target debt treatment (user's choice):
- **Assumed:** the buyer takes on the debt. Its interest is already included in target net income, so nothing changes.
- **Refinanced:** the debt is repaid at close (it becomes a use of funds). Add back the target's after-tax interest expense to target net income; the replacement financing's interest is charged through the new debt.

The **equity purchase price** (not EV) is what gets paid for through the consideration and financing. This avoids double-counting interest on the target's existing debt.

### 3.2 Consideration and new equity
- The offer per share splits into a cash part and a stock part.
- Exchange ratio = stock part per target share ÷ acquirer share price
- Shares issued to target holders = exchange ratio × target diluted shares
- Separately, optional **new equity raised from investors**: an amount and an issue price (which can differ from the market price). Shares issued = amount ÷ issue price.
- Pro forma ownership % for: existing acquirer holders, former target holders, and new investors.

### 3.3 Sources & uses
- **Uses:** equity purchase price, target debt refinanced (if chosen), advisory fees (% of EV), financing fees (% of new debt).
- **Sources:** acquirer cash on hand (with a minimum cash balance the acquirer must keep), new debt in up to 3 tranches (amount, interest rate, term in years, mandatory amortization % per year), stock issued to target holders, and new equity raised.
- Sources must equal uses. If they don't, show a clear message with the size of the gap, and don't present the results as valid.

### 3.4 Standalone forecasts (Years 1–5)
For both acquirer and target: base-year revenue, EBITDA, net income, and diluted shares; revenue growth % and net income growth % (one rate for all years, or per year if the user expands it); EBITDA margin (defaults to the base-year margin). The acquirer also needs existing debt, cash, and annual interest expense. The target also needs interest expense (for the refinanced case) and book value of equity.

- Acquirer standalone EPS for each year = acquirer net income ÷ acquirer diluted shares
- **Accretion/dilution is measured against the acquirer's standalone forecast EPS for the same year**, not today's EPS.

### 3.5 Purchase price allocation (PPA)
Inputs: target book value of equity; identifiable intangibles write-up (as $ or as % of the excess purchase price) and its useful life; PP&E write-up and its useful life.

- Excess purchase price = equity purchase price − book value
- Deferred tax liability (DTL) = (intangibles write-up + PP&E write-up) × tax rate
- Goodwill = equity purchase price − (book value + write-ups − DTL)
- New annual amortization/depreciation = each write-up ÷ its useful life (straight line, only within the useful life). This reduces pro forma pre-tax income. Goodwill is **not** amortized.
- Show a warning if goodwill comes out negative.

### 3.6 Fees
- Advisory fees: one-time at close. Excluded from recurring EPS; shown separately as a one-time cost.
- Financing fees: amortized straight-line over each tranche's term, and included in pro forma interest expense.

### 3.7 Debt schedule
- Each tranche shows: beginning balance, mandatory amortization, optional cash sweep, ending balance, and interest.
- **Interest is charged on the beginning-of-year balance** by default (this avoids circular calculations). An "average balance" option is fine only if you solve it properly (iterate until it converges) and test it.
- Cash sweep: cash available for debt repayment = pro forma cash net income (see 3.9) × an FCF conversion % input (default 0% = off). Apply it after mandatory amortization, to tranches in order. Label this clearly in the UI as a simplification.
- Keep lost interest on acquirer cash used (as today).

### 3.8 Synergies (keep and extend)
- Keep cost and revenue synergies with 5-year phase-ins, the revenue profit margin, and integration costs with a 5-year spread (which must total 100%).
- Add a revenue synergy probability haircut % (default 100% = no haircut) and optional dis-synergies ($ per year, with a phase-in).

### 3.9 Pro forma results (each year)
- **GAAP net income** = acquirer standalone net income + target standalone net income (adjusted if debt is refinanced) + after-tax (cost synergies + revenue synergy profit × haircut − dis-synergies − integration costs) − after-tax new amortization/depreciation − after-tax new interest (including financing fee amortization) − after-tax lost interest on cash
- **Pro forma shares** = acquirer diluted shares + shares issued to target holders + new equity shares
- **GAAP EPS**, and accretion/dilution % vs. standalone EPS
- **Cash (adjusted) EPS** = (GAAP net income + after-tax new amortization/depreciation + after-tax integration costs) ÷ pro forma shares, and its accretion/dilution %
- **Breakeven synergies** = the pre-tax synergies needed for GAAP EPS to equal standalone EPS in that year. If none are needed, say so.
- **Credit metrics:** pro forma EBITDA = acquirer EBITDA + target EBITDA + cost synergies + revenue synergy profit − dis-synergies. Total debt = acquirer existing debt + target debt (if assumed) + new debt balance. Report total debt / EBITDA, net debt / EBITDA, and EBITDA / interest expense. Flag breaches of editable thresholds (defaults: total debt / EBITDA above 4.0x, interest coverage below 3.0x).
- **Value creation:** the present value (PV) of after-tax net synergies (synergies − dis-synergies − integration costs) for Years 1–5, plus a terminal value on the Year 5 run-rate: TV = after-tax run-rate × (1 + g) ÷ (r − g), discounted to today. Inputs: discount rate r and terminal growth g (require r > g). Compare with the premium paid in dollars. Value created = PV of synergies − premium paid.

### 3.10 Sensitivities
Make the sensitivity grid configurable:
- Axis pairs: premium % vs. synergies %; % stock consideration vs. premium %; debt interest rate vs. % debt financing. Keep today's purchase price vs. synergies grid as an option.
- Metric: GAAP or cash EPS accretion, for any year.
- Keep one backend request per grid (the server runs all the scenarios).

### 3.11 Excel export
- Download the full model as `.xlsx`, with tabs: Inputs, Sources & Uses, PPA, Debt Schedule, Pro Forma EPS, Credit, Value Creation, Sensitivities.
- **Prefer live Excel formulas** that reference the Inputs tab, so an analyst can audit the model and change assumptions in Excel. If some parts must be static values, tell me which.
- Clear labels, units, and number formats (negatives in parentheses is fine in Excel).

### 3.12 Partial acquisitions and mandatory open offers
Not every deal buys 100% of the target. This matters for US deals, and it's how most Indian listed-company takeovers work (SEBI's takeover regulations require a buyer that crosses 25% to make an open offer to public shareholders for at least another 26%, at a regulated minimum price).

Inputs:
- Stake already owned before the deal (default 0%).
- Stake bought from the seller(s) at the negotiated price (e.g. from the promoter), and the price paid for it.
- Open offer: % of shares offered for, offer price per share, and an **expected acceptance %** (default 100%). Show results for the chosen acceptance and let the sensitivity grid use acceptance % as an axis.
- Default stake bought = 100% (today's behaviour).

Calculations:
- Final stake % = existing stake + stake bought + open offer % × acceptance %.
- Cost of equity acquired = shares bought × price in each leg (negotiated leg + open offer leg). Only this is financed through sources & uses.
- Implied 100% equity value and implied EV use the offer price × all diluted shares, so premium and multiples stay comparable with full acquisitions.
- **Accounting treatment by stake** (user can override the default):
  - **Control (default when final stake > 50%): consolidate.** Include 100% of the target's revenue, EBITDA, debt, and synergies in the combined company, then deduct **minority interest** = (1 − final stake %) × target net income (including any synergies realized inside the target; input: % of synergies realized inside the target, default 0%). Credit metrics use 100% of target EBITDA and debt. Goodwill and write-ups are calculated on the controlling stake per the chosen convention; state clearly which convention you used (partial goodwill is simplest; full goodwill optional).
  - **Significant influence (default 20%–50%): equity method.** Add only final stake % × target net income to acquirer net income. Don't consolidate the target's revenue, EBITDA, or debt. No PPA amortization; state this simplification.
  - **Below 20%:** show a note that the holding is a financial investment and EPS effects are limited to dividends; don't model synergies.
- Pro forma ownership and EPS only change through shares actually issued.
- Show the final stake, treatment used, and minority interest clearly in the results.

### 3.13 UI
- The form is getting large: group the inputs into sections or tabs (e.g. Deal terms, Financing, Forecasts, Accounting, Synergies, Settings), with a simple mode that hides the advanced inputs.
- Keep the tombstone, year strip, EPS bridge, timeline, and sensitivity table, and update them for the new model:
  - Year strip: GAAP and cash EPS accretion, 5 years.
  - EPS bridge: add steps for new amortization, fees, and refinancing.
  - New panels: Sources & Uses, Credit metrics (with flags), Value creation, Pro forma ownership, and Premium & implied multiples.
- Old saved deals must still load (map them to simple mode).

---

## 4. PHASE 2: Automatic company data (free)

Goal: I type a ticker for the acquirer and the target, and the app fills in their financials and share prices.

**Scope: US SEC filers only.** Indian companies (NSE/BSE) are deliberately excluded from auto-fill: there's no official free API, and scraping the exchange websites is unreliable, which would risk wrong or missing numbers. Indian deals are modelled with manual entry in ₹ crore (Phase 1 supports this fully). Don't build NSE/BSE scrapers.

### 4.1 Financials from SEC EDGAR (free, no key needed)
- Use the SEC's free APIs: `https://www.sec.gov/files/company_tickers.json` (ticker → CIK), `https://data.sec.gov/submissions/CIK##########.json` (company info, SIC industry code, filings), and `https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json` (reported financials).
- Follow the SEC's rules: send a descriptive `User-Agent` that includes a contact email (read it from an env var such as `SEC_USER_AGENT`, and ask me for the email), stay well under 10 requests per second, and cache responses in the database (refresh each company at most once a day).
- Pull the latest fiscal year and trailing twelve months (TTM, built from quarterly filings) for: revenue, operating income, D&A (EBITDA = operating income + D&A), net income, diluted shares, total debt, cash, book equity, interest expense, and effective tax rate; plus the industry (SIC code → readable name).
- Companies use different XBRL tags for the same item. Use an ordered list of fallback tags for each item, and record which tag was used.
- Suggest (don't force) growth defaults from history, e.g. 3-year revenue and net income growth, clearly labelled "historical, not a forecast".

### 4.2 Share prices (free)
- Use a source that's free and needs no credit card. Prefer one with no key at all (for example, a free daily price download, if it's reliable and its terms allow this use); otherwise, a provider with a free tier and an API key stored in an env var. Tell me which you chose and why, and put it behind an adapter so it can be swapped later.
- Get the current price, and the **unaffected price** = the last close before a given announcement date (the user can edit the date).

### 4.3 Transparency (very important)
- Every auto-filled field shows its source: company, filing type, period, filing date, XBRL tag, and a link to the filing.
- Auto-filled fields are marked "auto, verify" until I confirm or edit them; edited fields are marked "manual".
- Show clearly when data is missing, out of date, or looks unusual (e.g. negative EBITDA or large one-time items). Never silently guess.
- Forecasts, synergies, integration costs, and PPA inputs stay manual (no free source exists). Highlight them as "you need to fill these".

---

## 5. PHASE 3: Free "recent deals" discovery (best effort)

Goal: see recently announced deals involving US public companies, and start modelling one with a click. **Free only, with no AI APIs.** If any part isn't reliably doable for free, tell me and simplify rather than paying or guessing. If this whole phase turns out not to be practical, say so and we'll skip it.

- Discover recent merger filings from EDGAR's free data (e.g. the daily filing index and/or full-text search), filtered to deal-related form types. Check which form types are current; candidates include tender offers (`SC TO-T`, `SC 14D9`), merger proxies (`PREM14A`, `DEFM14A`), registration statements for stock deals (`S-4`), deal communications (`425`), and `8-K` filings that mention a merger agreement.
- Use structured roles where filings provide them (e.g. in a tender offer, the filer is the bidder and the subject company is the target). Where the buyer and target roles aren't certain, show them as "needs confirmation".
- **Fetch on demand** when I open the "Recent deals" page, cache results in the database for about 12 hours, and add a refresh button. No always-on workers or paid schedulers.
- Deal terms (offer price per share, cash/stock mix): optionally show **candidate sentences** found by simple text search in the announcement (e.g. "$__ per share in cash"), with a link to the source, for me to confirm. Never accept them automatically.
- List view: announcement or filing date, target, buyer, industry, form type, link, and (once the terms are confirmed) deal value, premium %, EV/Revenue, EV/EBITDA, and P/E, computed using the Phase 2 data.
- "Model this deal" pre-fills the tickers, company data, and unaffected price (the day before the announcement), and highlights what I still need to fill in.
- State clearly in the UI that coverage is limited to SEC filers; private and non-US companies aren't covered.

---

## 6. Test cases (all must be automated)

### Regression (simple mode; must match today's app exactly)
1. Acquirer: net income $100M, 50M shares, share price $40. Target net income $20M. Purchase price $300M. Tax 25%. Cost synergies $15M, fully achieved, no other synergies or costs.
   - 100% stock → EPS $2.00 → **$2.28, +14.1%**
   - 100% debt at 7% → **+15.5%**
   - 50% stock / 50% debt at 7% → **+14.8%**
2. Multi-year: as above, but 50% stock / 50% debt at 7%, cash interest 4%, cost synergies $15M phased 50/75/100%, revenue synergies $40M at a 20% margin phased 0/50/100%, integration costs $30M spread 60/30/10%.
   - Year 1: **$1.94, −3.0%**; Year 2: **$2.17, +8.7%**; Year 3: **$2.37, +18.3%**
3. Sensitivity for case 2 (price −20%…+20%, synergies +50%…−50%, scaling cost and revenue synergies together):
   - Year 3: base **+18.3%**, worst (price +20%, synergies −50%) **≈ +7.3%**, best (price −20%, synergies +50%) **≈ +29.6%**
   - Year 1: best **≈ +2.5%**, base **−3.0%**, worst **≈ −8.4%**

### New features
4. **Offer structure:** unaffected price $20, offer $26 → premium **30.0%**. Diluted shares 10M → equity value **$260M**. Net debt $40M → EV **$300M**. Target EBITDA $30M → EV/EBITDA **10.0x**.
5. **Exchange ratio:** offer $26, 50% in stock, acquirer price $40 → stock per share **$13**, exchange ratio **0.325x**, new shares **3.25M**. The acquirer has 50M shares → target holders own **6.1%** (3.25 ÷ 53.25).
6. **PPA:** equity purchase price $260M, book value $100M, intangibles write-up $60M over 10 years, tax 25% → DTL **$15M**, goodwill **$115M**, amortization **$6M per year** pre-tax (**$4.5M** after tax).
7. **Value creation:** after-tax net synergies of $11.25M per year from Year 1 (100% phase-in, no integration costs), g = 0%, r = 10% → PV **$112.5M**. Premium paid ($26 − $20) × 10M = **$60M** → value created **$52.5M**.
8. **Sources & uses:** tests that uses always equal sources, and that an unbalanced setup produces the error message.
9. **Phase 2 parsing:** tests using saved sample EDGAR JSON for at least two real companies, checking that each field is taken from the expected tag and period.

10. **Partial acquisition (consolidation):** target diluted shares 10M, offer $26, final stake 60% bought in one leg → cost of equity acquired **$156M** (6M × $26); implied 100% equity value **$260M**. Target net income $20M, no synergies inside the target → minority interest **$8M**, net income attributable to acquirer from the target **$12M**. Credit metrics include **100%** of target EBITDA and debt.
11. **Open offer:** existing stake 0%, 25% bought from the promoter at $26, open offer for 26% at $26. Acceptance 100% → final stake **51%** (consolidate), shares bought **5.1M**, cost **$132.6M**. Acceptance 50% → final stake **38%** (equity method), shares bought **3.8M**, cost **$98.8M**, and the acquirer includes **$7.6M** (38% × $20M) of target net income, with no target revenue, EBITDA, or debt consolidated.
12. **Currency setting:** the same inputs in INR and USD give identical results; only the labels and units change.

For every new calculation beyond these, add at least one hand-checkable test, with the expected numbers explained in a comment.

---

## 7. Definition of done (each phase)

- All tests pass; show me the output.
- The app runs locally with no errors in the terminal or the browser console, and `npm run build` succeeds.
- The UI follows the design system and works at phone width.
- A short summary for me: what changed, how to test it, and what was simplified.
- The README is updated (what the app does, how to run it, data sources and their limits).
- Wait for my go-ahead before starting the next phase or merging into `main`.
