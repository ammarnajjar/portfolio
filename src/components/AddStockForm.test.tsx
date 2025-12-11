import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { describe, it, vi, expect } from 'vitest'

const addStockMock = vi.fn(() => Promise.resolve())

vi.mock('../services/useStore', () => {
  return {
    useStore: () => ({
      addStock: addStockMock,
      isLoading: false
    })
  }
})

import { AddStockForm } from './AddStockForm'

describe('AddStockForm', () => {
  it('submits and clears inputs', async () => {
    render(<AddStockForm />)

    const symbol = screen.getByPlaceholderText(/Symbol or ISIN/i)
    const qty = screen.getByPlaceholderText(/Quantity/i)
    const price = screen.getByPlaceholderText(/Avg Price/i)
    const submit = screen.getByRole('button', { name: /Add Asset/i })

    await act(async () => {
      await userEvent.type(symbol, 'AAPL')
      await userEvent.type(qty, '2')
      await userEvent.type(price, '150')
      await userEvent.click(submit)
      // wait for promise resolution
      await new Promise((r) => setTimeout(r, 10))
    })

    expect(addStockMock).toHaveBeenCalledWith('AAPL', 2, 150)
    expect((symbol as HTMLInputElement).value).toBe('')
    expect((qty as HTMLInputElement).value).toBe('')
    expect((price as HTMLInputElement).value).toBe('')
  })
})
