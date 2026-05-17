# Active Tab Persistence — Design Spec

**Date:** 2026-05-17  
**Status:** Implemented

## Problem

The active tab (Portfolio / Watchlist) resets to "portfolio" on every page reload. Users who navigate to the Watchlist tab and then refresh lose their place.

## Solution

Persist the active tab to `localStorage` under the key `active_tab`. On mount, read it back as the initial state. On tab change, write the new value.

## Implementation

All changes are in `src/App.tsx` — the component that owns `activeTab` state.

```ts
// Read on mount
const [activeTab, setActiveTab] = useState<AppTab>(() => {
  const saved = localStorage.getItem("active_tab");
  return saved === "watchlist" ? "watchlist" : "portfolio";
});

// Write on change
const handleTabChange = (tab: AppTab) => {
  localStorage.setItem("active_tab", tab);
  setActiveTab(tab);
};
```

Any unrecognised or missing value defaults to `"portfolio"`.

## Testing

`e2e/watchlist.spec.ts` — "Active tab persists across page reload":
1. Navigate to Watchlist tab.
2. Reload the page.
3. Assert the Watchlist tab is still active (Add to Watchlist button visible, tab button highlighted).

`beforeEach` now also clears `active_tab` from localStorage to prevent test cross-contamination.

## Files Touched

| File | Change |
|------|--------|
| `src/App.tsx` | Read `active_tab` from localStorage on mount; write on tab change |
| `e2e/watchlist.spec.ts` | Add persistence test; clear `active_tab` in `beforeEach` |
