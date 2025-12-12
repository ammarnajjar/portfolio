import React, { useEffect, useState } from 'react';
import storage from './storage';
import { api } from './api';
import type { Candle } from './api';
import type { PortfolioItem } from './store-types';
import type { Range } from './ranges';
import { DEFAULT_RANGE } from './ranges';

import { StoreContext } from './store-context';
import { mergeHistories, isAbort } from './store-utils';

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>(() => {
    try {
      const s = storage.get('portfolio', [] as PortfolioItem[]);
      return s as PortfolioItem[];
    } catch (e) {
      void e;
      return [];
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [autoRefreshIntervalMinutes, setAutoRefreshIntervalMinutesRaw] = useState<number>(() => {
    try {
      const v = storage.get('autoRefreshIntervalMinutes', 5) as number | undefined;
      return v ?? 5;
    } catch (e) {
      void e;
      return 5;
    }
  });
  // Track whether the current interval is the built-in default (i.e. no saved value existed on first load).
  const [autoRefreshIntervalIsDefault, setAutoRefreshIntervalIsDefault] = useState<boolean>(() => {
    try {
      const state = storage.readState();
      return Object.prototype.hasOwnProperty.call(state, 'autoRefreshIntervalMinutes') ? false : true;
    } catch (e) {
      void e;
      return true;
    }
  });

  // Wrapped setter: when user sets interval, we clear the "is default" flag and store the value.
  const setAutoRefreshIntervalMinutes = (v: number) => {
    setAutoRefreshIntervalMinutesRaw(v);
    setAutoRefreshIntervalIsDefault(false);
  };
  const [selectedRange, setSelectedRange] = useState<Range>(DEFAULT_RANGE);
  // per-item refreshing is tracked on each PortfolioItem via `isRefreshing`

  useEffect(() => {
    storage.set('portfolio', portfolio);
  }, [portfolio]);

  useEffect(() => {
    storage.set('autoRefreshIntervalMinutes', autoRefreshIntervalMinutes);
  }, [autoRefreshIntervalMinutes]);

  // Controller for aborting an in-progress refresh
  const refreshControllerRef = React.useRef<AbortController | null>(null);

  // use imported `isAbort` from store-utils

  const refreshPortfolio = React.useCallback(async (opts: { force?: boolean } = {}) => {
    // Use the selected range if available by passing it to the API
    setIsLoading(true);
    if (!refreshControllerRef.current) refreshControllerRef.current = new AbortController();
    const signal = refreshControllerRef.current.signal;
    try {
      const BATCH_SIZE = 3;
      const itemsToRefresh = [...portfolio];

      for (let i = 0; i < itemsToRefresh.length; i += BATCH_SIZE) {
        if (signal.aborted) break;

        const batch = itemsToRefresh.slice(i, i + BATCH_SIZE);

        setPortfolio(current => current.map(p => {
          const inBatch = batch.find(b => b.id === p.id);
          return inBatch ? { ...p, isRefreshing: true, error: undefined } : p;
        }));

        await Promise.all(batch.map(async (item) => {
          if (signal.aborted) return;
          // Determine requested fetch range (default to 1M)
          const fetchRange = selectedRange || DEFAULT_RANGE;

          // For 1M we always fetch fresh (don't skip and don't cache the result)
          const alreadyFetched = !opts.force && fetchRange !== DEFAULT_RANGE && item.fetchedRanges && item.fetchedRanges.includes(fetchRange);
          if (alreadyFetched) {
            // Clear isRefreshing flag for this item
            setPortfolio(current => current.map(p => p.id === item.id ? ({ ...p, isRefreshing: false }) : p));
            return;
          }

          try {
            const { quote, history } = await api.fetchStock(item.symbol, fetchRange, signal);
            setPortfolio(current => current.map(p => p.id === item.id ? ({
              ...p,
              name: quote.name || p.name,
              isin: quote.isin || p.isin,
              currentPrice: quote.price,
              history: mergeHistories(p.history, history),
              lastUpdated: new Date().toISOString(),
              isRefreshing: false,
              error: undefined,
              // Persist the fetched range for the item (include DEFAULT_RANGE explicitly).
              fetchedRanges: Array.from(new Set([...(p.fetchedRanges || []), fetchRange as Range])),
            }) : p));
          } catch (e: unknown) {
            const isAborted = isAbort(e) || signal.aborted;
            if (isAborted) return;
            setPortfolio(current => current.map(p => p.id === item.id ? ({ ...p, isRefreshing: false, error: e instanceof Error ? e.message : 'Unknown error' }) : p));
          }
        }));

        if (i + BATCH_SIZE < itemsToRefresh.length && !signal.aborted) await new Promise(r => setTimeout(r, 500));
      }

    } catch (e) {
      // Log fatal errors from the refresh loop
      console.error('Fatal error in refreshPortfolio loop', e);
    } finally {
      // Always clear any per-item refreshing flags when the refresh loop finishes or is aborted.
      setPortfolio(current => current.map(p => ({ ...p, isRefreshing: false })));
      refreshControllerRef.current = null;
      setIsLoading(false);
    }
  }, [portfolio, selectedRange]);

  const forceRefreshPortfolioRange = async (range: Range) => {
    setSelectedRange(range);
    if (refreshControllerRef.current) {
      refreshControllerRef.current.abort();
      refreshControllerRef.current = null;
    }
    return refreshPortfolio({ force: true });
  };

  const stopRefresh = () => {
    if (refreshControllerRef.current) {
      refreshControllerRef.current.abort();
      refreshControllerRef.current = null;
    }
  };

  const refreshPortfolioRange = async (range: Range) => {
    setSelectedRange(range);
    // Ensure any in-progress refresh is cancelled and run fresh
    if (refreshControllerRef.current) {
      refreshControllerRef.current.abort();
      refreshControllerRef.current = null;
    }
    return refreshPortfolio();
  };

  // Auto-refresh effect: when enabled, refresh portfolio every 5 minutes.
  // Keep a ref to the latest refreshPortfolio so the interval effect
  // doesn't re-run whenever `refreshPortfolio` identity changes (it
  // changes when portfolio/selectedRange changes). We'll update the
  // ref whenever refreshPortfolio changes and call the ref from the
  // interval handler.
  const refreshPortfolioRef = React.useRef(refreshPortfolio);
  React.useEffect(() => {
    refreshPortfolioRef.current = refreshPortfolio;
  }, [refreshPortfolio]);

  React.useEffect(() => {
    if (!autoRefreshEnabled) return;

    let cancelled = false;

    // Immediately trigger one refresh when enabling
    (async () => {
      try {
        await refreshPortfolioRef.current();
      } catch (e) {
        void e;
      }
    })();

    const INTERVAL_MS = Math.max(1, autoRefreshIntervalMinutes) * 60 * 1000;
    const id = setInterval(() => {
      if (cancelled) return;
      // Call the latest refresh function via ref
      refreshPortfolioRef.current().catch(() => {});
    }, INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [autoRefreshEnabled, autoRefreshIntervalMinutes]);


  const addStock = async (symbol: string, qty: number, price: number, opts: { fetchQuote?: boolean } = { fetchQuote: true }, meta?: { lastUpdated?: string; currentPrice?: number }) => {
    const { fetchQuote = true } = opts || {};
    if (!fetchQuote) {
      // Add item quickly without fetching external data (used for bulk imports)
      const newItem: PortfolioItem = {
        id: crypto.randomUUID(),
        symbol: symbol.toUpperCase(),
        qty,
        avgPrice: price,
        lastUpdated: meta?.lastUpdated,
        currentPrice: meta?.currentPrice,
      };
      setPortfolio(prev => [...prev, newItem]);
      return;
    }

    setIsLoading(true);
    try {
      const fetchRange = selectedRange || DEFAULT_RANGE;
      const { quote, history } = await api.fetchStock(symbol, fetchRange as Range);
      const newItem: PortfolioItem = {
        id: crypto.randomUUID(),
        symbol: quote.symbol,
        name: quote.name,
        isin: quote.isin,
        qty,
        avgPrice: price, // User enters price in EUR
        currentPrice: quote.price, // API returns price converted to EUR
        history,
        // Record the fetched range explicitly for new items created during refresh.
        fetchedRanges: [fetchRange as Range],
        lastUpdated: new Date().toISOString(),
      };
      setPortfolio(prev => [...prev, newItem]);
    } catch (e) {
      alert('Failed to fetch stock data. Please check the symbol.');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const removeStock = (id: string) => {
    setPortfolio(prev => prev.filter(p => p.id !== id));
  };

  const totalValue = portfolio.reduce((sum, item) => {
    return sum + (item.qty * (item.currentPrice || item.avgPrice));
  }, 0);

  const totalCost = portfolio.reduce((sum, item) => {
    return sum + (item.qty * item.avgPrice);
  }, 0);

  const totalGain = totalValue - totalCost;
  const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  // Aggregate History for the Chart
  // This is a simplified aggregation: assume all stocks have history for the same dates.
  // We sum the value (price * qty) for each date.
  const portfolioHistory: Candle[] = (() => {
    if (portfolio.length === 0) return [];

    const dateMap = new Map<string, number>();

    portfolio.forEach(item => {
      if (item.history) {
        item.history.forEach(candle => {
          const currentVal = dateMap.get(candle.time) || 0;
          dateMap.set(candle.time, currentVal + (candle.value * item.qty));
        });
      }
    });

    return Array.from(dateMap.entries())
      .map(([time, value]) => ({ time, value }))
      .sort((a, b) => a.time.localeCompare(b.time));
  })();

  const refreshStock = async (id: string) => {
    // Mark this item as refreshing without toggling the global loading state
    setPortfolio(prev => prev.map(p => p.id === id ? { ...p, isRefreshing: true } : p));
    try {
      const item = portfolio.find(p => p.id === id);
      if (!item) return;

      const fetchRange = selectedRange || DEFAULT_RANGE;
      const { quote, history } = await api.fetchStock(item.symbol, fetchRange as Range);
      const updatedItem = {
        ...item,
        name: quote.name || item.name,
        isin: quote.isin || item.isin,
        currentPrice: quote.price,
        history: mergeHistories(item.history, history),
        // Always persist the range that was just fetched, including DEFAULT_RANGE.
        fetchedRanges: Array.from(new Set([...(item.fetchedRanges || []), fetchRange as Range])),
        lastUpdated: new Date().toISOString(),
        isRefreshing: false,
      };

      setPortfolio(prev => prev.map(p => p.id === id ? updatedItem : p));
    } catch (e) {
      // Update with error
      setPortfolio(prev => prev.map(p => p.id === id ? {
        ...p,
        isRefreshing: false,
        error: e instanceof Error ? e.message : 'Unknown error'
      } : p));
    }
  };

  // Export current portfolio object as JSON string
  const exportPortfolio = (): string => {
    return JSON.stringify(portfolio, null, 2);
  };

  // Import a portfolio JSON string and replace current state.
  // Returns number of items imported.
  const importPortfolio = (json: string): number => {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) throw new Error('Invalid portfolio format: expected an array');

      const items = parsed.map((it: unknown, idx: number) => {
        if (!it || typeof it !== 'object') throw new Error(`Invalid portfolio item at index ${idx}: expected object`);
        const obj = it as Record<string, unknown>;
        if (!obj.symbol || typeof obj.symbol !== 'string') throw new Error(`Invalid portfolio item at index ${idx}: missing or invalid 'symbol'`);
        if (obj.qty !== undefined && typeof obj.qty !== 'number') throw new Error(`Invalid portfolio item at index ${idx}: 'qty' must be a number`);
        if (obj.avgPrice !== undefined && typeof obj.avgPrice !== 'number') throw new Error(`Invalid portfolio item at index ${idx}: 'avgPrice' must be a number`);

        return {
          id: (obj.id && typeof obj.id === 'string') ? obj.id : crypto.randomUUID(),
          symbol: String(obj.symbol).toUpperCase(),
          name: typeof obj.name === 'string' ? obj.name : undefined,
          isin: typeof obj.isin === 'string' ? obj.isin : undefined,
          qty: typeof obj.qty === 'number' ? obj.qty : 0,
          avgPrice: typeof obj.avgPrice === 'number' ? obj.avgPrice : 0,
          currentPrice: typeof obj.currentPrice === 'number' ? obj.currentPrice : undefined,
          history: Array.isArray(obj.history) ? obj.history as Candle[] : undefined,
          lastUpdated: typeof obj.lastUpdated === 'string' ? obj.lastUpdated : undefined,
          isRefreshing: false,
          fetchedRanges: Array.isArray(obj.fetchedRanges) ? obj.fetchedRanges as Range[] : undefined,
          error: undefined,
        } as PortfolioItem;
      });

      setPortfolio(items);
      return items.length;
    } catch (e) {
      console.error('Failed to import portfolio JSON', e);
      throw e;
    }
  };

  return (
    <StoreContext.Provider value={{
      portfolio,
      isLoading,
      autoRefreshEnabled,
      setAutoRefreshEnabled,
      stopRefresh,
      autoRefreshIntervalMinutes,
      setAutoRefreshIntervalMinutes,
      autoRefreshIntervalIsDefault,
      addStock,
      removeStock,
      refreshPortfolio,
      refreshPortfolioRange,
      forceRefreshPortfolioRange,
      exportPortfolio,
      importPortfolio,
      refreshStock,
      selectedRange,
      setSelectedRange,
      totalValue,
      totalCost,
      totalGain,
      totalGainPercent,
      portfolioHistory,

    }}>
      {children}
    </StoreContext.Provider>
  );
};

// `useStore` hook is provided by `src/services/useStore.ts` (do not re-export here to satisfy fast-refresh rule)
