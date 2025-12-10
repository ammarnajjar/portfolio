 # Portfolio Tracker

A small, lightweight single-page application to track a personal investment portfolio. Built with React + Vite + TypeScript and designed for quick local development, testing, and GitHub Pages deployment.

## Key Features

- Track holdings with symbol/ISIN, quantity, average price, and current price.
- Per-asset refresh: refresh a single holding and see a per-row spinner and last-updated timestamp.
- Bulk refresh: refresh all holdings in small batches to avoid rate limits.
- Import / Export CSV with flexible header detection (supports Symbol/Qty/Price and extended headers including LastUpdated and GainLoss).
- Per-item metadata persisted to `localStorage` so your portfolio survives browser reloads.
- Small chart summarizing portfolio history using `lightweight-charts`.
- Unit tests with Vitest + Testing Library and linting with ESLint.

## CSV Import/Export

- Export: the Export CSV button downloads a semicolon-separated CSV with headers: `Symbol;Name;ISIN;Quantity;AvgPrice;LastUpdated;GainLoss`.
- Import: the parser is flexible and detects common header names. It accepts both minimal (`Symbol;Qty;Price`) and extended rows. If `GainLoss` is provided the importer will estimate `currentPrice` for the item so the app displays value/gain immediately without fetching live quotes.

## Contributing

PRs are welcome. For non-trivial changes, please open an issue first to discuss the approach.

## License

This project is licensed under the MIT License - see the `LICENSE` file for details.
