/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';

// Mock lightweight-charts to avoid canvas / matchMedia issues in JSDOM
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

// Mock useStore to provide deterministic portfolio and totalValue
vi.mock('../services/useStore', () => {
  return {
    useStore: () => ({
      portfolio: [
        { id: '1', symbol: 'A', qty: 2, avgPrice: 10, currentPrice: 11, history: [ { time: '2025-12-01', value: 20 }, { time: '2025-12-10', value: 22 } ] },
        { id: '2', symbol: 'B', qty: 1, avgPrice: 5, currentPrice: 6, history: [ { time: '2025-12-01', value: 5 }, { time: '2025-12-10', value: 6 } ] }
      ],
      portfolioHistory: [
        { time: '2025-12-01', value: 45 },
        { time: '2025-12-10', value: 50 }
      ],
      totalValue: 28, // 2*11 + 1*6 = 28
      refreshPortfolioRange: undefined,
      setSelectedRange: undefined,
    })
  }
});

import { PortfolioChart } from './Chart';

describe('PortfolioChart', () => {
  it('renders title and period info', () => {
    render(<PortfolioChart />);
    expect(screen.getByText(/Portfolio Performance/)).toBeTruthy();
  });

  it('computes displayedHistory last point equal to totalValue', () => {
    render(<PortfolioChart />);
    // The first aggregated value is 45, totalValue is 28, diff = -17
    // The periodGain is rendered inside the header span — read its textContent and normalize it
    const header = screen.getByText(/Portfolio Performance/).closest('h3');
    expect(header).toBeTruthy();
    const span = header!.querySelector('span');
    expect(span).toBeTruthy();
    const txt = (span!.textContent || '').replace(/\s+/g, ' ').trim();
    // should include the euro amount 17.00 and a negative sign
    expect(txt).toContain('€17.00');
    expect(txt.includes('-')).toBeTruthy();
  });
});
