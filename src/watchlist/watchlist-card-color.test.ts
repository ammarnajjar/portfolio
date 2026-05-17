import { describe, it, expect } from "vitest";
import { cardColor } from "./watchlist-card-color";
import type { WatchlistItem } from "./watchlist-types";

const makeItem = (overrides: Partial<WatchlistItem> = {}): WatchlistItem => ({
  id: "x",
  input: "AAPL",
  symbol: "AAPL",
  name: "Apple",
  currentPrice: 100,
  currency: "USD",
  fundamentals: null,
  metrics: [],
  isLoading: false,
  error: null,
  lastUpdated: null,
  ...overrides,
});

describe("cardColor", () => {
  it("returns neutral when isLoading", () => {
    expect(cardColor(makeItem({ isLoading: true }))).toBe("neutral");
  });

  it("returns neutral when error is set", () => {
    expect(cardColor(makeItem({ error: "oops" }))).toBe("neutral");
  });

  it("returns neutral when metrics is empty", () => {
    expect(cardColor(makeItem({ metrics: [] }))).toBe("neutral");
  });

  it("returns red when any metric is red", () => {
    const item = makeItem({
      metrics: [
        { key: "pe", label: "P/E", value: 100, displayValue: "100", verdict: "red", note: "" },
        { key: "peg", label: "PEG", value: 1, displayValue: "1", verdict: "good", note: "" },
      ],
    });
    expect(cardColor(item)).toBe("red");
  });

  it("red takes priority over caution", () => {
    const item = makeItem({
      metrics: [
        { key: "pe", label: "P/E", value: 100, displayValue: "100", verdict: "red", note: "" },
        { key: "peg", label: "PEG", value: 1.5, displayValue: "1.5", verdict: "caution", note: "" },
      ],
    });
    expect(cardColor(item)).toBe("red");
  });

  it("returns amber when caution exists and no red", () => {
    const item = makeItem({
      metrics: [
        { key: "pe", label: "P/E", value: 30, displayValue: "30", verdict: "caution", note: "" },
        { key: "peg", label: "PEG", value: 0.8, displayValue: "0.8", verdict: "good", note: "" },
      ],
    });
    expect(cardColor(item)).toBe("amber");
  });

  it("returns green when all are good or na", () => {
    const item = makeItem({
      metrics: [
        { key: "pe", label: "P/E", value: 15, displayValue: "15", verdict: "good", note: "" },
        { key: "peg", label: "PEG", value: null, displayValue: "N/A", verdict: "na", note: "" },
      ],
    });
    expect(cardColor(item)).toBe("green");
  });
});
