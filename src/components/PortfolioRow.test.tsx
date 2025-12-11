import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, vi, expect } from 'vitest'

import { PortfolioRow } from './PortfolioList/PortfolioRow'
import type { PortfolioItem } from '../services/store-types'

const makeItem = (overrides: Partial<PortfolioItem> = {}): PortfolioItem => ({
  id: '1',
  symbol: 'AAPL',
  name: 'Apple Inc',
  isin: 'US0378331005',
  qty: 10,
  avgPrice: 100,
  currentPrice: 120,
  lastUpdated: new Date().toISOString(),
  ...overrides,
})

describe('PortfolioRow', () => {
  it('shows values and calls handlers', () => {
    const item = makeItem()
    const mockRefresh = vi.fn()
    const mockRemove = vi.fn()

    render(<table><tbody><PortfolioRow item={item} refreshStock={mockRefresh} removeStock={mockRemove} /></tbody></table>)

    expect(screen.getByText('AAPL')).toBeInTheDocument()
    const refresh = screen.getByTitle('Refresh Quote')
    fireEvent.click(refresh)
    expect(mockRefresh).toHaveBeenCalledWith('1')

    const remove = screen.getByLabelText(/Remove AAPL/i)
    fireEvent.click(remove)
    expect(mockRemove).toHaveBeenCalledWith('1')
  })

  it('renders error tooltip when item.error present', () => {
    const item = makeItem({ error: 'Fetch failed' })
    render(<table><tbody><PortfolioRow item={item} refreshStock={vi.fn()} removeStock={vi.fn()} /></tbody></table>)

    expect(screen.getByText(/Fetch failed/i)).toBeInTheDocument()
  })
})
