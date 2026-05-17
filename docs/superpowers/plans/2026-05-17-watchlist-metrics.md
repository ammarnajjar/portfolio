# Watchlist Metrics Feature — Implementation Plan

claude --resume 2fdce389-5be6-436a-b437-762e629bdfb2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Watchlist tab where users add a ticker or ISIN, the app fetches fundamental metrics from Yahoo Finance, and displays each metric with a clear Good / Caution / Red Flag verdict against the thresholds defined in `docs/stock-metrics-reference.md`.

**Architecture:** A self-contained `watchlist` slice parallel to the existing `portfolio` slice — its own types, store context, localStorage key, and React subtree. The metrics are fetched from Yahoo Finance's `quoteSummary` endpoint (which returns fundamentals like P/E, margins, debt ratios) and scored client-side against hardcoded threshold rules. Display is a per-metric card with colour-coded status badge.

**Tech Stack:** React 19, TypeScript 5.9, Tailwind CSS 4, Vitest + React Testing Library, Yahoo Finance `v10/finance/quoteSummary` via `corsproxy.io`

---

## File Map

| Action | Path                                      | Responsibility                                                                          |
| ------ | ----------------------------------------- | --------------------------------------------------------------------------------------- |
| Create | `src/watchlist/watchlist-types.ts`        | `WatchlistItem`, `MetricResult`, `FundamentalsData` types                               |
| Create | `src/watchlist/watchlist-metrics.ts`      | Pure scoring functions: value → `'good' \| 'caution' \| 'red'`                          |
| Create | `src/watchlist/watchlist-api.ts`          | `fetchFundamentals(symbol)` — calls Yahoo `quoteSummary`, returns `FundamentalsData`    |
| Create | `src/watchlist/watchlist-store.tsx`       | React Context + Provider for watchlist state                                            |
| Create | `src/watchlist/watchlist-context.ts`      | `WatchlistContext` definition (mirrors pattern of `store-context.ts`)                   |
| Create | `src/watchlist/useWatchlist.ts`           | `useWatchlist()` hook (mirrors `useStore.ts`)                                           |
| Create | `src/watchlist/WatchlistView.tsx`         | Tab panel: input form + list of `WatchlistCard`                                         |
| Create | `src/watchlist/WatchlistCard.tsx`         | Single stock card: name, price, metrics table                                           |
| Create | `src/watchlist/MetricRow.tsx`             | One row: metric name, value, verdict badge, tooltip note                                |
| Modify | `src/components/Layout.tsx`               | Accept `activeTab` + `onTabChange` props; render nav buttons in sticky header           |
| Modify | `src/App.tsx`                             | Lift tab state here, pass to Layout; wrap with `WatchlistProvider`; render correct view |
| Create | `src/watchlist/watchlist-metrics.test.ts` | Unit tests for all scoring functions                                                    |
| Create | `src/watchlist/watchlist-api.test.ts`     | Unit tests for `fetchFundamentals` (mocked fetch)                                       |
| Create | `src/watchlist/WatchlistCard.test.tsx`    | Render tests for card + metric rows                                                     |
| Create | `src/watchlist/WatchlistView.test.tsx`    | Integration test: add symbol → card appears                                             |

---

## Task 1: Types

**Files:**

- Create: `src/watchlist/watchlist-types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/watchlist/watchlist-types.ts

export type MetricVerdict = "good" | "caution" | "red" | "na";

export interface MetricResult {
  key: string;
  label: string;
  value: number | null;
  displayValue: string;
  verdict: MetricVerdict;
  note: string;
}

// Raw values extracted from Yahoo Finance quoteSummary
export interface FundamentalsData {
  // Valuation
  trailingPE: number | null;
  forwardPE: number | null;
  pegRatio: number | null;
  priceToBook: number | null;
  enterpriseToEbitda: number | null;
  // Profitability
  profitMargins: number | null; // net margin (ratio, e.g. 0.21 = 21%)
  operatingMargins: number | null; // operating margin
  grossMargins: number | null; // gross margin
  // Growth
  revenueGrowth: number | null; // YoY revenue growth (ratio)
  earningsGrowth: number | null; // YoY earnings growth (ratio)
  // Returns
  returnOnEquity: number | null; // ROE (ratio)
  // Cash flow
  freeCashflow: number | null; // absolute FCF
  totalRevenue: number | null; // for FCF margin calc
  // Debt
  debtToEquity: number | null; // D/E ratio (already as ratio, e.g. 1.5)
  currentRatio: number | null;
  // Dividends
  payoutRatio: number | null; // dividend payout ratio (ratio)
  // Share count trend (used for dilution signal)
  sharesOutstanding: number | null;
  floatShares: number | null;
}

export interface WatchlistItem {
  id: string;
  input: string; // raw user input (symbol or ISIN)
  symbol: string; // resolved Yahoo symbol
  name: string;
  currentPrice: number | null;
  currency: string;
  fundamentals: FundamentalsData | null;
  metrics: MetricResult[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

export interface WatchlistState {
  items: WatchlistItem[];
  addItem: (input: string) => Promise<void>;
  removeItem: (id: string) => void;
  refreshItem: (id: string) => Promise<void>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/watchlist/watchlist-types.ts
git commit -m "feat(watchlist): add types for watchlist items, fundamentals, and metric results"
```

---

## Task 2: Scoring functions

**Files:**

- Create: `src/watchlist/watchlist-metrics.ts`
- Create: `src/watchlist/watchlist-metrics.test.ts`

The scoring functions are pure — they take a `FundamentalsData` object and return `MetricResult[]`. All thresholds come directly from `docs/stock-metrics-reference.md`.

- [ ] **Step 1: Write the failing tests**

```typescript
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/anajjar/code/portfolio && npm run test -- src/watchlist/watchlist-metrics.test.ts --run
```

Expected: FAIL — `Cannot find module './watchlist-metrics'`

- [ ] **Step 3: Implement the scoring functions**

```typescript
// src/watchlist/watchlist-metrics.ts
import type {
  FundamentalsData,
  MetricResult,
  MetricVerdict,
} from "./watchlist-types";

const fmt = (v: number | null, suffix = "", decimals = 1): string =>
  v === null ? "N/A" : `${(v * 100).toFixed(decimals)}${suffix}`;

const fmtRaw = (v: number | null, decimals = 2): string =>
  v === null ? "N/A" : v.toFixed(decimals);

const score = (
  key: string,
  label: string,
  value: number | null,
  displayValue: string,
  verdict: MetricVerdict,
  note: string,
): MetricResult => ({ key, label, value, displayValue, verdict, note });

const na = (key: string, label: string, note: string): MetricResult =>
  score(key, label, null, "N/A", "na", note);

export const scoreMetrics = (f: FundamentalsData): MetricResult[] => {
  const results: MetricResult[] = [];

  // --- P/E Ratio ---
  if (f.trailingPE === null) {
    results.push(na("pe", "P/E Ratio", "No trailing earnings data available"));
  } else {
    const v = f.trailingPE;
    const verdict: MetricVerdict =
      v <= 25 ? "good" : v <= 40 ? "caution" : "red";
    results.push(
      score(
        "pe",
        "P/E Ratio",
        v,
        fmtRaw(v),
        verdict,
        "Price vs earnings. Meaningful only relative to growth — pair with PEG.",
      ),
    );
  }

  // --- PEG Ratio ---
  if (f.pegRatio === null) {
    results.push(na("peg", "PEG Ratio", "PEG not reported"));
  } else {
    const v = f.pegRatio;
    const verdict: MetricVerdict = v < 1 ? "good" : v <= 2 ? "caution" : "red";
    results.push(
      score(
        "peg",
        "PEG Ratio",
        v,
        fmtRaw(v),
        verdict,
        "Growth-adjusted P/E. <1 = potentially undervalued for its growth rate.",
      ),
    );
  }

  // --- EV/EBITDA ---
  if (f.enterpriseToEbitda === null) {
    results.push(na("evEbitda", "EV/EBITDA", "Not reported"));
  } else {
    const v = f.enterpriseToEbitda;
    const verdict: MetricVerdict =
      v < 12 ? "good" : v <= 18 ? "caution" : "red";
    results.push(
      score(
        "evEbitda",
        "EV/EBITDA",
        v,
        fmtRaw(v),
        verdict,
        "Enterprise valuation. Most useful for mature, capital-heavy firms.",
      ),
    );
  }

  // --- P/B Ratio ---
  if (f.priceToBook === null) {
    results.push(na("pb", "P/B Ratio", "Not reported"));
  } else {
    const v = f.priceToBook;
    const verdict: MetricVerdict =
      v < 1.5 ? "good" : v <= 3 ? "caution" : "red";
    results.push(
      score(
        "pb",
        "P/B Ratio",
        v,
        fmtRaw(v),
        verdict,
        "Relevant for banks and asset-heavy firms. Less meaningful for software/platforms.",
      ),
    );
  }

  // --- Net Margin ---
  if (f.profitMargins === null) {
    results.push(na("netMargin", "Net Margin", "Not reported"));
  } else {
    const v = f.profitMargins;
    const verdict: MetricVerdict =
      v > 0.15 ? "good" : v >= 0.05 ? "caution" : "red";
    results.push(
      score(
        "netMargin",
        "Net Margin",
        v,
        fmt(v, "%"),
        verdict,
        "Final profitability. Retail/distribution businesses can be excellent at 2–4% by design.",
      ),
    );
  }

  // --- Operating Margin ---
  if (f.operatingMargins === null) {
    results.push(na("opMargin", "Operating Margin", "Not reported"));
  } else {
    const v = f.operatingMargins;
    const verdict: MetricVerdict =
      v > 0.2 ? "good" : v >= 0.08 ? "caution" : "red";
    results.push(
      score(
        "opMargin",
        "Operating Margin",
        v,
        fmt(v, "%"),
        verdict,
        "Operational efficiency. Grocery/logistics structurally run near 2–5% — compare within sector.",
      ),
    );
  }

  // --- Gross Margin ---
  if (f.grossMargins === null) {
    results.push(na("grossMargin", "Gross Margin", "Not reported"));
  } else {
    const v = f.grossMargins;
    const verdict: MetricVerdict =
      v > 0.4 ? "good" : v >= 0.2 ? "caution" : "red";
    results.push(
      score(
        "grossMargin",
        "Gross Margin",
        v,
        fmt(v, "%"),
        verdict,
        "Pricing power. Software typically >60%, retail 20–30% is normal. Sector-relative.",
      ),
    );
  }

  // --- ROE ---
  if (f.returnOnEquity === null) {
    results.push(na("roe", "ROE", "Not reported"));
  } else {
    const v = f.returnOnEquity;
    const verdict: MetricVerdict =
      v > 0.15 ? "good" : v >= 0.1 ? "caution" : "red";
    results.push(
      score(
        "roe",
        "Return on Equity",
        v,
        fmt(v, "%"),
        verdict,
        "Equity efficiency. High debt can inflate ROE artificially — pair with D/E.",
      ),
    );
  }

  // --- Revenue Growth ---
  if (f.revenueGrowth === null) {
    results.push(na("revenueGrowth", "Revenue Growth", "Not reported"));
  } else {
    const v = f.revenueGrowth;
    const verdict: MetricVerdict =
      v > 0.1 ? "good" : v >= 0 ? "caution" : "red";
    results.push(
      score(
        "revenueGrowth",
        "Revenue Growth (YoY)",
        v,
        fmt(v, "%"),
        verdict,
        "Business expansion. Consistency over multiple years matters more than a single spike.",
      ),
    );
  }

  // --- EPS Growth ---
  if (f.earningsGrowth === null) {
    results.push(na("epsGrowth", "EPS Growth", "Not reported"));
  } else {
    const v = f.earningsGrowth;
    const verdict: MetricVerdict =
      v > 0.15 ? "good" : v >= 0.05 ? "caution" : "red";
    results.push(
      score(
        "epsGrowth",
        "EPS Growth (YoY)",
        v,
        fmt(v, "%"),
        verdict,
        "Profit per share growth. Verify it's not driven purely by buybacks.",
      ),
    );
  }

  // --- FCF Margin ---
  if (
    f.freeCashflow === null ||
    f.totalRevenue === null ||
    f.totalRevenue === 0
  ) {
    results.push(
      na("fcfMargin", "FCF Margin", "Free cash flow or revenue data missing"),
    );
  } else {
    const v = f.freeCashflow / f.totalRevenue;
    const verdict: MetricVerdict =
      v > 0.15 ? "good" : v >= 0.05 ? "caution" : "red";
    results.push(
      score(
        "fcfMargin",
        "FCF Margin",
        v,
        fmt(v, "%"),
        verdict,
        "Cash efficiency (FCF ÷ Revenue). Harder to manipulate than earnings. Prefer for capex-heavy firms.",
      ),
    );
  }

  // --- Debt/Equity ---
  // Yahoo Finance returns D/E multiplied by 100 (e.g. 150 means 1.5x)
  if (f.debtToEquity === null) {
    results.push(na("de", "Debt / Equity", "Not reported"));
  } else {
    const v = f.debtToEquity / 100; // normalise to ratio
    const verdict: MetricVerdict = v < 1 ? "good" : v <= 2 ? "caution" : "red";
    results.push(
      score(
        "de",
        "Debt / Equity",
        v,
        fmtRaw(v),
        verdict,
        "Financial leverage. Utilities/REITs carry structural debt — compare within sector.",
      ),
    );
  }

  // --- Current Ratio ---
  if (f.currentRatio === null) {
    results.push(na("currentRatio", "Current Ratio", "Not reported"));
  } else {
    const v = f.currentRatio;
    const verdict: MetricVerdict =
      v > 1.5 ? "good" : v >= 1.0 ? "caution" : "red";
    results.push(
      score(
        "currentRatio",
        "Current Ratio",
        v,
        fmtRaw(v),
        verdict,
        "Short-term liquidity. Some asset-light businesses run <1.0 intentionally (negative working capital).",
      ),
    );
  }

  // --- Dividend Payout Ratio ---
  if (f.payoutRatio === null) {
    results.push(na("payout", "Dividend Payout", "No dividend reported"));
  } else {
    const v = f.payoutRatio;
    const verdict: MetricVerdict =
      v >= 0.2 && v <= 0.6 ? "good" : v <= 0.8 ? "caution" : "red";
    results.push(
      score(
        "payout",
        "Dividend Payout",
        v,
        fmt(v, "%"),
        verdict,
        "Dividend sustainability. REITs & MLPs are legally required to pay >90% — normal for those structures.",
      ),
    );
  }

  return results;
};
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
cd /Users/anajjar/code/portfolio && npm run test -- src/watchlist/watchlist-metrics.test.ts --run
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/watchlist/watchlist-metrics.ts src/watchlist/watchlist-metrics.test.ts
git commit -m "feat(watchlist): add metric scoring functions with thresholds from stock-metrics-reference"
```

---

## Task 3: Fundamentals API

**Files:**

- Create: `src/watchlist/watchlist-api.ts`
- Create: `src/watchlist/watchlist-api.test.ts`

Yahoo Finance `quoteSummary` returns fundamental data. Modules used: `financialData` (margins, FCF, D/E, growth, ROE) and `defaultKeyStatistics` (P/E, PEG, P/B, EV/EBITDA, payout, shares).

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /Users/anajjar/code/portfolio && npm run test -- src/watchlist/watchlist-api.test.ts --run
```

Expected: FAIL — `Cannot find module './watchlist-api'`

- [ ] **Step 3: Implement fetchFundamentals**

```typescript
// src/watchlist/watchlist-api.ts
import type { FundamentalsData } from "./watchlist-types";

const PROXY_BASE = "https://corsproxy.io/?";
const YAHOO_BASE = "https://query1.finance.yahoo.com";
const YAHOO_SEARCH_BASE = `${YAHOO_BASE}/v1/finance/search`;

// Mirrors the ISIN_MAP from src/services/api.ts for ISIN resolution
const ISIN_MAP: Record<string, string> = {
  US0378331005: "AAPL",
  US5949181045: "MSFT",
  US0231351067: "AMZN",
  US02079K3059: "GOOGL",
  US88160R1014: "TSLA",
  US67066G1040: "NVDA",
  US30303M1027: "META",
  US64110L1061: "NFLX",
};

const isIsin = (input: string) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(input);

const proxyFetch = async (
  url: string,
  signal?: AbortSignal,
): Promise<unknown> => {
  const response = await fetch(`${PROXY_BASE}${encodeURIComponent(url)}`, {
    signal,
  });
  if (!response.ok) throw new Error(`HTTP error ${response.status}`);
  return response.json();
};

const resolveSymbol = async (
  isin: string,
  signal?: AbortSignal,
): Promise<string> => {
  if (ISIN_MAP[isin]) return ISIN_MAP[isin];
  const data = (await proxyFetch(
    `${YAHOO_SEARCH_BASE}?q=${isin}&quotesCount=5&newsCount=0`,
    signal,
  )) as { quotes?: Array<{ symbol?: string; quoteType?: string }> };
  const equity = data.quotes?.find(q => q.quoteType === "EQUITY" && q.symbol);
  if (equity?.symbol) return equity.symbol;
  throw new Error(`Could not resolve ISIN ${isin}`);
};

type RawField = { raw?: number } | undefined;
const raw = (f: RawField): number | null => f?.raw ?? null;

export interface FetchFundamentalsResult {
  symbol: string;
  name: string;
  currentPrice: number | null;
  currency: string;
  fundamentals: FundamentalsData;
}

export const fetchFundamentals = async (
  input: string,
  signal?: AbortSignal,
): Promise<FetchFundamentalsResult> => {
  const symbol = isIsin(input)
    ? await resolveSymbol(input, signal)
    : input.toUpperCase();

  const modules = "financialData,defaultKeyStatistics,price";
  const url = `${YAHOO_BASE}/v10/finance/quoteSummary/${symbol}?modules=${modules}`;
  const data = (await proxyFetch(url, signal)) as {
    quoteSummary: {
      result: Array<{
        defaultKeyStatistics: Record<string, RawField>;
        financialData: Record<string, RawField>;
        price: {
          regularMarketPrice?: RawField;
          currency?: string;
          longName?: string;
          symbol?: string;
        };
      }> | null;
      error?: { description?: string } | null;
    };
  };

  const qs = data.quoteSummary;
  if (qs.error)
    throw new Error(qs.error.description || "Yahoo Finance API error");
  if (!qs.result?.[0]) throw new Error("No data returned for symbol");

  const {
    defaultKeyStatistics: dks,
    financialData: fd,
    price: pr,
  } = qs.result[0];

  // trailingPE is computed from price / trailingEps when not directly available
  const trailingEps = raw(dks.trailingEps as RawField);
  const currentPrice = raw(pr.regularMarketPrice as RawField);
  const trailingPE =
    trailingEps && currentPrice && trailingEps > 0
      ? currentPrice / trailingEps
      : null;

  const fundamentals: FundamentalsData = {
    trailingPE,
    forwardPE: raw(dks.forwardPE as RawField),
    pegRatio: raw(dks.pegRatio as RawField),
    priceToBook: raw(dks.priceToBook as RawField),
    enterpriseToEbitda: raw(dks.enterpriseToEbitda as RawField),
    profitMargins: raw(fd.profitMargins as RawField),
    operatingMargins: raw(fd.operatingMargins as RawField),
    grossMargins: raw(fd.grossMargins as RawField),
    revenueGrowth: raw(fd.revenueGrowth as RawField),
    earningsGrowth: raw(fd.earningsGrowth as RawField),
    returnOnEquity: raw(fd.returnOnEquity as RawField),
    freeCashflow: raw(fd.freeCashflow as RawField),
    totalRevenue: raw(fd.totalRevenue as RawField),
    debtToEquity: raw(fd.debtToEquity as RawField),
    currentRatio: raw(fd.currentRatio as RawField),
    payoutRatio: raw(dks.payoutRatio as RawField),
    sharesOutstanding: raw(dks.sharesOutstanding as RawField),
    floatShares: raw(dks.floatShares as RawField),
  };

  return {
    symbol: pr.symbol || symbol,
    name: pr.longName || symbol,
    currentPrice,
    currency: pr.currency || "USD",
    fundamentals,
  };
};
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
cd /Users/anajjar/code/portfolio && npm run test -- src/watchlist/watchlist-api.test.ts --run
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/watchlist/watchlist-api.ts src/watchlist/watchlist-api.test.ts
git commit -m "feat(watchlist): add fetchFundamentals API wrapper for Yahoo Finance quoteSummary"
```

---

## Task 4: Watchlist Store

**Files:**

- Create: `src/watchlist/watchlist-context.ts`
- Create: `src/watchlist/watchlist-store.tsx`
- Create: `src/watchlist/useWatchlist.ts`

Mirrors the pattern of `store-context.ts` / `store.tsx` / `useStore.ts`.

- [ ] **Step 1: Create context file**

```typescript
// src/watchlist/watchlist-context.ts
import React from "react";
import type { WatchlistState } from "./watchlist-types";

export const WatchlistContext = React.createContext<WatchlistState | undefined>(
  undefined,
);
```

- [ ] **Step 2: Create useWatchlist hook**

```typescript
// src/watchlist/useWatchlist.ts
import { useContext } from "react";
import { WatchlistContext } from "./watchlist-context";

export const useWatchlist = () => {
  const ctx = useContext(WatchlistContext);
  if (!ctx)
    throw new Error("useWatchlist must be used within WatchlistProvider");
  return ctx;
};
```

- [ ] **Step 3: Create WatchlistProvider**

```typescript
// src/watchlist/watchlist-store.tsx
import React, { useState } from 'react';
import { WatchlistContext } from './watchlist-context';
import { fetchFundamentals } from './watchlist-api';
import { scoreMetrics } from './watchlist-metrics';
import type { WatchlistItem } from './watchlist-types';

const STORAGE_KEY = 'watchlist_state';

const loadFromStorage = (): WatchlistItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WatchlistItem[];
  } catch {
    return [];
  }
};

const saveToStorage = (items: WatchlistItem[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch { /* quota exceeded — silently ignore */ }
};

export const WatchlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<WatchlistItem[]>(() => loadFromStorage());

  const updateItem = (id: string, patch: Partial<WatchlistItem>) => {
    setItems(prev => {
      const next = prev.map(it => it.id === id ? { ...it, ...patch } : it);
      saveToStorage(next);
      return next;
    });
  };

  const addItem = async (input: string) => {
    const id = crypto.randomUUID();
    const placeholder: WatchlistItem = {
      id,
      input: input.toUpperCase(),
      symbol: input.toUpperCase(),
      name: input.toUpperCase(),
      currentPrice: null,
      currency: 'USD',
      fundamentals: null,
      metrics: [],
      isLoading: true,
      error: null,
      lastUpdated: null,
    };
    setItems(prev => {
      const next = [...prev, placeholder];
      saveToStorage(next);
      return next;
    });

    try {
      const result = await fetchFundamentals(input);
      const metrics = scoreMetrics(result.fundamentals);
      updateItem(id, {
        symbol: result.symbol,
        name: result.name,
        currentPrice: result.currentPrice,
        currency: result.currency,
        fundamentals: result.fundamentals,
        metrics,
        isLoading: false,
        error: null,
        lastUpdated: new Date().toISOString(),
      });
    } catch (e) {
      updateItem(id, {
        isLoading: false,
        error: e instanceof Error ? e.message : 'Failed to fetch data',
      });
    }
  };

  const removeItem = (id: string) => {
    setItems(prev => {
      const next = prev.filter(it => it.id !== id);
      saveToStorage(next);
      return next;
    });
  };

  const refreshItem = async (id: string) => {
    const item = items.find(it => it.id === id);
    if (!item) return;
    updateItem(id, { isLoading: true, error: null });
    try {
      const result = await fetchFundamentals(item.input);
      const metrics = scoreMetrics(result.fundamentals);
      updateItem(id, {
        symbol: result.symbol,
        name: result.name,
        currentPrice: result.currentPrice,
        currency: result.currency,
        fundamentals: result.fundamentals,
        metrics,
        isLoading: false,
        error: null,
        lastUpdated: new Date().toISOString(),
      });
    } catch (e) {
      updateItem(id, {
        isLoading: false,
        error: e instanceof Error ? e.message : 'Failed to fetch data',
      });
    }
  };

  return (
    <WatchlistContext.Provider value={{ items, addItem, removeItem, refreshItem }}>
      {children}
    </WatchlistContext.Provider>
  );
};
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/anajjar/code/portfolio && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/watchlist/watchlist-context.ts src/watchlist/watchlist-store.tsx src/watchlist/useWatchlist.ts
git commit -m "feat(watchlist): add WatchlistProvider, context, and useWatchlist hook"
```

---

## Task 5: MetricRow component

**Files:**

- Create: `src/watchlist/MetricRow.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/watchlist/MetricRow.test.tsx  (create this file)
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MetricRow } from './MetricRow';
import type { MetricResult } from './watchlist-types';

const make = (overrides: Partial<MetricResult>): MetricResult => ({
  key: 'pe',
  label: 'P/E Ratio',
  value: 20,
  displayValue: '20.00',
  verdict: 'good',
  note: 'Some note',
  ...overrides,
});

describe('MetricRow', () => {
  it('renders the metric label and display value', () => {
    render(<table><tbody><MetricRow metric={make({})} /></tbody></table>);
    expect(screen.getByText('P/E Ratio')).toBeTruthy();
    expect(screen.getByText('20.00')).toBeTruthy();
  });

  it('renders Good badge for good verdict', () => {
    render(<table><tbody><MetricRow metric={make({ verdict: 'good' })} /></tbody></table>);
    expect(screen.getByText('Good')).toBeTruthy();
  });

  it('renders Caution badge for caution verdict', () => {
    render(<table><tbody><MetricRow metric={make({ verdict: 'caution' })} /></tbody></table>);
    expect(screen.getByText('Caution')).toBeTruthy();
  });

  it('renders Red Flag badge for red verdict', () => {
    render(<table><tbody><MetricRow metric={make({ verdict: 'red' })} /></tbody></table>);
    expect(screen.getByText('Red Flag')).toBeTruthy();
  });

  it('renders N/A badge for na verdict', () => {
    render(<table><tbody><MetricRow metric={make({ verdict: 'na', displayValue: 'N/A' })} /></tbody></table>);
    expect(screen.getByText('N/A')).toBeTruthy();
  });

  it('renders the note text', () => {
    render(<table><tbody><MetricRow metric={make({})} /></tbody></table>);
    expect(screen.getByText('Some note')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /Users/anajjar/code/portfolio && npm run test -- src/watchlist/MetricRow.test.tsx --run
```

Expected: FAIL — `Cannot find module './MetricRow'`

- [ ] **Step 3: Implement MetricRow**

```tsx
// src/watchlist/MetricRow.tsx
import React from "react";
import type { MetricResult, MetricVerdict } from "./watchlist-types";

const BADGE: Record<MetricVerdict, { label: string; className: string }> = {
  good: {
    label: "Good",
    className:
      "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
  },
  caution: {
    label: "Caution",
    className: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
  },
  red: {
    label: "Red Flag",
    className: "bg-rose-500/20 text-rose-300 border border-rose-500/40",
  },
  na: {
    label: "N/A",
    className: "bg-slate-600/20 text-slate-400 border border-slate-600/40",
  },
};

interface Props {
  metric: MetricResult;
}

export const MetricRow: React.FC<Props> = ({ metric }) => {
  const badge = BADGE[metric.verdict];
  return (
    <tr className="border-b border-slate-700/30 last:border-0">
      <td className="py-2 pr-4 text-sm text-slate-300 font-medium w-44">
        {metric.label}
      </td>
      <td className="py-2 pr-4 text-sm text-white font-mono">
        {metric.displayValue}
      </td>
      <td className="py-2 pr-4">
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.className}`}
        >
          {badge.label}
        </span>
      </td>
      <td className="py-2 text-xs text-slate-400 italic">{metric.note}</td>
    </tr>
  );
};
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
cd /Users/anajjar/code/portfolio && npm run test -- src/watchlist/MetricRow.test.tsx --run
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/watchlist/MetricRow.tsx src/watchlist/MetricRow.test.tsx
git commit -m "feat(watchlist): add MetricRow component with colour-coded verdict badges"
```

---

## Task 6: WatchlistCard component

**Files:**

- Create: `src/watchlist/WatchlistCard.tsx`
- Create: `src/watchlist/WatchlistCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/watchlist/WatchlistCard.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { WatchlistCard } from './WatchlistCard';
import type { WatchlistItem } from './watchlist-types';

const makeItem = (overrides: Partial<WatchlistItem> = {}): WatchlistItem => ({
  id: 'test-id',
  input: 'AAPL',
  symbol: 'AAPL',
  name: 'Apple Inc.',
  currentPrice: 175.0,
  currency: 'USD',
  fundamentals: null,
  metrics: [
    { key: 'pe', label: 'P/E Ratio', value: 20, displayValue: '20.00', verdict: 'good', note: 'Good value' },
    { key: 'peg', label: 'PEG Ratio', value: 1.5, displayValue: '1.50', verdict: 'caution', note: 'Watch this' },
  ],
  isLoading: false,
  error: null,
  lastUpdated: '2024-01-15T10:00:00Z',
  ...overrides,
});

describe('WatchlistCard', () => {
  it('renders stock name and symbol', () => {
    render(<WatchlistCard item={makeItem()} onRemove={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByText('Apple Inc.')).toBeTruthy();
    expect(screen.getByText('AAPL')).toBeTruthy();
  });

  it('renders current price', () => {
    render(<WatchlistCard item={makeItem()} onRemove={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByText(/175/)).toBeTruthy();
  });

  it('renders all metric rows', () => {
    render(<WatchlistCard item={makeItem()} onRemove={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByText('P/E Ratio')).toBeTruthy();
    expect(screen.getByText('PEG Ratio')).toBeTruthy();
  });

  it('shows loading spinner when isLoading', () => {
    render(<WatchlistCard item={makeItem({ isLoading: true })} onRemove={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('shows error message when error is set', () => {
    render(<WatchlistCard item={makeItem({ error: 'Symbol not found' })} onRemove={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByText(/Symbol not found/)).toBeTruthy();
  });

  it('calls onRemove when delete button clicked', async () => {
    const onRemove = vi.fn();
    render(<WatchlistCard item={makeItem()} onRemove={onRemove} onRefresh={vi.fn()} />);
    await userEvent.click(screen.getByTitle('Remove'));
    expect(onRemove).toHaveBeenCalledWith('test-id');
  });

  it('calls onRefresh when refresh button clicked', async () => {
    const onRefresh = vi.fn();
    render(<WatchlistCard item={makeItem()} onRemove={vi.fn()} onRefresh={onRefresh} />);
    await userEvent.click(screen.getByTitle('Refresh'));
    expect(onRefresh).toHaveBeenCalledWith('test-id');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /Users/anajjar/code/portfolio && npm run test -- src/watchlist/WatchlistCard.test.tsx --run
```

Expected: FAIL — `Cannot find module './WatchlistCard'`

- [ ] **Step 3: Implement WatchlistCard**

```tsx
// src/watchlist/WatchlistCard.tsx
import React from "react";
import type { WatchlistItem } from "./watchlist-types";
import { MetricRow } from "./MetricRow";

interface Props {
  item: WatchlistItem;
  onRemove: (id: string) => void;
  onRefresh: (id: string) => void;
}

export const WatchlistCard: React.FC<Props> = ({
  item,
  onRemove,
  onRefresh,
}) => {
  return (
    <div className="glass-panel p-6">
      {/* Card header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-white">{item.name}</h3>
          <span className="text-sm text-slate-400 font-mono">
            {item.symbol}
          </span>
          {item.currentPrice !== null && (
            <span className="ml-3 text-sm text-slate-300">
              {item.currency} {item.currentPrice.toFixed(2)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            title="Refresh"
            onClick={() => onRefresh(item.id)}
            disabled={item.isLoading}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors disabled:opacity-40"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
          </button>
          <button
            title="Remove"
            onClick={() => onRemove(item.id)}
            className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Loading state */}
      {item.isLoading && (
        <div className="flex justify-center py-6" role="status">
          <svg
            className="animate-spin w-6 h-6 text-blue-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
        </div>
      )}

      {/* Error state */}
      {item.error && (
        <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-lg text-rose-300 text-sm">
          {item.error}
        </div>
      )}

      {/* Metrics table */}
      {!item.isLoading && !item.error && item.metrics.length > 0 && (
        <table className="w-full">
          <tbody>
            {item.metrics.map(m => (
              <MetricRow key={m.key} metric={m} />
            ))}
          </tbody>
        </table>
      )}

      {item.lastUpdated && (
        <p className="text-xs text-slate-500 mt-3">
          Updated {new Date(item.lastUpdated).toLocaleString()}
        </p>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
cd /Users/anajjar/code/portfolio && npm run test -- src/watchlist/WatchlistCard.test.tsx --run
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/watchlist/WatchlistCard.tsx src/watchlist/WatchlistCard.test.tsx
git commit -m "feat(watchlist): add WatchlistCard with metrics table and loading/error states"
```

---

## Task 7: WatchlistView — the tab panel

**Files:**

- Create: `src/watchlist/WatchlistView.tsx`
- Create: `src/watchlist/WatchlistView.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/watchlist/WatchlistView.test.tsx
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

const addItemMock = vi.fn(() => Promise.resolve());
const removeItemMock = vi.fn();
const refreshItemMock = vi.fn(() => Promise.resolve());

vi.mock('./useWatchlist', () => ({
  useWatchlist: () => ({
    items: [],
    addItem: addItemMock,
    removeItem: removeItemMock,
    refreshItem: refreshItemMock,
  }),
}));

import { WatchlistView } from './WatchlistView';

describe('WatchlistView', () => {
  it('renders the input form', () => {
    render(<WatchlistView />);
    expect(screen.getByPlaceholderText(/Symbol or ISIN/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Add to Watchlist/i })).toBeTruthy();
  });

  it('calls addItem on form submit', async () => {
    render(<WatchlistView />);
    const input = screen.getByPlaceholderText(/Symbol or ISIN/i);
    await act(async () => {
      await userEvent.type(input, 'AAPL');
      await userEvent.click(screen.getByRole('button', { name: /Add to Watchlist/i }));
      await new Promise(r => setTimeout(r, 10));
    });
    expect(addItemMock).toHaveBeenCalledWith('AAPL');
  });

  it('clears input after submit', async () => {
    render(<WatchlistView />);
    const input = screen.getByPlaceholderText(/Symbol or ISIN/i) as HTMLInputElement;
    await act(async () => {
      await userEvent.type(input, 'MSFT');
      await userEvent.click(screen.getByRole('button', { name: /Add to Watchlist/i }));
      await new Promise(r => setTimeout(r, 10));
    });
    expect(input.value).toBe('');
  });

  it('shows empty state message when no items', () => {
    render(<WatchlistView />);
    expect(screen.getByText(/No stocks in your watchlist/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /Users/anajjar/code/portfolio && npm run test -- src/watchlist/WatchlistView.test.tsx --run
```

Expected: FAIL — `Cannot find module './WatchlistView'`

- [ ] **Step 3: Implement WatchlistView**

```tsx
// src/watchlist/WatchlistView.tsx
import React, { useState } from "react";
import { useWatchlist } from "./useWatchlist";
import { WatchlistCard } from "./WatchlistCard";

export const WatchlistView: React.FC = () => {
  const { items, addItem, removeItem, refreshItem } = useWatchlist();
  const [input, setInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setIsAdding(true);
    try {
      await addItem(input.trim());
      setInput("");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Add form */}
      <div className="glass-panel p-6">
        <h2 className="text-xl font-bold mb-4 text-white">Watchlist</h2>
        <form onSubmit={handleSubmit} className="flex gap-4">
          <input
            type="text"
            placeholder="Symbol or ISIN (e.g. AAPL, US0378331005)"
            className="glass-input flex-1 uppercase"
            value={input}
            onChange={e => setInput(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={isAdding}
            className="glass-button whitespace-nowrap disabled:opacity-50"
          >
            {isAdding ? "Adding..." : "Add to Watchlist"}
          </button>
        </form>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <p className="text-center text-slate-500 py-8">
          No stocks in your watchlist yet. Add a symbol or ISIN above.
        </p>
      )}

      {/* Cards */}
      {items.map(item => (
        <WatchlistCard
          key={item.id}
          item={item}
          onRemove={removeItem}
          onRefresh={refreshItem}
        />
      ))}
    </div>
  );
};
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
cd /Users/anajjar/code/portfolio && npm run test -- src/watchlist/WatchlistView.test.tsx --run
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/watchlist/WatchlistView.tsx src/watchlist/WatchlistView.test.tsx
git commit -m "feat(watchlist): add WatchlistView panel with add form and card list"
```

---

## Task 8: Nav in the header — Layout + App wiring

The nav switcher lives in the **sticky header** (inside `Layout.tsx`) so it's always visible regardless of scroll position. Tab state is lifted to `App` and passed down as props.

**Files:**

- Modify: `src/components/Layout.tsx`
- Modify: `src/App.tsx`

The approach:

1. Add `AppTab`, `activeTab`, `onTabChange` to `Layout`'s props.
2. Render two nav buttons next to the app title in the header.
3. In `App`, lift `activeTab` state, pass it into `Layout`, and conditionally render Portfolio or Watchlist content.

- [ ] **Step 1: Update Layout.tsx — add AppTab type and nav buttons to the header**

Replace the entire content of `src/components/Layout.tsx` with:

```tsx
// src/components/Layout.tsx
import React from "react";
import { useStore } from "../services/useStore";

export type AppTab = "portfolio" | "watchlist";

interface LayoutProps {
  children: React.ReactNode;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

const NAV_BTN = {
  active:
    "px-4 py-1.5 rounded-lg text-sm font-semibold bg-blue-600 text-white shadow",
  inactive:
    "px-4 py-1.5 rounded-lg text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/10 transition-colors",
};

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  onTabChange,
}) => {
  const {
    totalValue,
    totalCost,
    totalGain,
    totalGainPercent,
    portfolio,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    autoRefreshIntervalMinutes,
    setAutoRefreshIntervalMinutes,
    autoRefreshIntervalIsDefault,
  } = useStore();
  const isPositive = totalGain >= 0;

  return (
    <div className="min-h-screen pb-10 px-2 sm:px-4">
      <header className="py-6 px-4 mb-8 border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-8xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0">
          {/* Left: title + nav */}
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                Portfolio Tracker
              </h1>
              <div className="text-xs text-slate-400 mt-1">
                Powered by Yahoo Finance
              </div>
            </div>
            <nav className="flex gap-1">
              <button
                className={
                  activeTab === "portfolio" ? NAV_BTN.active : NAV_BTN.inactive
                }
                onClick={() => onTabChange("portfolio")}
              >
                Portfolio
              </button>
              <button
                className={
                  activeTab === "watchlist" ? NAV_BTN.active : NAV_BTN.inactive
                }
                onClick={() => onTabChange("watchlist")}
              >
                Watchlist
              </button>
            </nav>
          </div>

          {/* Right: stats + auto-refresh (only shown on portfolio tab with holdings) */}
          {activeTab === "portfolio" && portfolio.length > 0 && (
            <div className="flex gap-8 flex-wrap md:flex-nowrap text-right items-center">
              <div className="flex items-center gap-3">
                <button
                  className={`px-3 py-1 rounded-md text-sm font-medium ${autoRefreshEnabled ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-200"}`}
                  onClick={() =>
                    setAutoRefreshEnabled &&
                    setAutoRefreshEnabled(!autoRefreshEnabled)
                  }
                >
                  {autoRefreshEnabled
                    ? "Auto Refresh: On"
                    : "Auto Refresh: Off"}
                </button>
                <div className="text-xs text-slate-400 ml-2 flex items-center gap-2">
                  <span>Interval</span>
                  <div className="flex items-center gap-2">
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                      {[1, 5, 15, 60].map(m => (
                        <div key={m} className="flex items-center gap-2">
                          <button
                            className={`w-full text-center px-2 py-1 rounded text-sm ${autoRefreshIntervalMinutes === m ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-200"}`}
                            onClick={() =>
                              setAutoRefreshIntervalMinutes &&
                              setAutoRefreshIntervalMinutes(m)
                            }
                            aria-label={`set-interval-${m}`}
                          >
                            {m}m
                          </button>
                          {m === 5 && autoRefreshIntervalIsDefault && (
                            <span className="text-[10px] text-slate-300">
                              (default)
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Total Invested</div>
                <div className="text-xl font-semibold text-slate-300">
                  €
                  {totalCost.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Total Value</div>
                <div className="text-2xl font-bold text-white">
                  €
                  {totalValue.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <div
                  className={`text-sm font-medium ${isPositive ? "text-emerald-400" : "text-rose-400"}`}
                >
                  {isPositive ? "+" : ""}€
                  {totalGain.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  ({totalGainPercent.toFixed(2)}%)
                </div>
              </div>
            </div>
          )}
        </div>
      </header>
      <main className="max-w-8xl mx-auto space-y-8">{children}</main>
    </div>
  );
};
```

- [ ] **Step 2: Update App.tsx — lift tab state, pass to Layout, render correct view**

Replace the entire content of `src/App.tsx` with:

```tsx
// src/App.tsx
import React, { useState } from "react";
import { StoreProvider } from "./services/store";
import { WatchlistProvider } from "./watchlist/watchlist-store";
import { useStore } from "./services/useStore";
import { Layout } from "./components/Layout";
import type { AppTab } from "./components/Layout";
import { AddStockForm } from "./components/AddStockForm";
import { PortfolioList } from "./components/PortfolioList";
import { PortfolioChart } from "./components/Chart";
import { WatchlistView } from "./watchlist/WatchlistView";

const Dashboard: React.FC = () => {
  const { totalValue, isLoading, refreshPortfolio, stopRefresh } = useStore();
  const [activeTab, setActiveTab] = useState<AppTab>("portfolio");

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      <div className="grid grid-cols-1 gap-8">
        {/* Summary Card — always visible */}
        <div className="glass-panel p-6 bg-gradient-to-br from-blue-900/50 to-slate-900/50 flex justify-between items-center">
          <div>
            <h2 className="text-sm text-slate-400 font-medium uppercase tracking-wider">
              Total Portfolio Value
            </h2>
            <div className="text-4xl font-bold text-white mt-1">
              €
              {totalValue.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                isLoading ? stopRefresh && stopRefresh() : refreshPortfolio()
              }
              className={`p-2 rounded-full hover:bg-white/10 transition-colors ${isLoading ? "bg-rose-600 text-white" : ""}`}
              title={isLoading ? "Stop Refresh" : "Refresh Prices"}
            >
              {isLoading ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-5 h-5"
                >
                  <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Tab content */}
        {activeTab === "portfolio" && (
          <>
            <AddStockForm />
            <PortfolioChart />
            <PortfolioList />
          </>
        )}
        {activeTab === "watchlist" && <WatchlistView />}
      </div>
    </Layout>
  );
};

const App: React.FC = () => (
  <StoreProvider>
    <WatchlistProvider>
      <Dashboard />
    </WatchlistProvider>
  </StoreProvider>
);

export default App;
```

- [ ] **Step 3: Update Layout.test.tsx to pass required props**

The existing `Layout.test.tsx` renders `<Layout>` without the new required props. Update it to pass them so the test suite stays green. Open `src/components/Layout.test.tsx` and add `activeTab="portfolio"` and `onTabChange={() => {}}` to every `render(<Layout ...>)` call.

The existing test file renders Layout like this:

```tsx
render(<Layout>{...}</Layout>)
```

Change every such render call to:

```tsx
render(<Layout activeTab="portfolio" onTabChange={() => {}}>{...}</Layout>)
```

- [ ] **Step 4: Confirm TypeScript compiles cleanly**

```bash
cd /Users/anajjar/code/portfolio && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Run the full test suite**

```bash
cd /Users/anajjar/code/portfolio && npm run test -- --run
```

Expected: all tests PASS

- [ ] **Step 6: Start dev server and manually verify**

```bash
cd /Users/anajjar/code/portfolio && npm run dev
```

Open `http://localhost:5173` and verify:

- "Portfolio" and "Watchlist" nav buttons appear in the sticky header, to the right of the app title
- The active button is highlighted in blue
- Clicking "Watchlist" replaces the content area with `WatchlistView` (add form + empty state)
- Clicking "Portfolio" restores the portfolio content (AddStockForm, chart, list)
- Auto-refresh controls in the header are hidden when on the Watchlist tab
- Typing `AAPL` and clicking "Add to Watchlist" shows a loading card, then populates with metrics
- Refreshing the page keeps watchlist items (localStorage)
- The Portfolio tab continues to work exactly as before

- [ ] **Step 7: Commit**

```bash
git add src/components/Layout.tsx src/App.tsx src/components/Layout.test.tsx
git commit -m "feat(watchlist): add Portfolio/Watchlist nav to sticky header; lift tab state to App"
```

---

## Self-Review

**Spec coverage check:**

| Requirement                                     | Task                                                         |
| ----------------------------------------------- | ------------------------------------------------------------ |
| User can add ticker or ISIN                     | Task 7 (WatchlistView form), Task 3 (ISIN resolution in API) |
| App fetches data for the stock                  | Task 3 (fetchFundamentals)                                   |
| Follows metrics from stock-metrics-reference.md | Task 2 (all 14 metrics scored with reference thresholds)     |
| Shows how stock fits each criteria              | Task 5 (MetricRow badges), Task 6 (WatchlistCard table)      |
| Easy to understand display                      | Task 5 (Good/Caution/Red Flag badges + note per row)         |
| Persistence across reloads                      | Task 4 (WatchlistProvider saves to localStorage)             |
| Nav button in sticky header to switch views     | Task 8 (Layout.tsx nav + App.tsx tab state)                  |
| Portfolio tab unaffected                        | Task 8 (conditional render, existing tests updated)          |

**Placeholder scan:** No TBDs, no "implement later", no "similar to task N" — all steps include full code.

**Type consistency check:**

- `WatchlistItem.metrics: MetricResult[]` defined in Task 1, populated in Task 4, rendered in Task 6 ✓
- `FundamentalsData` defined in Task 1, returned from Task 3, consumed by Task 2 ✓
- `MetricVerdict` union used consistently in Tasks 1, 2, 5 ✓
- `WatchlistState` interface (Task 1) matches `WatchlistProvider` value shape (Task 4) ✓
- D/E normalisation (÷100) consistent between test (Task 2) and implementation (Task 2) ✓
