import type { Currency } from "@/lib/types";

// Negative numbers use a true minus sign (−), placed before the currency symbol.
const MINUS = "−";

export const CURRENCY = {
  USD: { symbol: "$", unit: 1_000_000, unitLabel: "M", sharesLabel: "M" },
  INR: { symbol: "₹", unit: 10_000_000, unitLabel: " crore", sharesLabel: " crore" },
} as const;

function sign(value: number): string {
  return value < 0 ? MINUS : "";
}

function grouped(value: number, decimals: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** A large amount: $300.0M, $3,500M, $110.0B; ₹30.0 crore, ₹3,500 crore, ₹1.2 lakh crore. */
export function formatMoney(amount: number, currency: Currency = "USD"): string {
  const abs = Math.abs(amount);
  const { symbol } = CURRENCY[currency];
  let text: string;
  if (currency === "INR") {
    if (abs >= 1e12) text = `${grouped(abs / 1e12, 2)} lakh crore`;
    else text = `${grouped(abs / 1e7, abs >= 1e10 ? 0 : 1)} crore`;
  } else if (abs >= 1e10) {
    text = `${grouped(abs / 1e9, 1)}B`;
  } else {
    text = `${grouped(abs / 1e6, abs >= 1e9 ? 0 : 1)}M`;
  }
  // Rounding to zero shouldn't show a minus sign
  const rounded = Number(text.replace(/[^0-9.]/g, "")) === 0;
  return `${rounded ? "" : sign(amount)}${symbol}${text}`;
}

/** Per-share amounts: $2.28, −$2.76, ₹41.50 */
export function formatEps(eps: number, currency: Currency = "USD"): string {
  const rounded = Number(eps.toFixed(2));
  return `${sign(rounded)}${CURRENCY[currency].symbol}${grouped(Math.abs(rounded), 2)}`;
}

/** A change per share, always signed: +$0.12, −$0.05 */
export function formatEpsChange(value: number, currency: Currency = "USD"): string {
  const rounded = Number(value.toFixed(2));
  return `${rounded < 0 ? MINUS : "+"}${CURRENCY[currency].symbol}${Math.abs(rounded).toFixed(2)}`;
}

/** A signed percentage from a fraction: 0.141 → +14.1%, −0.03 → −3.0% */
export function formatChangePct(fraction: number | null, decimals = 1): string {
  if (fraction === null) return "n/a";
  const rounded = Number((fraction * 100).toFixed(decimals));
  const prefix = rounded > 0 ? "+" : rounded < 0 ? MINUS : "";
  return `${prefix}${Math.abs(rounded).toFixed(decimals)}%`;
}

/** An unsigned-style percentage from a fraction: 0.3 → 30.0%, −0.05 → −5.0% */
export function formatPct(fraction: number | null, decimals = 1): string {
  if (fraction === null) return "n/a";
  const rounded = Number((fraction * 100).toFixed(decimals));
  return `${sign(rounded)}${Math.abs(rounded).toFixed(decimals)}%`;
}

export function formatMultiple(value: number | null): string {
  if (value === null) return "n/a";
  return `${sign(value)}${Math.abs(value).toFixed(1)}x`;
}

/** Share counts in millions (USD) or crore (INR): 53.25M, 5.33 crore */
export function formatShares(shares: number, currency: Currency = "USD"): string {
  const { unit, sharesLabel } = CURRENCY[currency];
  return `${sign(shares)}${grouped(Math.abs(shares) / unit, 2)}${sharesLabel}`;
}

/** Short axis labels for charts: $300M, −$15M, $1.2B, ₹30 cr */
export function formatAxisMoney(amount: number, currency: Currency = "USD"): string {
  const abs = Math.abs(amount);
  const { symbol } = CURRENCY[currency];
  let text: string;
  if (currency === "INR") text = abs >= 1e12 ? `${Number((abs / 1e12).toFixed(1))} L cr` : `${Number((abs / 1e7).toFixed(1))} cr`;
  else text = abs >= 1e9 ? `${Number((abs / 1e9).toFixed(1))}B` : `${Number((abs / 1e6).toFixed(1))}M`;
  return `${sign(amount)}${symbol}${text}`;
}

export function formatAxisEps(value: number, currency: Currency = "USD"): string {
  return formatEps(value, currency);
}
