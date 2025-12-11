import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { StoreProvider } from './store'
import { mergeHistories } from './store-utils'
import type { Range } from './ranges'
import { StoreContext } from './store-context'
import { api } from './api'
import type { Candle } from './api'

vi.mock('./api')

describe('store logic', () => {
  beforeEach(() => {
    // reset mocks and localStorage
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('mergeHistories merges and sorts by time', () => {
    const a: Candle[] = [ { time: '2020-01-02', value: 2 }, { time: '2020-01-01', value: 1 } ]
    const b: Candle[] = [ { time: '2020-01-03', value: 3 }, { time: '2020-01-02', value: 20 } ]
    const merged = mergeHistories(a, b)
    expect(merged.map(m => m.time)).toEqual(['2020-01-01','2020-01-02','2020-01-03'])
    // incoming should overwrite existing where time equals
    expect(merged.find(m => m.time === '2020-01-02')!.value).toBe(20)
  })

  it('exportPortfolio and importPortfolio preserve items', () => {
    const wrapper: React.FC<{ children?: React.ReactNode }> = ({ children }) => <StoreProvider>{children}</StoreProvider>
    const { result } = renderHook(() => React.useContext(StoreContext), { wrapper })

    // Initially empty
    expect(result.current!.portfolio).toHaveLength(0)

    // Use addStock without fetching (via importPortfolio directly)
    const json = JSON.stringify([{ id: 'i1', symbol: 'X', qty: 1, avgPrice: 10 }])
    act(() => {
      const count = result.current!.importPortfolio(json)
      expect(count).toBe(1)
    })

    const exported = result.current!.exportPortfolio()
    const parsed = JSON.parse(exported)
    expect(Array.isArray(parsed)).toBeTruthy()
    expect(parsed[0].symbol).toBe('X')
  })

  it('importPortfolio throws for invalid JSON and bad items', () => {
    const wrapper: React.FC<{ children?: React.ReactNode }> = ({ children }) => <StoreProvider>{children}</StoreProvider>
    const { result } = renderHook(() => React.useContext(StoreContext), { wrapper })

    // invalid JSON
    expect(() => result.current!.importPortfolio('not-json')).toThrow()

    // not an array
    expect(() => result.current!.importPortfolio(JSON.stringify({ a: 1 }))).toThrow(/expected an array/)

    // missing symbol
    const bad = JSON.stringify([{ id: 'x' }])
    expect(() => result.current!.importPortfolio(bad)).toThrow(/missing or invalid 'symbol'/)

    // wrong types for qty/avgPrice
    const bad2 = JSON.stringify([{ symbol: 'X', qty: 'nope', avgPrice: 'oops' }])
    expect(() => result.current!.importPortfolio(bad2)).toThrow(/'qty' must be a number/)
  })

  it('refreshPortfolio skips already fetched non-default ranges unless force', async () => {
    // Prepare a provider with one item that already has fetchedRanges containing '1Y'
    const wrapper: React.FC<{ children?: React.ReactNode }> = ({ children }) => <StoreProvider>{children}</StoreProvider>
    const { result } = renderHook(() => React.useContext(StoreContext), { wrapper })

    // Add an item by importing JSON to set initial state
    act(() => {
      result.current!.importPortfolio(JSON.stringify([{ id: 'i2', symbol: 'TST', qty: 1, avgPrice: 5, fetchedRanges: ['1Y'] }]))
    })

    // Spy on api.fetchStock to detect calls
    const spy = vi.spyOn(api, 'fetchStock').mockImplementation(async (symbol: string) => {
      return { quote: { symbol, name: 'Test', isin: 'XX', price: 1, changePercent: 0, currency: 'EUR' }, history: [{ time: '2020-01-01', value: 1 }], }
    })

    // Set selectedRange to '1Y' and call refreshPortfolio (should skip because already fetched)
    // Ensure the selectedRange state update is applied first
    await act(async () => {
      result.current!.setSelectedRange('1Y' as unknown as Range)
    })
    await act(async () => {
      await result.current!.refreshPortfolio()
    })

    // fetchStock should not have been called because the range was already fetched
    expect(spy).toHaveBeenCalledTimes(0)

    // Now force refresh
    await act(async () => {
      await result.current!.refreshPortfolio({ force: true })
    })

    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
