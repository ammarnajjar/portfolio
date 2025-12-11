import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { StoreProvider } from './store'
import { api } from './api'
import type { Range } from './ranges'
import { StoreContext } from './store-context'

vi.mock('./api')

describe('refresh caching behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('always fetches 1M even if in fetchedRanges and skips other ranges unless force', async () => {
    const wrapper: React.FC<{ children?: React.ReactNode }> = ({ children }) => <StoreProvider>{children}</StoreProvider>
    const { result } = renderHook(() => React.useContext(StoreContext), { wrapper })

    // import an item with fetchedRanges containing '1M' and '1Y'
    act(() => {
      result.current!.importPortfolio(JSON.stringify([{ id: 'i1', symbol: 'ONE', qty: 1, avgPrice: 1, fetchedRanges: ['1M','1Y'] }]))
    })

    const spy = vi.spyOn(api, 'fetchStock').mockImplementation(async (symbol: string, _rangeOrSignal?: Range | AbortSignal) => {
      void _rangeOrSignal
      return { quote: { symbol, name: 'X', isin: 'XX', price: 1, changePercent: 0, currency: 'EUR' }, history: [{ time: '2020-01-01', value: 1 }] }
    })

    // Set selectedRange to 1M and call refreshPortfolio. 1M should always fetch so spy called once.
    await act(async () => {
      result.current!.setSelectedRange('1M' as Range)
    })
    await act(async () => {
      await result.current!.refreshPortfolio()
    })
    expect(spy).toHaveBeenCalledTimes(1)

    spy.mockClear()

    // Set selectedRange to 1Y and call refreshPortfolio. should skip because 1Y was in fetchedRanges
    await act(async () => {
      result.current!.setSelectedRange('1Y' as Range)
    })
    await act(async () => {
      await result.current!.refreshPortfolio()
    })
    expect(spy).toHaveBeenCalledTimes(0)

    // Force refresh should call
    await act(async () => {
      await result.current!.refreshPortfolio({ force: true })
    })
    expect(spy).toHaveBeenCalled()

    spy.mockRestore()
  })
})
