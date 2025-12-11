import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

// Mock lightweight-charts to avoid canvas usage in JSDOM
vi.mock('lightweight-charts', () => {
  const fakeSeries = { setData: vi.fn() };
  return {
    createChart: () => ({
      addSeries: () => fakeSeries,
      timeScale: () => ({ fitContent: vi.fn() }),
      applyOptions: vi.fn(),
      remove: vi.fn(),
    }),
    ColorType: { Solid: 0 },
    AreaSeries: {} as any,
  };
});

vi.mock('../services/useStore', () => {
  return {
    useStore: () => ({
      portfolio: [
        { id: '1', symbol: 'Z', qty: 1, avgPrice: 10, currentPrice: 12, history: [ { time: '2025-11-01', value: 10 }, { time: '2025-12-01', value: 12 } ] },
        { id: '2', symbol: 'A', qty: 2, avgPrice: 5, currentPrice: 6, history: [ { time: '2025-11-01', value: 5 }, { time: '2025-12-01', value: 6 } ] },
      ],
      portfolioHistory: [ { time: '2025-11-01', value: 20 }, { time: '2025-12-01', value: 24 } ],
      totalValue: 24,
      refreshPortfolioRange: undefined,
      setSelectedRange: undefined,
    })
  }
});

import { PortfolioChart } from './Chart';

describe('per-stock breakdown', () => {
  it('shows collapsed toggle and opens breakdown sorted by symbol', () => {
    render(<PortfolioChart />);
    // find the toggle button label
    const toggle = screen.getByRole('button', { name: /Show per-stock breakdown/i });
    expect(toggle).toBeTruthy();
    fireEvent.click(toggle);

    // After opening, expect two symbols rendered and check alphabetical order by reading their text content
    const symbols = Array.from(document.querySelectorAll('.grid div')).map(d => d.textContent || '').filter(Boolean);
    // should contain 'A' and 'Z'
    expect(symbols.some(s => s.includes('A'))).toBeTruthy();
    expect(symbols.some(s => s.includes('Z'))).toBeTruthy();
    // ensure the first symbol is 'A' (alphabetical)
    expect(symbols[0].includes('A')).toBeTruthy();
  });
});
