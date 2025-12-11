import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, vi, expect } from 'vitest'

// Mock the store used in Layout
vi.mock('../services/useStore', () => {
  return {
    useStore: () => ({
      totalValue: 1000,
      totalCost: 800,
      totalGain: 200,
      totalGainPercent: 25,
      portfolio: []
    })
  }
})

import { Layout } from './Layout'

describe('Layout', () => {
  it('renders header and children', () => {
    render(
      <Layout>
        <div>child content</div>
      </Layout>
    )

    expect(screen.getByText('Portfolio Tracker')).toBeInTheDocument()
    expect(screen.getByText('child content')).toBeInTheDocument()
  })
})
