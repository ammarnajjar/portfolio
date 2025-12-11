import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { StoreProvider } from './store'
import { api } from './api'
import { StoreContext } from './store-context'

vi.mock('./api')

describe('store updates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('addStock without fetching adds item and updates totalValue', async () => {
    const wrapper: React.FC<{ children?: React.ReactNode }> = ({ children }) => <StoreProvider>{children}</StoreProvider>
    const { result } = renderHook(() => React.useContext(StoreContext), { wrapper })

    // start empty
    expect(result.current!.portfolio).toHaveLength(0)
    expect(result.current!.totalValue).toBe(0)

    await act(async () => {
      await result.current!.addStock('XYZ', 3, 10, { fetchQuote: false })
    })

    // portfolio should include the new item
    expect(result.current!.portfolio).toHaveLength(1)
    const it = result.current!.portfolio[0]
    expect(it.symbol).toBe('XYZ')
    // totalValue should use avgPrice when currentPrice is not set
    expect(result.current!.totalValue).toBe(3 * 10)
  })

  it('refreshStock updates currentPrice and history for an item', async () => {
    const wrapper: React.FC<{ children?: React.ReactNode }> = ({ children }) => <StoreProvider>{children}</StoreProvider>
    const { result } = renderHook(() => React.useContext(StoreContext), { wrapper })

    // Add item without fetching
    act(() => {
      result.current!.importPortfolio(JSON.stringify([{ id: 'i-refresh', symbol: 'REF', qty: 2, avgPrice: 5 }]))
    })

    // Mock api.fetchStock to return updated price and history
    const spy = vi.spyOn(api, 'fetchStock').mockImplementation(async (symbol: string) => {
      return { quote: { symbol, name: 'Ref', isin: 'XX', price: 8, changePercent: 0, currency: 'EUR' }, history: [{ time: '2025-01-01', value: 8 }] }
    })

    await act(async () => {
      await result.current!.refreshStock('i-refresh')
    })

    const updated = result.current!.portfolio.find(p => p.id === 'i-refresh')!
    expect(updated.currentPrice).toBe(8)
    expect(Array.isArray(updated.history)).toBeTruthy()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('removeStock updates totalValue', async () => {
    const wrapper: React.FC<{ children?: React.ReactNode }> = ({ children }) => <StoreProvider>{children}</StoreProvider>
    const { result } = renderHook(() => React.useContext(StoreContext), { wrapper })

    // add two items quickly
    act(() => {
      result.current!.importPortfolio(JSON.stringify([
        { id: 'r1', symbol: 'A', qty: 1, avgPrice: 10, currentPrice: 12 },
        { id: 'r2', symbol: 'B', qty: 2, avgPrice: 5, currentPrice: 6 }
      ]))
    })

    expect(result.current!.totalValue).toBe(1*12 + 2*6)

    act(() => {
      result.current!.removeStock('r1')
    })

    expect(result.current!.totalValue).toBe(2*6)
  })
})
