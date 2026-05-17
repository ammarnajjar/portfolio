# Watchlist Refresh All — Design Spec

**Date:** 2026-05-17
**Status:** Implemented

## Feature

A "Refresh All" icon button in the watchlist panel header lets the user re-fetch fundamentals and metrics for every stock in the watchlist with a single click.

## Behaviour

- Button is a circular icon button (same refresh arrow SVG as the Portfolio "Refresh Prices" button).
- Positioned at the far right of the header toolbar, after Export CSV and Import CSV.
- Disabled when the watchlist is empty or an import is in progress.
- While refreshing, the icon spins (`animate-spin`); the button remains clickable to avoid blocking the UI.
- All items are refreshed in parallel (`Promise.all`).
- Tooltip: "Refresh All".

## Implementation

### `watchlist-types.ts`
Added `refreshAll: () => Promise<void>` to `WatchlistState`.

### `watchlist-store.tsx`
```ts
const refreshAll = async () => {
  await Promise.all(itemsRef.current.map((it) => refreshItem(it.id)));
};
```
Uses `itemsRef.current` (not `items`) to avoid stale closure — same pattern used by `addItem` duplicate check.

### `WatchlistView.tsx`
- Added `isRefreshingAll` state and `handleRefreshAll` handler.
- Added the icon button at the rightmost position in the header toolbar.

## Files Touched

| File | Change |
|------|--------|
| `src/watchlist/watchlist-types.ts` | Added `refreshAll` to `WatchlistState` interface |
| `src/watchlist/watchlist-store.tsx` | Implemented `refreshAll` via `Promise.all` over `refreshItem` |
| `src/watchlist/WatchlistView.tsx` | Added `isRefreshingAll` state, handler, and icon button |
