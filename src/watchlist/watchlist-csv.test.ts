import { describe, it, expect } from "vitest";
import { generateWatchlistCSV, parseWatchlistCSV } from "./watchlist-csv";

describe("generateWatchlistCSV", () => {
  it("produces header row + one data row", () => {
    const csv = generateWatchlistCSV([
      { symbol: "AAPL", name: "Apple Inc.", isin: "US0378331005" },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Symbol;Name;ISIN");
    expect(lines[1]).toBe('AAPL;"Apple Inc.";US0378331005');
  });

  it("quotes names that contain semicolons", () => {
    const csv = generateWatchlistCSV([
      { symbol: "X", name: "Foo;Bar", isin: "" },
    ]);
    expect(csv.split("\n")[1]).toBe('X;"Foo;Bar";');
  });

  it("escapes double-quotes in names", () => {
    const csv = generateWatchlistCSV([
      { symbol: "X", name: 'Say "Hi"', isin: "" },
    ]);
    expect(csv.split("\n")[1]).toBe('X;"Say ""Hi""";');
  });

  it("handles empty isin gracefully", () => {
    const csv = generateWatchlistCSV([
      { symbol: "MSFT", name: "Microsoft", isin: undefined },
    ]);
    expect(csv.split("\n")[1]).toBe('MSFT;"Microsoft";');
  });
});

describe("parseWatchlistCSV", () => {
  it("parses a standard CSV with header row", async () => {
    const file = new File(
      ['Symbol;Name;ISIN\nAAPL;"Apple Inc.";US0378331005\n'],
      "watchlist.csv",
      { type: "text/csv" },
    );
    const rows = await parseWatchlistCSV(file);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ symbol: "AAPL", name: "Apple Inc.", isin: "US0378331005" });
  });

  it("parses CSV without header (symbol-only rows)", async () => {
    const file = new File(["AAPL\nMSFT\n"], "watchlist.csv", { type: "text/csv" });
    const rows = await parseWatchlistCSV(file);
    expect(rows).toHaveLength(2);
    expect(rows[0].symbol).toBe("AAPL");
    expect(rows[1].symbol).toBe("MSFT");
  });

  it("skips blank lines", async () => {
    const file = new File(
      ['Symbol;Name;ISIN\nAAPL;"Apple";US123\n\nMSFT;"Microsoft";\n'],
      "watchlist.csv",
      { type: "text/csv" },
    );
    const rows = await parseWatchlistCSV(file);
    expect(rows).toHaveLength(2);
  });

  it("trims whitespace from symbol", async () => {
    const file = new File([" AAPL ; Apple ; \n"], "watchlist.csv", { type: "text/csv" });
    const rows = await parseWatchlistCSV(file);
    expect(rows[0].symbol).toBe("AAPL");
  });
});
