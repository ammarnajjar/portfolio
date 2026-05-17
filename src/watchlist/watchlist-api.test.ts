// src/watchlist/watchlist-api.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchFundamentals } from "./watchlist-api";

const mockQuoteSummaryResponse = {
  quoteSummary: {
    result: [
      {
        defaultKeyStatistics: {
          trailingEps: { raw: 6.0 },
          forwardPE: { raw: 22.0 },
          pegRatio: { raw: 1.2 },
          priceToBook: { raw: 2.5 },
          enterpriseToEbitda: { raw: 15.0 },
          payoutRatio: { raw: 0.15 },
          sharesOutstanding: { raw: 15_000_000_000 },
          floatShares: { raw: 14_800_000_000 },
        },
        financialData: {
          currentPrice: { raw: 175.0 },
          targetMeanPrice: { raw: 200.0 },
          profitMargins: { raw: 0.25 },
          operatingMargins: { raw: 0.3 },
          grossMargins: { raw: 0.44 },
          revenueGrowth: { raw: 0.08 },
          earningsGrowth: { raw: 0.12 },
          returnOnEquity: { raw: 0.18 },
          freeCashflow: { raw: 90_000_000_000 },
          totalRevenue: { raw: 380_000_000_000 },
          debtToEquity: { raw: 150.0 },
          currentRatio: { raw: 1.3 },
          currency: "USD",
          financialCurrency: "USD",
        },
        price: {
          regularMarketPrice: { raw: 175.0 },
          currency: "USD",
          longName: "Apple Inc.",
          symbol: "AAPL",
        },
      },
    ],
    error: null,
  },
};

describe("fetchFundamentals", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("extracts fundamentals from quoteSummary response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockQuoteSummaryResponse,
    } as Response);

    const result = await fetchFundamentals("AAPL");

    expect(result.symbol).toBe("AAPL");
    expect(result.name).toBe("Apple Inc.");
    expect(result.currentPrice).toBe(175.0);
    expect(result.fundamentals.trailingPE).toBeCloseTo(29.17, 1); // 175 / 6.0
    expect(result.fundamentals.pegRatio).toBe(1.2);
    expect(result.fundamentals.priceToBook).toBe(2.5);
    expect(result.fundamentals.enterpriseToEbitda).toBe(15.0);
    expect(result.fundamentals.profitMargins).toBe(0.25);
    expect(result.fundamentals.operatingMargins).toBe(0.3);
    expect(result.fundamentals.grossMargins).toBe(0.44);
    expect(result.fundamentals.revenueGrowth).toBe(0.08);
    expect(result.fundamentals.earningsGrowth).toBe(0.12);
    expect(result.fundamentals.returnOnEquity).toBe(0.18);
    expect(result.fundamentals.freeCashflow).toBe(90_000_000_000);
    expect(result.fundamentals.totalRevenue).toBe(380_000_000_000);
    expect(result.fundamentals.debtToEquity).toBe(150.0);
    expect(result.fundamentals.currentRatio).toBe(1.3);
    expect(result.fundamentals.payoutRatio).toBe(0.15);
  });

  it("throws on HTTP error", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    await expect(fetchFundamentals("NOTEXIST")).rejects.toThrow(
      "HTTP error 404",
    );
  });

  it("throws on API-level error in response body", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        quoteSummary: { result: null, error: { description: "Not found" } },
      }),
    } as Response);

    await expect(fetchFundamentals("BADTICKER")).rejects.toThrow("Not found");
  });

  it("handles ISIN input by resolving symbol first", async () => {
    // First call: ISIN search, second call: quoteSummary
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          quotes: [{ symbol: "AAPL", quoteType: "EQUITY" }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockQuoteSummaryResponse,
      } as Response);

    const result = await fetchFundamentals("US0378331005");
    expect(result.symbol).toBe("AAPL");
  });
});
