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
