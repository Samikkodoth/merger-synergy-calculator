export function formatMillions(amount: number): string {
  return `$${(amount / 1_000_000).toFixed(2)}M`;
}

export function formatEps(eps: number): string {
  return `$${eps.toFixed(2)}`;
}

export function formatPercent(pct: number): string {
  const sign = pct >= 0 ? "+" : "−";
  return `${sign}${Math.abs(pct).toFixed(1)}%`;
}

export function formatShares(shares: number): string {
  return Math.round(shares).toLocaleString("en-US");
}

export function formatMillionsCompact(amount: number): string {
  const millions = Number((amount / 1_000_000).toFixed(1));
  return `$${millions.toLocaleString("en-US")}M`;
}