# Portfolio Tracker — Documentation

A lightweight single-page application for tracking a personal investment portfolio. Built with React 19, TypeScript, and Vite. Deploys to GitHub Pages with no backend required.

---

## Contents

| Document | What it covers |
|---|---|
| [Architecture](./architecture.md) | Project structure, state management, component tree, data flow |
| [Data & API](./data-api.md) | Yahoo Finance integration, ISIN resolution, FX conversion, caching |
| [Development Guide](./development.md) | Setup, scripts, testing, deployment, configuration |
| [Stock Metrics Reference](./stock-metrics-reference.md) | Fundamental analysis thresholds for evaluating holdings |

---

## Quick Summary

| Attribute | Value |
|---|---|
| Framework | React 19.2 + TypeScript 5.9 |
| Build | Vite 7.2 |
| Styling | Tailwind CSS 4.1 |
| Charts | lightweight-charts 5.0 |
| Storage | Browser localStorage (no backend) |
| Data source | Yahoo Finance (via CORS proxy) |
| Deployment | GitHub Pages |
| Tests | Vitest + React Testing Library |

---

## Feature Overview

**Holdings management**
- Add stocks and ETFs by ticker symbol or ISIN
- Track quantity, average purchase price, current price, and gain/loss
- Per-item refresh with spinner and last-updated timestamp
- Delete individual holdings

**Price data**
- Live price fetch from Yahoo Finance
- Automatic currency conversion to EUR
- British pence (GBp) conversion handled automatically
- Retry logic with exponential backoff (up to 3 attempts)

**Historical charting**
- Portfolio-level performance chart
- Range selector: 1D, 1W, 1M, 3M, 1Y, 5Y
- Per-item range caching — avoids redundant network fetches
- Smart history check: skips fetch if stored candles already cover the requested range

**Auto-refresh**
- Configurable interval: 1, 5, 15, or 60 minutes (default: 5 min)
- Batch processing: 3 items concurrently with 500ms delay between batches
- Cancellable via stop button (AbortController)

**Import / Export**
- CSV export (semicolon-separated) and flexible CSV import
- Full JSON export and import (includes history and cached range metadata)

**Persistence**
- All portfolio data survives browser reloads via localStorage
- UI preferences (chart/table/breakdown visibility) stored separately
