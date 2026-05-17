# Watchlist Item Count Badge — Design Spec

**Date:** 2026-05-17
**Status:** Implemented

## Feature

A pill badge showing the number of items appears inline next to the "Watchlist" heading. Hidden when the list is empty.

## Implementation

In `src/watchlist/WatchlistView.tsx`, the heading renders a conditional `<span>` badge:

```tsx
<h2 className="text-xl font-bold text-white flex items-center gap-2">
  Watchlist
  {items.length > 0 && (
    <span className="text-sm font-medium text-slate-400 bg-slate-700 px-2 py-0.5 rounded-full">
      {items.length}
    </span>
  )}
</h2>
```

## Files Touched

| File | Change |
|------|--------|
| `src/watchlist/WatchlistView.tsx` | Added count badge to heading |
