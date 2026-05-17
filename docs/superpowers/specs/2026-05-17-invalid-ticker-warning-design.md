# Invalid Ticker Warning — Design Spec

**Date:** 2026-05-17  
**Status:** Approved

## Problem

Yahoo Finance returns HTTP 200 for unknown/mistyped tickers (e.g. "APPL" instead of "AAPL"). The quoteSummary result has no `longName` and no `regularMarketPrice`, so all metrics score as N/A. The user sees a card full of N/A rows with no explanation.

## Goal

When a ticker resolves to no real stock, show an amber warning banner inside the card and suppress the metrics table. The user can remove the card and try again with the correct ticker.

## Detection Heuristic

In `fetchFundamentals`, after parsing the quoteSummary result, check:

- `pr.longName` is absent (falsy), **AND**
- `pr.regularMarketPrice` is null (no market price)

If both conditions are true, set `warning: "Symbol not recognised — check the ticker and try again"` on the returned result. The metrics are still computed (they'll all be N/A), but the caller can use the `warning` field to decide how to render the card.

This heuristic is reliable: a real, actively-traded stock always has both a `longName` and a current price in Yahoo Finance's quoteSummary.

## Data Model Changes

### `FetchFundamentalsResult` (`watchlist-api.ts`)

Add optional field:

```ts
warning?: string;
```

### `WatchlistItem` (`watchlist-types.ts`)

Add field alongside existing `error`:

```ts
warning: string | null;
```

Default value: `null`.

## Store Changes (`watchlist-store.tsx`)

When `fetchFundamentals` resolves, map `result.warning ?? null` onto the item's `warning` field. No other store logic changes — `warning` is not a loading or error state, it coexists with a loaded item.

## UI Changes (`WatchlistCard.tsx`)

Render priority (top to bottom):

1. Loading spinner — when `item.isLoading`
2. Red error banner — when `item.error`
3. **Amber warning banner** — when `item.warning` (new)
4. Metrics table — when none of the above

Warning banner markup mirrors the existing error banner, using `amber-500` colours:

```
bg-amber-500/20 border border-amber-500/40 rounded-lg text-amber-300
```

When the warning is shown the metrics table is hidden. The remove button remains visible so the user can dismiss the card.

## Testing

- `watchlist-api.test.ts`: Add a test with a fixture where `price.longName` is absent and `price.regularMarketPrice` is absent — assert `result.warning` is set.
- `WatchlistCard.test.tsx`: Add a test that renders a card with `warning` set and asserts the amber banner is visible and the metrics table is absent.

## Files Touched

| File | Change |
|------|--------|
| `src/watchlist/watchlist-types.ts` | Add `warning: string \| null` to `WatchlistItem` |
| `src/watchlist/watchlist-api.ts` | Detect unknown symbol, set `warning` on result |
| `src/watchlist/watchlist-store.tsx` | Map `warning` onto item after fetch |
| `src/watchlist/WatchlistCard.tsx` | Render amber warning banner, hide metrics when warning set |
| `src/watchlist/watchlist-api.test.ts` | Add unknown-symbol fixture test |
| `src/watchlist/WatchlistCard.test.tsx` | Add warning-banner render test |
