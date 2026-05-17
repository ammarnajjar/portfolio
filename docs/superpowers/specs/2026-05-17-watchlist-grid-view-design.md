# Watchlist Grid View — Design Spec

**Date:** 2026-05-17
**Status:** Implemented

## Feature

A second view mode for the watchlist. Toggled by two icon buttons (list / grid) in the panel header. Default is list. Selection persists to `localStorage` under `watchlist_view_mode`.

Toggle buttons carry `title`, `aria-label`, and `aria-pressed` attributes for full accessibility.

## Color Logic (`cardColor`)

Priority order:
1. **Neutral** — loading, error, or no metrics yet
2. **Red** — any metric verdict is `"red"`
3. **Amber** — any metric verdict is `"caution"` (and none red); "caution" maps to amber
4. **Green** — all metrics are `"good"` or `"na"`

| Color   | Border               | Background tint      |
|---------|----------------------|----------------------|
| green   | `border-emerald-500` | `bg-emerald-500/10`  |
| amber   | `border-amber-500`   | `bg-amber-500/10`    |
| red     | `border-rose-500`    | `bg-rose-500/10`     |
| neutral | `border-slate-600`   | `bg-slate-800/40`    |

## Grid Card (`WatchlistGridCard`)

Each card shows: name (bold, truncated), symbol (monospace), price+currency (if available), spinner or error text. No metrics table — color conveys verdict at a glance.

Grid layout: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`. Only rendered when `items.length > 0`.

Both Refresh and Remove icon buttons have `title`, `aria-label` attributes. Refresh is disabled when `isLoading`.

## Files

| File | Responsibility |
|------|----------------|
| `src/watchlist/watchlist-card-color.ts` | Pure `cardColor` helper; `CardColor` type |
| `src/watchlist/watchlist-card-color.test.ts` | Unit tests (9 cases, including guard isolation) |
| `src/watchlist/WatchlistGridCard.tsx` | Compact colored card component |
| `src/watchlist/WatchlistGridCard.test.tsx` | Unit tests (10 cases) |
| `src/watchlist/WatchlistView.tsx` | Toggle state + localStorage + conditional rendering |
| `e2e/watchlist.spec.ts` | 3 new E2E tests for toggle behaviour and persistence |
