// src/watchlist/watchlist-metrics.test.ts
import { describe, it, expect } from "vitest";
import { scoreMetrics } from "./watchlist-metrics";
import type { FundamentalsData } from "./watchlist-types";

const empty: FundamentalsData = {
  trailingPE: null,
  forwardPE: null,
  pegRatio: null,
  priceToBook: null,
  enterpriseToEbitda: null,
  profitMargins: null,
  operatingMargins: null,
  grossMargins: null,
  revenueGrowth: null,
  earningsGrowth: null,
  returnOnEquity: null,
  freeCashflow: null,
  totalRevenue: null,
  debtToEquity: null,
  currentRatio: null,
  payoutRatio: null,
  sharesOutstanding: null,
  floatShares: null,
};

describe("scoreMetrics", () => {
  it("returns one MetricResult per supported metric", () => {
    const results = scoreMetrics(empty);
    expect(results.length).toBeGreaterThan(0);
    results.forEach(r => {
      expect(r).toHaveProperty("key");
      expect(r).toHaveProperty("label");
      expect(r).toHaveProperty("verdict");
      expect(["good", "caution", "red", "na"]).toContain(r.verdict);
    });
  });

  it("scores P/E: <25 = good, 25–40 = caution, >40 = red", () => {
    const good = scoreMetrics({ ...empty, trailingPE: 20 });
    expect(good.find(r => r.key === "pe")?.verdict).toBe("good");

    const caution = scoreMetrics({ ...empty, trailingPE: 32 });
    expect(caution.find(r => r.key === "pe")?.verdict).toBe("caution");

    const red = scoreMetrics({ ...empty, trailingPE: 50 });
    expect(red.find(r => r.key === "pe")?.verdict).toBe("red");

    const na = scoreMetrics({ ...empty, trailingPE: null });
    expect(na.find(r => r.key === "pe")?.verdict).toBe("na");
  });

  it("scores PEG: <1 = good, 1–2 = caution, >2 = red", () => {
    expect(
      scoreMetrics({ ...empty, pegRatio: 0.8 }).find(r => r.key === "peg")
        ?.verdict,
    ).toBe("good");
    expect(
      scoreMetrics({ ...empty, pegRatio: 1.3 }).find(r => r.key === "peg")
        ?.verdict,
    ).toBe("caution");
    expect(
      scoreMetrics({ ...empty, pegRatio: 2.5 }).find(r => r.key === "peg")
        ?.verdict,
    ).toBe("red");
  });

  it("scores EV/EBITDA: <12 = good, 12–18 = caution, >18 = red", () => {
    expect(
      scoreMetrics({ ...empty, enterpriseToEbitda: 10 }).find(
        r => r.key === "evEbitda",
      )?.verdict,
    ).toBe("good");
    expect(
      scoreMetrics({ ...empty, enterpriseToEbitda: 14 }).find(
        r => r.key === "evEbitda",
      )?.verdict,
    ).toBe("caution");
    expect(
      scoreMetrics({ ...empty, enterpriseToEbitda: 22 }).find(
        r => r.key === "evEbitda",
      )?.verdict,
    ).toBe("red");
  });

  it("scores P/B: <1.5 = good, 1.5–3 = caution, >3 = red", () => {
    expect(
      scoreMetrics({ ...empty, priceToBook: 1.2 }).find(r => r.key === "pb")
        ?.verdict,
    ).toBe("good");
    expect(
      scoreMetrics({ ...empty, priceToBook: 2 }).find(r => r.key === "pb")
        ?.verdict,
    ).toBe("caution");
    expect(
      scoreMetrics({ ...empty, priceToBook: 4 }).find(r => r.key === "pb")
        ?.verdict,
    ).toBe("red");
  });

  it("scores Net Margin: >15% = good, 5–15% = caution, <5% = red (input is ratio)", () => {
    expect(
      scoreMetrics({ ...empty, profitMargins: 0.2 }).find(
        r => r.key === "netMargin",
      )?.verdict,
    ).toBe("good");
    expect(
      scoreMetrics({ ...empty, profitMargins: 0.08 }).find(
        r => r.key === "netMargin",
      )?.verdict,
    ).toBe("caution");
    expect(
      scoreMetrics({ ...empty, profitMargins: 0.03 }).find(
        r => r.key === "netMargin",
      )?.verdict,
    ).toBe("red");
  });

  it("scores Operating Margin: >20% = good, 8–20% = caution, <5% = red", () => {
    expect(
      scoreMetrics({ ...empty, operatingMargins: 0.25 }).find(
        r => r.key === "opMargin",
      )?.verdict,
    ).toBe("good");
    expect(
      scoreMetrics({ ...empty, operatingMargins: 0.12 }).find(
        r => r.key === "opMargin",
      )?.verdict,
    ).toBe("caution");
    expect(
      scoreMetrics({ ...empty, operatingMargins: 0.03 }).find(
        r => r.key === "opMargin",
      )?.verdict,
    ).toBe("red");
  });

  it("scores Gross Margin: >40% = good, 20–40% = caution, <20% = red", () => {
    expect(
      scoreMetrics({ ...empty, grossMargins: 0.6 }).find(
        r => r.key === "grossMargin",
      )?.verdict,
    ).toBe("good");
    expect(
      scoreMetrics({ ...empty, grossMargins: 0.3 }).find(
        r => r.key === "grossMargin",
      )?.verdict,
    ).toBe("caution");
    expect(
      scoreMetrics({ ...empty, grossMargins: 0.15 }).find(
        r => r.key === "grossMargin",
      )?.verdict,
    ).toBe("red");
  });

  it("scores ROE: >15% = good, 10–15% = caution, <10% = red", () => {
    expect(
      scoreMetrics({ ...empty, returnOnEquity: 0.2 }).find(r => r.key === "roe")
        ?.verdict,
    ).toBe("good");
    expect(
      scoreMetrics({ ...empty, returnOnEquity: 0.12 }).find(
        r => r.key === "roe",
      )?.verdict,
    ).toBe("caution");
    expect(
      scoreMetrics({ ...empty, returnOnEquity: 0.06 }).find(
        r => r.key === "roe",
      )?.verdict,
    ).toBe("red");
  });

  it("scores Revenue Growth: >10% = good, 0–10% = caution, <0% = red", () => {
    expect(
      scoreMetrics({ ...empty, revenueGrowth: 0.15 }).find(
        r => r.key === "revenueGrowth",
      )?.verdict,
    ).toBe("good");
    expect(
      scoreMetrics({ ...empty, revenueGrowth: 0.05 }).find(
        r => r.key === "revenueGrowth",
      )?.verdict,
    ).toBe("caution");
    expect(
      scoreMetrics({ ...empty, revenueGrowth: -0.02 }).find(
        r => r.key === "revenueGrowth",
      )?.verdict,
    ).toBe("red");
  });

  it("scores EPS Growth: >15% = good, 5–15% = caution, <0% = red", () => {
    expect(
      scoreMetrics({ ...empty, earningsGrowth: 0.2 }).find(
        r => r.key === "epsGrowth",
      )?.verdict,
    ).toBe("good");
    expect(
      scoreMetrics({ ...empty, earningsGrowth: 0.1 }).find(
        r => r.key === "epsGrowth",
      )?.verdict,
    ).toBe("caution");
    expect(
      scoreMetrics({ ...empty, earningsGrowth: -0.05 }).find(
        r => r.key === "epsGrowth",
      )?.verdict,
    ).toBe("red");
  });

  it("scores FCF Margin: >15% = good, 5–15% = caution, <5% = red", () => {
    const withFcf = {
      freeCashflow: 2_000_000_000,
      totalRevenue: 10_000_000_000,
    }; // 20%
    expect(
      scoreMetrics({ ...empty, ...withFcf }).find(r => r.key === "fcfMargin")
        ?.verdict,
    ).toBe("good");

    const caution = { freeCashflow: 800_000_000, totalRevenue: 10_000_000_000 }; // 8%
    expect(
      scoreMetrics({ ...empty, ...caution }).find(r => r.key === "fcfMargin")
        ?.verdict,
    ).toBe("caution");

    const red = { freeCashflow: 200_000_000, totalRevenue: 10_000_000_000 }; // 2%
    expect(
      scoreMetrics({ ...empty, ...red }).find(r => r.key === "fcfMargin")
        ?.verdict,
    ).toBe("red");

    // negative FCF = red
    const negFcf = { freeCashflow: -500_000_000, totalRevenue: 10_000_000_000 };
    expect(
      scoreMetrics({ ...empty, ...negFcf }).find(r => r.key === "fcfMargin")
        ?.verdict,
    ).toBe("red");
  });

  it("scores Debt/Equity: <1 = good, 1–2 = caution, >2 = red", () => {
    expect(
      scoreMetrics({ ...empty, debtToEquity: 0.5 }).find(r => r.key === "de")
        ?.verdict,
    ).toBe("good");
    expect(
      scoreMetrics({ ...empty, debtToEquity: 150 }).find(r => r.key === "de")
        ?.verdict,
    ).toBe("caution"); // Yahoo returns D/E * 100
    expect(
      scoreMetrics({ ...empty, debtToEquity: 250 }).find(r => r.key === "de")
        ?.verdict,
    ).toBe("red");
  });

  it("scores Current Ratio: >1.5 = good, 1–1.5 = caution, <1 = red", () => {
    expect(
      scoreMetrics({ ...empty, currentRatio: 2 }).find(
        r => r.key === "currentRatio",
      )?.verdict,
    ).toBe("good");
    expect(
      scoreMetrics({ ...empty, currentRatio: 1.2 }).find(
        r => r.key === "currentRatio",
      )?.verdict,
    ).toBe("caution");
    expect(
      scoreMetrics({ ...empty, currentRatio: 0.8 }).find(
        r => r.key === "currentRatio",
      )?.verdict,
    ).toBe("red");
  });

  it("scores Dividend Payout: 20–60% = good, 60–80% = caution, >90% = red", () => {
    expect(
      scoreMetrics({ ...empty, payoutRatio: 0.4 }).find(r => r.key === "payout")
        ?.verdict,
    ).toBe("good");
    expect(
      scoreMetrics({ ...empty, payoutRatio: 0.7 }).find(r => r.key === "payout")
        ?.verdict,
    ).toBe("caution");
    expect(
      scoreMetrics({ ...empty, payoutRatio: 0.95 }).find(
        r => r.key === "payout",
      )?.verdict,
    ).toBe("red");
    // null = pays no dividend, not a red flag
    expect(
      scoreMetrics({ ...empty, payoutRatio: null }).find(
        r => r.key === "payout",
      )?.verdict,
    ).toBe("na");
  });
});
