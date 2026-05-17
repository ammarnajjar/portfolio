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
  } catch {
    /* quota exceeded — silently ignore */
  }
};

export const WatchlistProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [items, setItems] = useState<WatchlistItem[]>(() => loadFromStorage());
  const itemsRef = React.useRef(items);
  itemsRef.current = items;

  const updateItem = (id: string, patch: Partial<WatchlistItem>) => {
    setItems((prev) => {
      const next = prev.map((it) =>
        it.id === id ? { ...it, ...patch } : it,
      );
      saveToStorage(next);
      return next;
    });
  };

  const addItem = async (input: string) => {
    const normalised = input.trim().toUpperCase();
    const duplicate = itemsRef.current.some(
      (it) => it.input.toUpperCase() === normalised || it.symbol.toUpperCase() === normalised,
    );
    if (duplicate) throw new Error(`${normalised} is already in your watchlist`);

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
    setItems((prev) => {
      const next = [...prev, placeholder];
      saveToStorage(next);
      return next;
    });

    try {
      const result = await fetchFundamentals(input);
      if (result.warning) {
        // Remove the placeholder — don't persist unrecognised tickers
        setItems((prev) => {
          const next = prev.filter((it) => it.id !== id);
          saveToStorage(next);
          return next;
        });
        throw new Error(result.warning);
      }
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
      // Remove placeholder for unrecognised tickers (already removed above),
      // keep it for genuine API errors so the user can see what failed.
      const msg = e instanceof Error ? e.message : 'Failed to fetch data';
      if (msg.includes('not recognised')) {
        throw e;
      }
      updateItem(id, {
        isLoading: false,
        error: msg,
      });
    }
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((it) => it.id !== id);
      saveToStorage(next);
      return next;
    });
  };

  const refreshItem = async (id: string) => {
    const item = items.find((it) => it.id === id);
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
