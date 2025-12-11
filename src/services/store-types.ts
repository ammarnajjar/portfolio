import type { Candle } from './api';
import type { Range } from './ranges';

export interface PortfolioItem {
  id: string;
  symbol: string;
  name?: string;
  isin?: string;
  qty: number;
  avgPrice: number;
  currentPrice?: number;
  history?: Candle[];
  lastUpdated?: string;
  isRefreshing?: boolean;
  // Which ranges have been fetched for this item (e.g. '1M','3M','1Y','5Y')
  fetchedRanges?: Range[];
  error?: string;
}

export interface AppState {
  portfolio: PortfolioItem[];
  isLoading: boolean;
  addStock: (symbol: string, qty: number, price: number, opts?: { fetchQuote?: boolean }, meta?: { lastUpdated?: string; currentPrice?: number }) => Promise<void>;
  removeStock: (id: string) => void;
  refreshPortfolio: (opts?: { force?: boolean }) => Promise<void>;
  refreshStock: (id: string) => Promise<void>;
  refreshPortfolioRange: (range: Range) => Promise<void>;
  forceRefreshPortfolioRange: (range: Range) => Promise<void>;
  exportPortfolio: () => string;
  importPortfolio: (json: string) => number;
  // Currently selected range for chart/refresh
  selectedRange: Range;
  setSelectedRange: (r: Range) => void;
  totalValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPercent: number;
  portfolioHistory: Candle[]; // Aggregated history
  autoRefreshEnabled?: boolean;
  setAutoRefreshEnabled?: (enabled: boolean) => void;
  stopRefresh?: () => void;
  // per-item refreshing is stored on PortfolioItem.isRefreshing
}
