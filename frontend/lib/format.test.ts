import { describe, expect, it } from "vitest";
import {
  formatAxisMoney, formatChangePct, formatEps, formatEpsChange, formatMoney, formatMultiple, formatPct, formatShares,
} from "@/lib/format";

describe("formatMoney", () => {
  it("uses millions, then billions for large amounts", () => {
    expect(formatMoney(300e6)).toBe("$300.0M");
    expect(formatMoney(3_500e6)).toBe("$3,500M");
    expect(formatMoney(110_000e6)).toBe("$110.0B");
  });

  it("puts a true minus sign before the currency symbol", () => {
    expect(formatMoney(-3_500e6)).toBe("−$3,500M");
    expect(formatMoney(-15e6)).toBe("−$15.0M");
  });

  it("doesn't show a minus sign on amounts that round to zero", () => {
    expect(formatMoney(-1)).toBe("$0.0M");
  });

  it("shows INR in crore and lakh crore", () => {
    expect(formatMoney(300e7, "INR")).toBe("₹300.0 crore");
    expect(formatMoney(3_500e7, "INR")).toBe("₹3,500 crore");
    expect(formatMoney(1.2e12, "INR")).toBe("₹1.20 lakh crore");
    expect(formatMoney(-15e7, "INR")).toBe("−₹15.0 crore");
  });
});

describe("per-share and percentages", () => {
  it("formats EPS with a true minus sign", () => {
    expect(formatEps(2.2826)).toBe("$2.28");
    expect(formatEps(-2.76)).toBe("−$2.76");
    expect(formatEps(41.5, "INR")).toBe("₹41.50");
    expect(formatEpsChange(-0.05)).toBe("−$0.05");
    expect(formatEpsChange(0.12)).toBe("+$0.12");
  });

  it("formats accretion from fractions", () => {
    expect(formatChangePct(0.1413)).toBe("+14.1%");
    expect(formatChangePct(-0.0302)).toBe("−3.0%");
    expect(formatChangePct(0)).toBe("0.0%");
    expect(formatChangePct(null)).toBe("n/a");
    expect(formatPct(0.3)).toBe("30.0%");
    expect(formatMultiple(10)).toBe("10.0x");
    expect(formatMultiple(null)).toBe("n/a");
  });

  it("formats shares and chart axes", () => {
    expect(formatShares(53.25e6)).toBe("53.25M");
    expect(formatShares(5.325e7, "INR")).toBe("5.33 crore");
    expect(formatAxisMoney(-15e6)).toBe("−$15M");
    expect(formatAxisMoney(1.2e9)).toBe("$1.2B");
    expect(formatAxisMoney(30e7, "INR")).toBe("₹30 cr");
  });
});
