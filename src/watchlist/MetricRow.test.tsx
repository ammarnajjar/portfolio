// src/watchlist/MetricRow.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MetricRow } from './MetricRow';
import type { MetricResult } from './watchlist-types';

const make = (overrides: Partial<MetricResult>): MetricResult => ({
  key: 'pe',
  label: 'P/E Ratio',
  value: 20,
  displayValue: '20.00',
  verdict: 'good',
  note: 'Some note',
  ...overrides,
});

describe('MetricRow', () => {
  it('renders the metric label and display value', () => {
    render(<table><tbody><MetricRow metric={make({})} /></tbody></table>);
    expect(screen.getByText('P/E Ratio')).toBeTruthy();
    expect(screen.getByText('20.00')).toBeTruthy();
  });

  it('renders Good badge for good verdict', () => {
    render(<table><tbody><MetricRow metric={make({ verdict: 'good' })} /></tbody></table>);
    expect(screen.getByText('Good')).toBeTruthy();
  });

  it('renders Caution badge for caution verdict', () => {
    render(<table><tbody><MetricRow metric={make({ verdict: 'caution' })} /></tbody></table>);
    expect(screen.getByText('Caution')).toBeTruthy();
  });

  it('renders Red Flag badge for red verdict', () => {
    render(<table><tbody><MetricRow metric={make({ verdict: 'red' })} /></tbody></table>);
    expect(screen.getByText('Red Flag')).toBeTruthy();
  });

  it('renders N/A badge for na verdict', () => {
    render(<table><tbody><MetricRow metric={make({ verdict: 'na', displayValue: 'N/A' })} /></tbody></table>);
    expect(screen.getByText('N/A')).toBeTruthy();
  });

  it('renders the note text', () => {
    render(<table><tbody><MetricRow metric={make({})} /></tbody></table>);
    expect(screen.getByText('Some note')).toBeTruthy();
  });
});
