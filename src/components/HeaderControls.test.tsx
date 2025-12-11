import { render, screen } from '@testing-library/react'
import { describe, it, vi, expect } from 'vitest'

import { HeaderControls } from './PortfolioList/HeaderControls'

describe('HeaderControls', () => {
  it('renders buttons and disables when loading', () => {
    const mockRefresh = vi.fn()
    const mockForce = vi.fn()
    const mockExport = vi.fn()
    const mockImportClick = vi.fn()
    const mockExportJson = vi.fn()
    const mockImportJsonClick = vi.fn()

    render(
      <HeaderControls
        portfolioLength={2}
        onRefreshAll={mockRefresh}
        onForceRefresh={mockForce}
        onExportCSV={mockExport}
        onImportCSVClick={mockImportClick}
        onExportJSON={mockExportJson}
        onImportJSONClick={mockImportJsonClick}
        fileInputRef={{ current: null }}
        jsonFileInputRef={{ current: null }}
        onCSVFileChange={async () => {}}
        onJSONFileChange={async () => {}}
        isLoading={true}
      />
    )

    const refresh = screen.getByRole('button', { name: /Refresh All/i })
    expect(refresh).toBeDisabled()

    const exportBtn = screen.getByRole('button', { name: /Export CSV/i })
    expect(exportBtn).toBeEnabled()
  })
})
