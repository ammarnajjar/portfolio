 # Portfolio Tracker

A small, lightweight single-page application to track a personal investment portfolio. Built with React + Vite + TypeScript and designed for quick local development, testing, and GitHub Pages deployment.

## Key Features

### Portfolio

- Track holdings with symbol/ISIN, quantity, average price, and current price.
- Bulk refresh: refresh all holdings in small batches to avoid rate limits.
- Per-asset refresh with per-row spinner and last-updated timestamp.
- Per-item metadata persisted to `localStorage` so your portfolio survives browser reloads.
- Range selection on the Portfolio chart: quick buttons for `1D`, `1W`, `1M`, `3M`, `1Y`, and `5Y`. Fetched ranges are cached per-item to avoid redundant network requests.
- CSV Import/Export — semicolon-separated with headers `Symbol;Name;ISIN;Quantity;AvgPrice;LastUpdated;GainLoss`. Flexible header detection; minimal and extended rows both accepted.
- JSON Export/Import — full portfolio state including history and fetched-range metadata.

### Watchlist

- Track stocks you're researching without adding them to your portfolio.
- Add by ticker symbol (e.g. `AAPL`) or ISIN (e.g. `US0378331005`) — ISINs are auto-resolved to the correct exchange ticker via Yahoo Finance.
- **Fundamentals scoring** across 14 metrics: P/E, PEG, EV/EBITDA, P/B, net/operating/gross margins, ROE, revenue & EPS growth, FCF margin, D/E, current ratio, dividend payout. Each metric gets a **Good / Caution / Red Flag** verdict with contextual notes.
- **Two view modes** toggled by icon buttons in the header:
  - *List view* — full metrics table per stock.
  - *Grid view* — compact color-coded cards (green / amber / red) for a quick at-a-glance overview.
- View mode persists to `localStorage`.
- CSV Export/Import — format: `Symbol;Name;ISIN`. Import re-fetches metrics fresh; duplicates and unrecognised tickers are skipped gracefully.
- Refresh All — re-fetches all items in parallel.
- Sticky control panel — the header with the add form and buttons stays visible while scrolling, correctly positioned below the app nav on all screen sizes.

## Contributing

PRs are welcome. For non-trivial changes, please open an issue first to discuss the approach.

## License

This project is licensed under the MIT License - see the `LICENSE` file for details.
