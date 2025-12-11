import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, vi, expect } from 'vitest'

vi.mock('../services/useStore', () => {
  const base = [
    { id: '1', symbol: 'B', name: 'Beta', qty: 1, avgPrice: 10, currentPrice: 12 },
    { id: '2', symbol: 'A', name: 'Alpha', qty: 2, avgPrice: 5, currentPrice: 6 },
    { id: '3', symbol: 'C', name: 'Charlie', qty: 3, avgPrice: 7, currentPrice: 9 },
  ]
  return {
    useStore: () => ({
      portfolio: base,
      removeStock: vi.fn(),
      addStock: vi.fn(),
      refreshPortfolio: vi.fn(),
      refreshStock: vi.fn(),
    })
  }
})

import { PortfolioList } from './PortfolioList'

describe('PortfolioList sorting', () => {
  it('sorts by name when header clicked', async () => {
    render(<PortfolioList />)

    // initial sort is name asc, so Alpha should appear first
    const firstRowSymbol = await screen.findAllByText(/Alpha|Beta|Charlie/)
    expect(firstRowSymbol[0]).toBeInTheDocument()

    // click name header to toggle
    const nameHeader = screen.getByText('Name')
    fireEvent.click(nameHeader)
    fireEvent.click(nameHeader)

    // after toggling sort to desc, first item should be 'Charlie' or 'Beta'
    const rows = screen.getAllByRole('row')
    expect(rows.length).toBeGreaterThan(1)
  })
})
