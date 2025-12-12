import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { StoreProvider } from './store'
import { api } from './api'
import type { Range } from './ranges'
import { StoreContext } from './store-context'

vi.mock('./api')

describe('fetchedRanges persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('records 1M in fetchedRanges after refreshPortfolio for DEFAULT_RANGE', async () => {
    const wrapper: React.FC<{ children?: React.ReactNode }> = ({ children }) => <StoreProvider>{children}</StoreProvider>
    const { result } = renderHook(() => React.useContext(StoreContext), { wrapper })

    // import an item without fetchedRanges
    act(() => {
      result.current!.importPortfolio(JSON.stringify([{ id: 'i1', symbol: 'ONE', qty: 1, avgPrice: 1 }]))
    })

    const spy = vi.spyOn(api, 'fetchStock').mockImplementation(async (symbol: string, _rangeOrSignal?: Range | AbortSignal) => {
      void _rangeOrSignal
      return { quote: { symbol, name: 'X', isin: 'XX', price: 1, changePercent: 0, currency: 'EUR' }, history: [{ time: '2025-11-01', value: 1 }] }
    })

    // Ensure selectedRange is 1M and call refreshPortfolio
    await act(async () => {
      result.current!.setSelectedRange('1M' as Range)
    })
    await act(async () => {
      await result.current!.refreshPortfolio()
    })

    // After refresh, the stored portfolio item should include '1M' in fetchedRanges
    const p = result.current!.portfolio.find(x => x.id === 'i1')!
    expect(Array.isArray(p.fetchedRanges)).toBeTruthy()
    expect(p.fetchedRanges).toContain('1M')

    spy.mockRestore()
  })

  it('records 1M in fetchedRanges after refreshStock when selectedRange is 1M', async () => {
    const wrapper: React.FC<{ children?: React.ReactNode }> = ({ children }) => <StoreProvider>{children}</StoreProvider>
    const { result } = renderHook(() => React.useContext(StoreContext), { wrapper })

    act(() => {
      result.current!.importPortfolio(JSON.stringify([{ id: 's1', symbol: 'ABC', qty: 2, avgPrice: 10 }]))
    })

    const spy = vi.spyOn(api, 'fetchStock').mockImplementation(async (symbol: string, _rangeOrSignal?: Range | AbortSignal) => {
      void _rangeOrSignal
      return { quote: { symbol, name: 'Q', isin: 'QQ', price: 5, changePercent: 0, currency: 'EUR' }, history: [{ time: '2025-11-01', value: 5 }] }
    })

    // select 1M and refresh a single stock
    await act(async () => {
      result.current!.setSelectedRange('1M' as Range)
    })
    await act(async () => {
      await result.current!.refreshStock('s1')
    })

    const item = result.current!.portfolio.find(x => x.id === 's1')!
    expect(Array.isArray(item.fetchedRanges)).toBeTruthy()
    expect(item.fetchedRanges).toContain('1M')

    spy.mockRestore()
  })
})
