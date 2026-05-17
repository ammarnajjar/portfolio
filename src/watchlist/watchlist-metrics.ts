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
