# Watchlist Sticky Header — Design Spec

**Date:** 2026-05-17
**Status:** Implemented

## Feature

The "Watchlist" control panel (title, view toggle, add form, CSV buttons) is sticky — it remains visible at the top of the viewport while the user scrolls through the stock cards below.

## Problem

A naive `sticky top-20` broke on mobile because the app header stacks vertically (`flex-col`) and is taller than on desktop. Hard-coding a pixel value would drift if the header ever changes.

## Solution

A `ResizeObserver` in `WatchlistView` measures the real height of the app header and writes it to a CSS custom property `--header-height` on `<html>`. The sticky panel uses `top: var(--header-height)` so it always sits flush below the header at any viewport width.

```ts
useEffect(() => {
  const header = document.getElementById("app-header");
  if (!header) return;
  const update = () => {
    document.documentElement.style.setProperty(
      "--header-height",
      `${header.getBoundingClientRect().height}px`,
    );
  };
  update();
  const ro = new ResizeObserver(update);
  ro.observe(header);
  return () => ro.disconnect();
}, []);
```

The sticky panel:
```tsx
<div className="glass-panel p-6 sticky z-[9] backdrop-blur-sm"
     style={{ top: "var(--header-height, 5rem)" }}>
```

The fallback `5rem` covers the brief window before the effect runs on first render.

## Files Touched

| File | Change |
|------|--------|
| `src/components/Layout.tsx` | Added `id="app-header"` to the `<header>` element |
| `src/watchlist/WatchlistView.tsx` | Added `useEffect` with `ResizeObserver`; sticky panel uses CSS variable for `top` |
