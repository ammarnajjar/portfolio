# Invalid Ticker Warning — Design Spec

**Date:** 2026-05-17  
**Status:** Implemented

## Problem

Yahoo Finance returns HTTP 200 for unknown/mistyped tickers (e.g. "APPL" instead of "AAPL"). The quoteSummary result has no `longName` and no `regularMarketPrice`, so all metrics score as N/A. The user sees a card full of N/A rows with no explanation.

## Goal

When a ticker resolves to no real stock, show a dismissible amber warning banner at the top of the watchlist panel and do not add a card. The input is cleared so the user can try again with the correct ticker.

## Detection Heuristic

In `fetchFundamentals`, after parsing the quoteSummary result, check:

- `pr.longName` is absent (falsy), **AND**
- `pr.regularMarketPrice` is null (no market price)

If both conditions are true, set `warning: "Symbol not recognised — check the ticker and try again"` on the returned result.

This heuristic is reliable: a real, actively-traded stock always has both a `longName` and a current price in Yahoo Finance's quoteSummary.

## Data Model Changes

### `FetchFundamentalsResult` (`watchlist-api.ts`)

Add optional field:

```ts
warning?: string;
```

`WatchlistItem` is **not** changed — warnings are never persisted to localStorage.

## Store Changes (`watchlist-store.tsx`)

When `fetchFundamentals` resolves with a `warning`:

1. Remove the loading placeholder item immediately (not saved to localStorage).
2. Re-throw the warning message so the caller can surface it.

Genuine API errors (non-warning) still update the item with an `error` field as before.

## UI Changes (`WatchlistView.tsx`)

`WatchlistView` owns a local `warning` state string. In `handleSubmit`:

- On success: clear warning, clear input.
- On caught warning error: set `warning` state, clear input, no card added.

A dismissible amber banner renders above the add form when `warning` is set:

```
bg-amber-500/20 border border-amber-500/40 rounded-lg text-amber-300
```

The banner has a ✕ dismiss button (`aria-label="Dismiss"`). Submitting a new ticker also clears the previous warning.

`WatchlistCard` is unchanged — warning state never reaches the card layer.

## Testing

- `e2e/watchlist.spec.ts`: Playwright test intercepts `/api/yahoo-quotesummary` to return a no-name/no-price fixture, asserts the amber banner appears, the empty state is still shown (no card added), and the dismiss button clears the banner.

## Files Touched

| File | Change |
|------|--------|
| `src/watchlist/watchlist-api.ts` | Detect unknown symbol, set `warning` on result |
| `src/watchlist/watchlist-store.tsx` | Remove placeholder and re-throw on warning |
| `src/watchlist/WatchlistView.tsx` | Own `warning` state, render dismissible amber banner |
| `e2e/watchlist.spec.ts` | E2E test for warning banner behaviour |
