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
