import React, { useEffect, useState } from 'react';
import { api } from './api';
import type { Candle } from './api';
import type { PortfolioItem } from './store-types';

import { StoreContext } from './store-context';

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>(() => {
    const saved = localStorage.getItem('portfolio');
    return saved ? JSON.parse(saved) : [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  // per-item refreshing is tracked on each PortfolioItem via `isRefreshing`

  useEffect(() => {
    localStorage.setItem('portfolio', JSON.stringify(portfolio));
  }, [portfolio]);

  // Controller for aborting an in-progress refresh
  const refreshControllerRef = React.useRef<AbortController | null>(null);

  const isAbort = (x: unknown) => {
    if (!x) return false;
    if (x instanceof Error) return x.name === 'AbortError' || x.message === 'AbortError';
    if (typeof x === 'object' && x !== null) {
      const o = x as Record<string, unknown>;
      return o.name === 'AbortError' || o.message === 'AbortError';
    }
    return false;
  };

  const refreshPortfolio = React.useCallback(async () => {
    setIsLoading(true);
    try {
      // Batch updates to avoid overwhelming the proxy (limit concurrency)
      const updated = [...portfolio];
      const BATCH_SIZE = 5;

      for (let i = 0; i < updated.length; i += BATCH_SIZE) {
        const batch = updated.slice(i, i + BATCH_SIZE);
        // Process batch sequentially so we can indicate which item is being refreshed
        for (let batchIdx = 0; batchIdx < batch.length; batchIdx++) {
          const item = batch[batchIdx];
          const realIdx = i + batchIdx;
          try {
            // mark item as refreshing
            updated[realIdx] = { ...updated[realIdx], isRefreshing: true };
            setPortfolio([...updated]);
            // Create or reuse refresh controller
            if (!refreshControllerRef.current) refreshControllerRef.current = new AbortController();
            const signal = refreshControllerRef.current.signal;

            const { quote, history } = await api.fetchStock(item.symbol, signal);
            if (signal.aborted) throw new Error('Refresh aborted');
            // Update all metadata in case it was missing or improved
            updated[realIdx] = {
              ...item,
              name: quote.name || item.name,
              isin: quote.isin || item.isin,
              currentPrice: quote.price,
              history,
              lastUpdated: new Date().toISOString(),
              isRefreshing: false,
            };
          } catch (e: unknown) {
            const aborted = isAbort(e) || refreshControllerRef.current?.signal.aborted;
            if (aborted) {
              console.info('Portfolio refresh aborted by user');
              // ensure controller is cleared
              if (refreshControllerRef.current) {
                refreshControllerRef.current = null;
              }
              // Clear isRefreshing flags for remaining items
              setPortfolio(prev => prev.map(p => ({ ...p, isRefreshing: false })));
              return;
            }
            console.error(`Failed to refresh ${item.symbol}`, e);
            // Clear refreshing flag on failure
            updated[realIdx] = { ...updated[realIdx], isRefreshing: false };
          }
        }

        // Small delay between batches to be nice to the API
        if (i + BATCH_SIZE < updated.length) {
            await new Promise(r => setTimeout(r, 500));
        }
      }

      setPortfolio(updated);
    } finally {
      // cleanup controller
      if (refreshControllerRef.current) {
        refreshControllerRef.current = null;
      }
      setIsLoading(false);
    }
  }, [portfolio]);

  const stopRefresh = () => {
    if (refreshControllerRef.current) {
      refreshControllerRef.current.abort();
      refreshControllerRef.current = null;
    }
  };

  // Auto-refresh effect: when enabled, refresh portfolio every 5 minutes.
  React.useEffect(() => {
    if (!autoRefreshEnabled) return;

    let cancelled = false;
    // Immediately trigger one refresh when enabling
    (async () => {
      try {
        await refreshPortfolio();
      } catch (e) {
        void e;
      }
    })();

    const INTERVAL_MS = 60 * 60 * 1000; // 1 hour
    const id = setInterval(() => {
      if (cancelled) return;
      refreshPortfolio().catch(() => {});
    }, INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [autoRefreshEnabled, refreshPortfolio]);


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
      const { quote, history } = await api.fetchStock(symbol);
      const newItem: PortfolioItem = {
        id: crypto.randomUUID(),
        symbol: quote.symbol,
        name: quote.name,
        isin: quote.isin,
        qty,
        avgPrice: price, // User enters price in EUR
        currentPrice: quote.price, // API returns price converted to EUR
        history,
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

      const { quote, history } = await api.fetchStock(item.symbol);
      const updatedItem = {
        ...item,
        name: quote.name || item.name,
        isin: quote.isin || item.isin,
        currentPrice: quote.price,
        history,
        lastUpdated: new Date().toISOString(),
        isRefreshing: false,
      };

      setPortfolio(prev => prev.map(p => p.id === id ? updatedItem : p));
    } catch (e) {
      console.error(`Failed to refresh item ${id}`, e);
      // Clear the flag on error
      setPortfolio(prev => prev.map(p => p.id === id ? { ...p, isRefreshing: false } : p));
    }
  };

  return (
    <StoreContext.Provider value={{
      portfolio,
      isLoading,
      autoRefreshEnabled,
      setAutoRefreshEnabled,
      stopRefresh,
      addStock,
      removeStock,
      refreshPortfolio,
      refreshStock,
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
