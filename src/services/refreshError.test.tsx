import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { StoreProvider } from './store'
import { api } from './api'
import { StoreContext } from './store-context'

vi.mock('./api')

describe('refresh error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('sets error on failed item and clears isRefreshing flags', async () => {
    const wrapper: React.FC<{ children?: React.ReactNode }> = ({ children }) => <StoreProvider>{children}</StoreProvider>
    const { result } = renderHook(() => React.useContext(StoreContext), { wrapper })

    // import two items
    act(() => {
      result.current!.importPortfolio(JSON.stringify([
        { id: 'e1', symbol: 'GOOD', qty: 1, avgPrice: 10 },
        { id: 'e2', symbol: 'BAD', qty: 1, avgPrice: 20 }
      ]))
    })

    // Mock api: GOOD returns data, BAD throws
    const spy = vi.spyOn(api, 'fetchStock').mockImplementation(async (symbol: string, _rangeOrSignal?: any) => {
      if (symbol === 'BAD') throw new Error('Network error')
      return { quote: { symbol, name: 'Ok', isin: 'XX', price: 11, changePercent: 0, currency: 'EUR' }, history: [{ time: '2025-01-01', value: 11 }] }
    })

    // set selected range and refresh
    await act(async () => {
      result.current!.setSelectedRange('1M' as any)
    })

    await act(async () => {
      await result.current!.refreshPortfolio()
    })

    const good = result.current!.portfolio.find(p => p.id === 'e1')!
    const bad = result.current!.portfolio.find(p => p.id === 'e2')!

    expect(good.currentPrice).toBe(11)
    expect(good.isRefreshing).toBeFalsy()

    expect(bad.error).toBeTruthy()
    expect(bad.isRefreshing).toBeFalsy()

    spy.mockRestore()
  })
})
