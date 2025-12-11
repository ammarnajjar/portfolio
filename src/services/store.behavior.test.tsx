import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { StoreProvider } from './store'
import { StoreContext } from './store-context'
import { api } from './api'

vi.mock('./api')

describe('store behaviors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('addStock fetches from api and adds item', async () => {
    const wrapper: React.FC<{ children?: React.ReactNode }> = ({ children }) => <StoreProvider>{children}</StoreProvider>
    const { result } = renderHook(() => React.useContext(StoreContext), { wrapper })

    vi.spyOn(api, 'fetchStock').mockResolvedValue({ quote: { symbol: 'FOO', name: 'Foo Inc', isin: 'XX', price: 11, changePercent: 0, currency: 'EUR' }, history: [{ time: '2020-01-01', value: 11 }] })

    await act(async () => {
      await result.current!.addStock('foo', 2, 10)
    })

    expect(result.current!.portfolio.length).toBe(1)
    const it = result.current!.portfolio[0]
    expect(it.symbol).toBe('FOO')
    expect(it.currentPrice).toBe(11)
  })

  it('refreshStock sets error on failure', async () => {
    const wrapper: React.FC<{ children?: React.ReactNode }> = ({ children }) => <StoreProvider>{children}</StoreProvider>
    const { result } = renderHook(() => React.useContext(StoreContext), { wrapper })

    // import an item without fetching
    act(() => {
      result.current!.importPortfolio(JSON.stringify([{ id: 'i10', symbol: 'ERR', qty: 1, avgPrice: 1 }]))
    })

    vi.spyOn(api, 'fetchStock').mockImplementation(async () => { throw new Error('network fail') })

    await act(async () => {
      await result.current!.refreshStock('i10')
    })

    const item = result.current!.portfolio.find(p => p.id === 'i10')!
    expect(item.error).toMatch(/network fail/)
    expect(item.isRefreshing).toBeFalsy()
  })

  it('portfolioHistory aggregates values across items', () => {
    const wrapper: React.FC<{ children?: React.ReactNode }> = ({ children }) => <StoreProvider>{children}</StoreProvider>
    const { result } = renderHook(() => React.useContext(StoreContext), { wrapper })

    const a = [{ time: '2020-01-01', value: 2 }]
    const b = [{ time: '2020-01-01', value: 3 }]

    act(() => {
      result.current!.importPortfolio(JSON.stringify([
        { id: 'h1', symbol: 'A', qty: 2, avgPrice: 1, history: a },
        { id: 'h2', symbol: 'B', qty: 3, avgPrice: 1, history: b }
      ]))
    })

    const hist = result.current!.portfolioHistory
    // For time '2020-01-01': value should be a.value*qty + b.value*qty = 2*2 + 3*3 = 4 + 9 = 13
    const entry = hist.find(h => h.time === '2020-01-01')!
    expect(entry.value).toBe(13)
  })

  it('refreshPortfolio abort clears isRefreshing flags', async () => {
    const wrapper: React.FC<{ children?: React.ReactNode }> = ({ children }) => <StoreProvider>{children}</StoreProvider>
    const { result } = renderHook(() => React.useContext(StoreContext), { wrapper })

    act(() => {
      result.current!.importPortfolio(JSON.stringify([{ id: 'a1', symbol: 'X', qty: 1, avgPrice: 1 }]))
    })

    // mock fetchStock to respect abort signal
    vi.spyOn(api, 'fetchStock').mockImplementation((symbol: string, _range?: unknown, signal?: AbortSignal) => {
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => {
          resolve({ quote: { symbol, name: 'Name', isin: 'ISIN', price: 1, changePercent: 0, currency: 'EUR' }, history: [{ time: '2020-01-01', value: 1 }] })
        }, 50)
        if (signal) signal.addEventListener('abort', () => { clearTimeout(t); const err = new Error('AbortError'); err.name = 'AbortError'; reject(err); })
      })
    })

    // Start refresh and immediately stop it
    let refreshPromise: Promise<void>
    await act(async () => {
      refreshPromise = result.current!.refreshPortfolio()
      // stop refresh right away
      result.current!.stopRefresh?.()
      try { await refreshPromise } catch { /* ignored */ }
    })

    // All items should have isRefreshing false
    for (const p of result.current!.portfolio) expect(p.isRefreshing).not.toBeTruthy()
  })
})
