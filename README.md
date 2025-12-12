 # Portfolio Tracker

A small, lightweight single-page application to track a personal investment portfolio. Built with React + Vite + TypeScript and designed for quick local development, testing, and GitHub Pages deployment.

## Key Features

- Track holdings with symbol/ISIN, quantity, average price, and current price.
- Bulk refresh: refresh all holdings in small batches to avoid rate limits.
- Import / Export CSV with flexible header detection (supports Symbol/Qty/Price and extended headers including LastUpdated and GainLoss).
- Small chart summarizing portfolio history using `lightweight-charts`.
- Per-asset refresh: refresh a single holding and see a per-row spinner and last-updated timestamp.
- Per-item metadata persisted to `localStorage` so your portfolio survives browser reloads.
 - Per-item fetched-range tracking:
	- Each portfolio item stores which ranges have been fetched (e.g. `['3M','1Y']`).
	- This avoids re-fetching the same historical data unless you explicitly refresh an item or select a non-cached range.
 - Range selection on the Portfolio chart: quick buttons for `1D`, `1W`, `1M`, `3M`, `1Y`, and `5Y`.
	- Clicking a range will update the chart and request history for each holding for that period.
	- The app caches fetched ranges per-item to avoid redundant network requests for `1D`, `1W`, `3M`, `1Y`, and `5Y`.
	- The chart also uses a history-based check: if an item's stored `history` already covers the requested cutoff (e.g. the earliest candle is at-or-before the 1M cutoff), the app treats that item as having the range available and will skip the network fetch.
- CSV Import/Export
	- Export: the Export CSV button downloads a semicolon-separated CSV with headers: `Symbol;Name;ISIN;Quantity;AvgPrice;LastUpdated;GainLoss`.
	- Import: the parser is flexible and detects common header names. It accepts both minimal (`Symbol;Qty;Price`) and extended rows. If `GainLoss` is provided the importer will estimate `currentPrice` for the item so the app displays value/gain immediately without fetching live quotes.
- JSON Export / Import (full portfolio):
	- `Export JSON` downloads your full portfolio state as a JSON file (including history and fetched-range metadata).
	- `Import JSON` lets you restore/replace your entire portfolio from a previously exported JSON file.
	- Note: Importing JSON will replace the current portfolio in the app. If you want a merge option or confirmation modal, that can be added.

## Contributing

PRs are welcome. For non-trivial changes, please open an issue first to discuss the approach.

## License

This project is licensed under the MIT License - see the `LICENSE` file for details.
