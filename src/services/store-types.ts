import type { Candle } from './api';

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
  fetchedRanges?: ('1M'|'3M'|'1Y'|'5Y')[];
  error?: string;
}

export interface AppState {
  portfolio: PortfolioItem[];
  isLoading: boolean;
  addStock: (symbol: string, qty: number, price: number, opts?: { fetchQuote?: boolean }, meta?: { lastUpdated?: string; currentPrice?: number }) => Promise<void>;
  removeStock: (id: string) => void;
  refreshPortfolio: () => Promise<void>;
  refreshStock: (id: string) => Promise<void>;
  refreshPortfolioRange?: (range: '1M'|'3M'|'1Y'|'5Y') => Promise<void>;
  // Currently selected range for chart/refresh (e.g. '1M','3M','1Y','5Y')
  selectedRange?: '1M'|'3M'|'1Y'|'5Y';
  setSelectedRange?: (r: '1M'|'3M'|'1Y'|'5Y') => void;
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
