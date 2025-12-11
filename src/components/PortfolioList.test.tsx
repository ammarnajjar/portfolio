import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, vi, expect } from 'vitest'

vi.mock('../services/useStore', () => {
  return {
    useStore: () => ({
      portfolio: [],
      removeStock: vi.fn(),
      addStock: vi.fn(),
      refreshPortfolio: vi.fn(),
      refreshStock: vi.fn()
    })
  }
})

import { PortfolioList } from './PortfolioList'

describe('PortfolioList (empty)', () => {
  it('shows empty state and disabled buttons', () => {
    render(<PortfolioList />)

    expect(screen.getByText(/Your portfolio is empty/i)).toBeInTheDocument()
    const refresh = screen.getByRole('button', { name: /Refresh All/i })
    const exportBtn = screen.getByRole('button', { name: /Export CSV/i })
    const importBtn = screen.getByRole('button', { name: /Import CSV/i })

    expect(refresh).toBeDisabled()
    expect(exportBtn).toBeDisabled()
    expect(importBtn).toBeEnabled()
  })
})
