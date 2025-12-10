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

    // Create controller once for the whole batch process
    if (!refreshControllerRef.current) refreshControllerRef.current = new AbortController();
    const signal = refreshControllerRef.current.signal;

    try {
      const BATCH_SIZE = 3; // Smaller batch for smoother UI
      const itemsToRefresh = [...portfolio];

      for (let i = 0; i < itemsToRefresh.length; i += BATCH_SIZE) {
        if (signal.aborted) break;

        const batch = itemsToRefresh.slice(i, i + BATCH_SIZE);

        // 1. Mark batch as refreshing immediately
        setPortfolio(current => current.map(p => {
          const inBatch = batch.find(b => b.id === p.id);
          return inBatch ? { ...p, isRefreshing: true, error: undefined } : p;
        }));

        // 2. Process batch in parallel
        await Promise.all(batch.map(async (item) => {
          if (signal.aborted) return;
          try {
            const { quote, history } = await api.fetchStock(item.symbol, signal);

            // 3. Update Success immediately
            setPortfolio(current => current.map(p => {
              if (p.id !== item.id) return p;
              return {
                ...p,
                name: quote.name || p.name,
                isin: quote.isin || p.isin,
                currentPrice: quote.price,
                history,
                lastUpdated: new Date().toISOString(),
                isRefreshing: false,
                error: undefined,
              };
            }));
          } catch (e: unknown) {
             const isAborted = isAbort(e) || signal.aborted;
             if (isAborted) return; // Will be handled by finally/cleanup

             console.error(`Failed to refresh ${item.symbol}`, e);
             // 4. Update Error immediately
             setPortfolio(current => current.map(p => {
               if (p.id !== item.id) return p;
               return {
                 ...p,
                 isRefreshing: false,
                 error: e instanceof Error ? e.message : 'Unknown error'
               };
             }));
          }
        }));

        // Small delay between batches
        if (i + BATCH_SIZE < itemsToRefresh.length && !signal.aborted) {
           await new Promise(r => setTimeout(r, 500));
        }
      }

    } catch (e) {
      console.error('Fatal error in refreshPortfolio', e);
    } finally {
      const isAborted = refreshControllerRef.current?.signal.aborted;
      // If aborted, we need to ensure no items are left stuck in refreshing state
      if (isAborted) {
         setPortfolio(current => current.map(p => ({ ...p, isRefreshing: false })));
      }

      refreshControllerRef.current = null;
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
      // Update with error
      setPortfolio(prev => prev.map(p => p.id === id ? {
        ...p,
        isRefreshing: false,
        error: e instanceof Error ? e.message : 'Unknown error'
      } : p));
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
