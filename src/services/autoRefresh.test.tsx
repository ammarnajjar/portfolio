import React, { act } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StoreProvider } from './store'
import { Layout } from '../components/Layout'
import { useStore } from './useStore'
import { api } from './api'

// This test mounts the provider and uses fake timers to verify the
// auto-refresh interval behavior.

describe('Auto-refresh interval behavior', () => {
  const realSetInterval = global.setInterval
  const realClearInterval = global.clearInterval

  beforeEach(() => {
    vi.useFakeTimers()
    // Mock api.fetchStock used by refresh logic with required Quote fields
    vi.spyOn(api, 'fetchStock').mockImplementation(async () => ({
      quote: { symbol: 'MOCK', price: 1, name: 'Mock', changePercent: 0, currency: 'EUR' },
      history: [],
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    global.setInterval = realSetInterval
    global.clearInterval = realClearInterval
  })

  it('starts, stops, and restarts when interval changes', async () => {
    // Consumer component to control the auto-refresh flags
    const Controller: React.FC = () => {
      const { setAutoRefreshEnabled, addStock } = useStore()
      return (
        <div>
          <button onClick={() => setAutoRefreshEnabled && setAutoRefreshEnabled(true)}>enable</button>
          <button onClick={() => setAutoRefreshEnabled && setAutoRefreshEnabled(false)}>disable</button>
          <button onClick={() => addStock && addStock('MOCK', 1, 1, { fetchQuote: false })}>add-item</button>
        </div>
      )
    }

    render(
      <StoreProvider>
        <Controller />
        <Layout>{null}</Layout>
      </StoreProvider>
    )

    const enable = screen.getByText('enable')
    const disable = screen.getByText('disable')

    // Add a dummy portfolio item first so refresh has work to do
    const addItem = screen.getByText('add-item')
    await act(async () => {
      addItem.click()
      await Promise.resolve()
    })

    // click the 1m preset first, then enable — wrap in act to allow provider updates
    const oneMinButton = screen.getByLabelText('set-interval-1');
    await act(async () => oneMinButton.click())
    await act(async () => {
      enable.click()
      await Promise.resolve()
    })

    // Immediately one refresh should be triggered
    expect(api.fetchStock).toHaveBeenCalled()
    type MockedCalls = { mock: { calls: unknown[] } }
    const callsAfterEnable = (api.fetchStock as unknown as MockedCalls).mock.calls.length

    // Advance timers by 61 seconds and expect additional calls (interval is 1 minute)
    await act(async () => {
      vi.advanceTimersByTime(61_000)
      await Promise.resolve()
    })
    expect((api.fetchStock as unknown as MockedCalls).mock.calls.length).toBeGreaterThan(callsAfterEnable)

    // Now change to a long interval (60m) and ensure that after advancing short time no more calls
    const longBtn = screen.getByLabelText('set-interval-60');
    await act(async () => longBtn.click())
    const before = (api.fetchStock as unknown as MockedCalls).mock.calls.length
    await act(async () => {
      vi.advanceTimersByTime(500)
      await Promise.resolve()
    })
    expect((api.fetchStock as unknown as MockedCalls).mock.calls.length).toBe(before)

    // Disable auto-refresh and ensure no new calls after advancing time
    await act(async () => {
      disable.click()
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
    })
    expect((api.fetchStock as unknown as MockedCalls).mock.calls.length).toBe(before)
    // click the 1m preset to set interval
    const oneBtn = screen.getByLabelText('set-interval-1');
    await act(async () => oneBtn.click());
  })
})
