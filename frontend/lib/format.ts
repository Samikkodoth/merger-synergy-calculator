export function formatMillions(amount: number): string {
  return `$${(amount / 1_000_000).toFixed(2)}M`;
}

export function formatEps(eps: number): string {
  return `$${eps.toFixed(2)}`;
}

export function formatPercent(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function formatShares(shares: number): string {
  return Math.round(shares).toLocaleString("en-US");
}