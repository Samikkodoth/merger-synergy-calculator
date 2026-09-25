"use client";

import { useEffect, useState } from "react";
import SelectField from "@/components/SelectField";
import { getCompany, getDataStatus, getPrices } from "@/lib/api";
import {
  COMPANY_FIELDS, PRICE_PATHS, applyGrowth, applyTaxRate, companyLabel, confirmAll, countByStatus,
  fillFromCompany, fillPrice, isTicker, markNeedsInput, type Role,
} from "@/lib/companyData";
import { switchMode, type FormState } from "@/lib/dealForm";
import { formatChangePct, formatEps, formatPct } from "@/lib/format";
import type { Basis, CompanyIssue, CompanyProfile, DataStatus, Lookup, PriceLookup } from "@/lib/types";

type Result = {
  ticker: string;
  profile?: CompanyProfile;
  error?: string;
  price?: PriceLookup;
  priceError?: string;
};

type CompanyLookupProps = {
  form: FormState;
  onApply: (update: (state: FormState) => FormState) => void;
};

const ROLES: { role: Role; label: string }[] = [
  { role: "acquirer", label: "Buyer ticker" },
  { role: "target", label: "Target ticker" },
];

const inputClass =
  "mt-1.5 w-full min-w-0 rounded-md border border-rule bg-white px-3 py-2 text-body text-ink uppercase outline-none focus:border-ink focus:ring-2 focus:ring-ink/15";

function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

function Warnings({ issues }: { issues: CompanyIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1.5">
      {issues.map((issue, index) => (
        <li
          key={`${issue.code}-${index}`}
          className={`rounded border px-2 py-1.5 text-caption ${
            issue.level === "warning" ? "border-brass/50 bg-brass/10 text-ink" : "border-rule bg-white text-ink-soft"
          }`}
        >
          <span className="font-semibold">{issue.level === "warning" ? "Check: " : "Note: "}</span>
          {issue.message}
        </li>
      ))}
    </ul>
  );
}

function PriceLine({ result }: { result: Result }) {
  if (result.priceError) return <p className="text-caption text-loss">Price: {result.priceError}</p>;
  const price = result.price;
  if (!price) return null;
  if (!price.available) return null; // Shown once for both companies, below
  if (!price.unaffected) {
    return <p className="text-caption text-ink-soft">Price: {price.unaffected_message}</p>;
  }
  return (
    <p className="text-caption text-ink-soft">
      Price: <span className="text-ink tabular-nums">{formatEps(price.unaffected.price)}</span>, {price.source} close
      on {price.unaffected.date}
      {price.unaffected.note && <> ({price.unaffected.note})</>}
    </p>
  );
}

function CompanyCard({ role, result, basis, onApply }: {
  role: Role;
  result: Result;
  basis: Basis;
  onApply: CompanyLookupProps["onApply"];
}) {
  const { profile } = result;
  if (!profile) {
    return (
      <div role="alert" className="rounded-md border border-loss/30 bg-loss/5 p-3 text-body text-loss">
        <span className="font-semibold">{result.ticker.toUpperCase()}: </span>
        {result.error}
      </div>
    );
  }
  const mappings = COMPANY_FIELDS[role];
  const found = mappings.filter((m) => m.fields.some((name) => profile.fields[name]?.[basis]?.value != null)).length;
  const issues = profile.warnings.filter((issue) => issue.basis === null || issue.basis === basis);
  const { revenue, net_income: income } = profile.growth;
  const hasGrowth = revenue.value !== null || income.value !== null;
  const taxRate = profile.fields.tax_rate?.[basis]?.value;

  return (
    <div className="rounded-md border border-rule bg-white p-3">
      <p className="text-body font-semibold text-ink">{companyLabel(profile)}</p>
      <p className="text-caption text-ink-soft">
        {role === "acquirer" ? "Buyer" : "Target"}
        {profile.industry && <> · {profile.industry}</>} · {profile.bases[basis]}
      </p>
      <p className="mt-1 text-caption text-ink-soft">
        {found} of {mappings.length} figures filled
        {found < mappings.length && <>; the rest weren&apos;t in the filings</>}.
      </p>
      <PriceLine result={result} />
      <Warnings issues={issues} />

      {(hasGrowth || (role === "acquirer" && taxRate != null)) && (
        <div className="mt-3 space-y-2 border-t border-rule pt-2">
          {hasGrowth && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-caption text-ink-soft">
                Historical {revenue.years ?? income.years ?? 3}-yr growth, not a forecast: revenue{" "}
                <span className="text-ink tabular-nums">{formatChangePct(revenue.value)}</span>, net income{" "}
                <span className="text-ink tabular-nums">{formatChangePct(income.value)}</span> a year
              </p>
              <button
                type="button"
                onClick={() => onApply((state) => applyGrowth(state, role, profile))}
                className="cursor-pointer rounded border border-rule px-2 py-0.5 text-caption font-semibold text-ink hover:bg-paper"
              >
                Use as forecast
              </button>
            </div>
          )}
          {role === "acquirer" && taxRate != null && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-caption text-ink-soft">
                Effective tax rate: <span className="text-ink tabular-nums">{formatPct(taxRate)}</span>
              </p>
              <button
                type="button"
                onClick={() => onApply((state) => applyTaxRate(state, profile, basis))}
                className="cursor-pointer rounded border border-rule px-2 py-0.5 text-caption font-semibold text-ink hover:bg-paper"
              >
                Use for the deal
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Fill the form from SEC filings (and share prices, where available). */
export default function CompanyLookup({ form, onApply }: CompanyLookupProps) {
  const [status, setStatus] = useState<DataStatus | null>(null);
  const [results, setResults] = useState<Partial<Record<Role, Result>>>({});
  const [isFetching, setIsFetching] = useState(false);
  const { lookup } = form;

  useEffect(() => {
    getDataStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  function setLookup(changes: Partial<Lookup>) {
    onApply((state) => ({ ...state, lookup: { ...state.lookup, ...changes } }));
  }

  const tickers = ROLES.map(({ role }) => lookup[role].trim()).filter(Boolean);
  const badTicker = tickers.find((ticker) => !isTicker(ticker));
  const isInr = form.currency !== "USD";
  const secOff = status !== null && !status.sec;
  const canFetch = tickers.length > 0 && !badTicker && !isInr && !secOff && !isFetching;

  async function handleFetch() {
    const announced = lookup.announced || today();
    if (!lookup.announced) setLookup({ announced });
    setIsFetching(true);
    const fetched: Partial<Record<Role, Result>> = {};
    await Promise.all(ROLES.map(async ({ role }) => {
      const ticker = lookup[role].trim();
      if (!ticker) return;
      const [company, price] = await Promise.allSettled([getCompany(ticker), getPrices(ticker, announced)]);
      fetched[role] = {
        ticker,
        profile: company.status === "fulfilled" ? company.value : undefined,
        error: company.status === "rejected" ? errorMessage(company.reason) : undefined,
        price: price.status === "fulfilled" ? price.value : undefined,
        priceError: price.status === "rejected" ? errorMessage(price.reason) : undefined,
      };
    }));
    setResults(fetched);
    setIsFetching(false);
    onApply((state) => fillAll(state, fetched, lookup.basis));
  }

  function changeBasis(basis: Basis) {
    setLookup({ basis });
    // Refill from what was already fetched; no new requests
    if (Object.keys(results).length > 0) onApply((state) => fillAll(state, results, basis));
  }

  const counts = countByStatus(form.sources);
  // "Automatic prices available in local use only", from the server's status or a lookup
  const unavailable = Object.values(results).map((r) => r?.price).find((p) => p && !p.available);
  const priceNote = status?.prices_message ?? (unavailable && !unavailable.available ? unavailable.message : null);

  return (
    <details open className="group rounded-lg border border-rule bg-paper/60">
      <summary className="cursor-pointer px-4 py-3 text-heading font-semibold text-ink">
        Fill from SEC filings
      </summary>
      <div className="space-y-4 border-t border-rule px-4 pt-3 pb-4">
        <p className="text-caption text-ink-soft">
          Type tickers to fill in each company&apos;s financials from its latest 10-K and 10-Q. US SEC filers only:
          Indian, other non-US and private companies need manual entry.
        </p>

        <div className="grid grid-cols-2 gap-4">
          {ROLES.map(({ role, label }) => (
            <div key={role} className="min-w-0">
              <label htmlFor={`ticker-${role}`} className="block text-body text-ink-soft">
                {label}
              </label>
              <input
                id={`ticker-${role}`}
                type="text"
                value={lookup[role]}
                maxLength={12}
                autoCapitalize="characters"
                spellCheck={false}
                placeholder={role === "acquirer" ? "e.g. MSFT" : "e.g. KO"}
                onChange={(event) => setLookup({ [role]: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && canFetch) handleFetch();
                }}
                className={inputClass}
              />
            </div>
          ))}
          <div className="min-w-0">
            <label htmlFor="announced" className="block text-body text-ink-soft">
              Announcement date
            </label>
            <input
              id="announced"
              type="date"
              value={lookup.announced}
              max={today()}
              onChange={(event) => setLookup({ announced: event.target.value })}
              aria-describedby="announced-hint"
              className={`${inputClass} normal-case`}
            />
            <p id="announced-hint" className="mt-1 text-caption text-ink-soft">
              Blank = today. Prices are the last close before it.
            </p>
          </div>
          <SelectField
            id="basis"
            label="Figures"
            value={lookup.basis}
            onChange={(value) => changeBasis(value as Basis)}
            options={[
              { value: "ttm", label: "Last twelve months" },
              { value: "fy", label: "Latest fiscal year" },
            ]}
            hint="Balance sheet: always the latest"
          />
        </div>

        {badTicker && <p className="text-caption text-loss">&ldquo;{badTicker}&rdquo; doesn&apos;t look like a ticker.</p>}
        {isInr && (
          <p className="text-caption text-ink-soft">SEC figures are in USD. Switch the currency to USD to use them.</p>
        )}
        {secOff && (
          <p className="text-caption text-loss">
            Company lookup isn&apos;t set up on this server (the SEC_USER_AGENT setting is missing).
          </p>
        )}

        <button
          type="button"
          onClick={handleFetch}
          disabled={!canFetch}
          className="w-full cursor-pointer rounded-md bg-ink px-4 py-2 text-body font-semibold text-white hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isFetching ? "Fetching from the SEC…" : "Fetch company data"}
        </button>
        {isFetching && (
          <p role="status" className="text-caption text-ink-soft">
            After a quiet period the server needs to wake up, so this can take up to a minute.
          </p>
        )}

        {priceNote && <p className="text-caption text-ink-soft">{priceNote}</p>}

        {ROLES.map(({ role }) => {
          const result = results[role];
          return result ? (
            <CompanyCard key={role} role={role} result={result} basis={lookup.basis} onApply={onApply} />
          ) : null;
        })}

        {counts.auto + counts.todo + counts.missing > 0 && (
          <div className="space-y-2 rounded-md border border-rule bg-white p-3 text-caption text-ink-soft">
            <p>
              <span className="font-semibold text-ink">{counts.auto}</span> auto-filled to verify ·{" "}
              <span className="font-semibold text-ink">{counts.missing}</span> not in filings ·{" "}
              <span className="font-semibold text-ink">{counts.todo}</span> for you to fill. Tabs with a dot have
              fields to look at. Tap a field&apos;s tag to see its source.
            </p>
            {counts.auto > 0 && (
              <button
                type="button"
                onClick={() => onApply(confirmAll)}
                className="cursor-pointer rounded border border-ink px-2 py-0.5 font-semibold text-ink hover:bg-paper"
              >
                Mark all {counts.auto} auto-filled as checked
              </button>
            )}
          </div>
        )}
      </div>
    </details>
  );
}

function fillAll(state: FormState, results: Partial<Record<Role, Result>>, basis: Basis): FormState {
  // Most filled fields (target shares, unaffected price, debt…) only show in Advanced
  let next = state.mode === "simple" ? switchMode(state, "advanced") : state;
  for (const { role } of ROLES) {
    const result = results[role];
    if (!result) continue;
    if (result.profile) next = fillFromCompany(next, role, result.profile, basis);
    if (result.price) next = fillPrice(next, role, result.price, result.ticker);
    else if (result.priceError) {
      next = { ...next, sources: { ...next.sources, [PRICE_PATHS[role]]: { status: "todo", reason: result.priceError } } };
    }
  }
  return markNeedsInput(next);
}
