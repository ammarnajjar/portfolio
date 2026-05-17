# Portfolio Summary Card Tab Scope — Design Spec

**Date:** 2026-05-17
**Status:** Implemented

## Problem

The "Total Portfolio Value" summary card in `src/App.tsx` rendered unconditionally — it was always visible regardless of which tab (Portfolio or Watchlist) was active. This meant the portfolio total appeared at the top of the Watchlist page, which was confusing and irrelevant in that context.

## Solution

Gate the summary card behind the `activeTab === "portfolio"` condition so it only renders on the Portfolio tab.

## Implementation

Change in `src/App.tsx` — wrap the summary card JSX with the tab condition:

```tsx
{activeTab === "portfolio" && <div className="glass-panel p-6 ...">
  ...Total Portfolio Value...
</div>}
```

## Files Touched

| File | Change |
|------|--------|
| `src/App.tsx` | Wrapped summary card in `{activeTab === "portfolio" && ...}` |
