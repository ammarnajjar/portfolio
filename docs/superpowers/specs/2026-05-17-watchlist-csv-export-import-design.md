# Watchlist CSV Export/Import — Design Spec

**Date:** 2026-05-17
**Status:** Implemented

## Feature

Export CSV and Import CSV buttons in the watchlist panel header allow users to back up their watchlist and restore it across sessions or devices. On import, metrics are fetched fresh for each ticker via the normal `addItem` flow.

## CSV Format

Semicolon-delimited, 3 columns:

```
Symbol;Name;ISIN
AAPL;"Apple Inc.";US0378331005
MSFT;"Microsoft Corporation";
```

- Name is always quoted (handles names containing semicolons or double-quotes).
- Double-quotes in names are escaped as `""` (RFC 4180-style).
- ISIN column is optional — empty string if not available.
- Import also accepts symbol-only rows with no header (one symbol per line).

## Export

- Triggered by "Export CSV" button (disabled when watchlist is empty).
- Filename: `watchlist-YYYY-MM-DD.csv`.
- ISIN column is populated when `item.input` matches `ISIN_REGEX` (exported from `watchlist-api.ts`); otherwise left blank.
- Metrics, prices, and fundamentals are NOT exported — always re-fetched on import.

## Import

- Triggered by "Import CSV" button → opens a hidden `<input type="file" accept=".csv">` via `useRef`.
- Button shows "Importing..." and is disabled while the import loop runs.
- Parses CSV via `parseWatchlistCSV` (handles header auto-detection, quoted fields, blank lines).
- For each row, calls `addItem(row.isin ?? row.symbol)` — reuses the existing fetch + duplicate-check flow.
- Duplicate rows are silently skipped (counted).
- Unrecognised tickers are silently skipped (counted).
- A dismissible green success banner shows the result after completion:
  - `"Imported N items."` — all succeeded
  - `"Imported N items — M skipped (already in watchlist or not recognised)."` — some skipped

## Key implementation details

- `ISIN_REGEX` is exported from `watchlist-api.ts` and shared between the API layer and the export handler.
- `addItem` duplicate check uses a `itemsRef` (`React.useRef`) kept in sync with `items` state, so sequential awaits during CSV import see up-to-date state rather than a stale closure.

## Files

| File | Responsibility |
|------|----------------|
| `src/watchlist/watchlist-csv.ts` | `WatchlistCSVRow`, `generateWatchlistCSV`, `downloadWatchlistCSV`, `parseWatchlistCSV` |
| `src/watchlist/watchlist-csv.test.ts` | 9 unit tests for CSV service (including double-quote round-trip) |
| `src/watchlist/watchlist-api.ts` | Exports `ISIN_REGEX` shared constant |
| `src/watchlist/watchlist-store.tsx` | `itemsRef` for reliable duplicate check during sequential async import |
| `src/watchlist/WatchlistView.tsx` | Export/Import buttons, file input ref, `isImporting` state, success banner |
| `e2e/watchlist.spec.ts` | E2E tests: export download + import flow |
