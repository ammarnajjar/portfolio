# Watchlist Warning Banner — Design Spec

**Date:** 2026-05-17  
**Status:** Implemented

## Problem

Three situations produce a bad user experience when adding a ticker to the watchlist:

1. **Mistyped ticker** — Yahoo Finance returns HTTP 200 with no `longName` and no `regularMarketPrice`. The user sees a card full of N/A rows with no explanation.
2. **Unknown ticker (404)** — Yahoo returns HTTP 404 with a "Not Found" error body. The user sees a stuck red error card with the unhelpful message "HTTP error 404".
3. **Duplicate ticker** — The same ticker is added twice, producing two identical cards.

## Goal

For all three cases: show a dismissible amber warning banner at the top of the watchlist panel and do not add (or retain) a card. The input is cleared so the user can try again.

## Detection

### Unrecognised symbol — empty result (HTTP 200)

In `fetchFundamentals`, after parsing the quoteSummary result:

- `pr.longName` is absent (falsy), **AND**
- `pr.regularMarketPrice` is null

→ Return `warning: "Symbol not recognised — check the ticker and try again"`.

### Unrecognised symbol — Not Found (HTTP 4xx)

When the proxy returns a non-2xx response, read the body and check:

- `quoteSummary.error.code === "Not Found"`, OR
- description contains "not found"

→ Return same warning instead of throwing.

Other non-2xx responses with a Yahoo error description surface that description as a thrown error. Generic HTTP errors fall back to "HTTP error N".

### Duplicate ticker

In `addItem` (store), before creating the placeholder, check whether any existing item has a matching `input` or `symbol` (case-insensitive).

→ Throw `"<TICKER> is already in your watchlist"` immediately (no placeholder created).

## Data Model

### `FetchFundamentalsResult` (`watchlist-api.ts`)

```ts
warning?: string;
```

`WatchlistItem` is **not** changed — warnings are never persisted to localStorage.

## Store Changes (`watchlist-store.tsx`)

- **Duplicate check:** at the top of `addItem`, before creating the placeholder. Throws immediately if duplicate found.
- **Warning result:** when `fetchFundamentals` resolves with `warning` set, remove the loading placeholder and re-throw the warning message.
- Genuine API errors still update the item with an `error` field as before.

## UI Changes (`WatchlistView.tsx`)

`WatchlistView` owns a local `warning` state string. In `handleSubmit`, any caught error sets `warning` and clears the input. Success clears both.

A dismissible amber banner renders above the add form:

```
bg-amber-500/20 border border-amber-500/40 rounded-lg text-amber-300
```

The banner has a ✕ dismiss button (`aria-label="Dismiss"`). Submitting a new ticker also clears the previous warning.

`WatchlistCard` is unchanged — warning state never reaches the card layer.

## Testing

All covered by `e2e/watchlist.spec.ts`:

| Test | Scenario |
|------|----------|
| Warning banner for unrecognised ticker | Intercepts proxy, returns no-name/no-price fixture — asserts amber banner, empty state, dismiss button |
| Duplicate ticker warning | Pre-seeds MSFT, adds MSFT again — asserts "already in your watchlist" banner, only one card |

## Files Touched

| File | Change |
|------|--------|
| `src/watchlist/watchlist-api.ts` | Detect empty result + 404 Not Found, return `warning`; `emptyFundamentals()` helper |
| `src/watchlist/watchlist-store.tsx` | Duplicate check in `addItem`; remove placeholder and re-throw on warning |
| `src/watchlist/WatchlistView.tsx` | Own `warning` state, render dismissible amber banner for all caught errors |
| `e2e/watchlist.spec.ts` | E2E tests for warning banner (unrecognised ticker + duplicate) |
