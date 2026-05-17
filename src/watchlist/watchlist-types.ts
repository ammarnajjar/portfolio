// src/watchlist/watchlist-types.ts

export type MetricVerdict = 'good' | 'caution' | 'red' | 'na';

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
  profitMargins: number | null;       // net margin (ratio, e.g. 0.21 = 21%)
  operatingMargins: number | null;    // operating margin
  grossMargins: number | null;        // gross margin
  // Growth
  revenueGrowth: number | null;       // YoY revenue growth (ratio)
  earningsGrowth: number | null;      // YoY earnings growth (ratio)
  // Returns
  returnOnEquity: number | null;      // ROE (ratio)
  // Cash flow
  freeCashflow: number | null;        // absolute FCF
  totalRevenue: number | null;        // for FCF margin calc
  // Debt
  debtToEquity: number | null;        // D/E ratio (Yahoo returns * 100, e.g. 150 = 1.5x)
  currentRatio: number | null;
  // Dividends
  payoutRatio: number | null;         // dividend payout ratio (ratio)
  // Share count trend (used for dilution signal)
  sharesOutstanding: number | null;
  floatShares: number | null;
}

export interface WatchlistItem {
  id: string;
  input: string;               // raw user input (symbol or ISIN)
  symbol: string;              // resolved Yahoo symbol
  name: string;
  currentPrice: number | null;
  currency: string;
  fundamentals: FundamentalsData | null;
  metrics: MetricResult[];
  isLoading: boolean;
  error: string | null;
  warning: string | null;
  lastUpdated: string | null;
}

export interface WatchlistState {
  items: WatchlistItem[];
  addItem: (input: string) => Promise<void>;
  removeItem: (id: string) => void;
  refreshItem: (id: string) => Promise<void>;
}
