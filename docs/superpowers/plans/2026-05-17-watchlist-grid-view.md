# Watchlist Grid View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second "grid" view mode to the watchlist that shows each stock as a compact colored card (green / amber / red based on metric verdicts), toggled alongside the existing detailed list view.

**Architecture:** A pure helper `cardColor` derives a single color verdict from a `WatchlistItem`'s metrics array. A new `WatchlistGridCard` component renders the compact card. `WatchlistView` gets a `viewMode` toggle (`"list" | "grid"`) that switches between the existing `WatchlistCard` list and a responsive `WatchlistGridCard` grid. The toggle is persisted to `localStorage` under `watchlist_view_mode` so it survives reloads.

**Tech Stack:** React 19, TypeScript 5.9, Tailwind CSS 4, Vitest, Playwright

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/watchlist/watchlist-card-color.ts` | Pure `cardColor(item)` helper — derives `"green" \| "amber" \| "red" \| "neutral"` from metrics |
| Create | `src/watchlist/watchlist-card-color.test.ts` | Unit tests for `cardColor` |
| Create | `src/watchlist/WatchlistGridCard.tsx` | Compact colored card component |
| Create | `src/watchlist/WatchlistGridCard.test.tsx` | Unit tests for `WatchlistGridCard` |
| Modify | `src/watchlist/WatchlistView.tsx` | Add view-mode toggle state + localStorage persistence, render grid or list |
| Modify | `e2e/watchlist.spec.ts` | E2E tests for toggle behavior and grid card rendering |

---

## Task 1: `cardColor` helper

**Files:**
- Create: `src/watchlist/watchlist-card-color.ts`
- Create: `src/watchlist/watchlist-card-color.test.ts`

### Color rules (priority order)
1. **`"neutral"`** — item is loading, has an error, or has no metrics yet (`metrics.length === 0`).
2. **`"red"`** — any metric has `verdict === "red"`.
3. **`"amber"`** — any metric has `verdict === "caution"` (and none are red).
4. **`"green"`** — all metrics are `"good"` or `"na"`.

- [ ] **Step 1: Write the failing tests**

Create `src/watchlist/watchlist-card-color.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { cardColor } from "./watchlist-card-color";
import type { WatchlistItem } from "./watchlist-types";

const makeItem = (overrides: Partial<WatchlistItem> = {}): WatchlistItem => ({
  id: "x",
  input: "AAPL",
  symbol: "AAPL",
  name: "Apple",
  currentPrice: 100,
  currency: "USD",
  fundamentals: null,
  metrics: [],
  isLoading: false,
  error: null,
  lastUpdated: null,
  ...overrides,
});

describe("cardColor", () => {
  it("returns neutral when isLoading", () => {
    expect(cardColor(makeItem({ isLoading: true }))).toBe("neutral");
  });

  it("returns neutral when error is set", () => {
    expect(cardColor(makeItem({ error: "oops" }))).toBe("neutral");
  });

  it("returns neutral when metrics is empty", () => {
    expect(cardColor(makeItem({ metrics: [] }))).toBe("neutral");
  });

  it("returns red when any metric is red", () => {
    const item = makeItem({
      metrics: [
        { key: "pe", label: "P/E", value: 100, displayValue: "100", verdict: "red", note: "" },
        { key: "peg", label: "PEG", value: 1, displayValue: "1", verdict: "good", note: "" },
      ],
    });
    expect(cardColor(item)).toBe("red");
  });

  it("red takes priority over caution", () => {
    const item = makeItem({
      metrics: [
        { key: "pe", label: "P/E", value: 100, displayValue: "100", verdict: "red", note: "" },
        { key: "peg", label: "PEG", value: 1.5, displayValue: "1.5", verdict: "caution", note: "" },
      ],
    });
    expect(cardColor(item)).toBe("red");
  });

  it("returns amber when caution exists and no red", () => {
    const item = makeItem({
      metrics: [
        { key: "pe", label: "P/E", value: 30, displayValue: "30", verdict: "caution", note: "" },
        { key: "peg", label: "PEG", value: 0.8, displayValue: "0.8", verdict: "good", note: "" },
      ],
    });
    expect(cardColor(item)).toBe("amber");
  });

  it("returns green when all are good or na", () => {
    const item = makeItem({
      metrics: [
        { key: "pe", label: "P/E", value: 15, displayValue: "15", verdict: "good", note: "" },
        { key: "peg", label: "PEG", value: null, displayValue: "N/A", verdict: "na", note: "" },
      ],
    });
    expect(cardColor(item)).toBe("green");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/watchlist/watchlist-card-color.test.ts
```
Expected: FAIL — `watchlist-card-color` module not found.

- [ ] **Step 3: Implement `src/watchlist/watchlist-card-color.ts`**

```typescript
import type { WatchlistItem } from "./watchlist-types";

export type CardColor = "green" | "amber" | "red" | "neutral";

export const cardColor = (item: WatchlistItem): CardColor => {
  if (item.isLoading || item.error || item.metrics.length === 0) return "neutral";
  if (item.metrics.some((m) => m.verdict === "red")) return "red";
  if (item.metrics.some((m) => m.verdict === "caution")) return "amber";
  return "green";
};
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/watchlist/watchlist-card-color.test.ts
```
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/watchlist/watchlist-card-color.ts src/watchlist/watchlist-card-color.test.ts
git commit -m "feat(watchlist): add cardColor helper for grid view"
```

---

## Task 2: `WatchlistGridCard` component

**Files:**
- Create: `src/watchlist/WatchlistGridCard.tsx`
- Create: `src/watchlist/WatchlistGridCard.test.tsx`

The compact card shows:
- Name (bold, truncated to one line)
- Symbol (monospace, smaller)
- Price + currency (if available)
- A colored left border / background tint based on `cardColor`
- Refresh and Remove icon buttons (identical behaviour to `WatchlistCard`)
- Loading spinner (same SVG as `WatchlistCard`) when `isLoading`
- Error text in red when `error` is set

Color mapping to Tailwind classes (use `bg-*/10` tints and `border-*` accents):

| CardColor | Border class | Background tint |
|-----------|-------------|-----------------|
| `green`   | `border-emerald-500` | `bg-emerald-500/10` |
| `amber`   | `border-amber-500`   | `bg-amber-500/10`   |
| `red`     | `border-rose-500`    | `bg-rose-500/10`    |
| `neutral` | `border-slate-600`   | `bg-slate-800/40`   |

- [ ] **Step 1: Write the failing tests**

Create `src/watchlist/WatchlistGridCard.test.tsx`:

```typescript
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { WatchlistGridCard } from "./WatchlistGridCard";
import type { WatchlistItem } from "./watchlist-types";

const makeItem = (overrides: Partial<WatchlistItem> = {}): WatchlistItem => ({
  id: "grid-id",
  input: "MSFT",
  symbol: "MSFT",
  name: "Microsoft Corporation",
  currentPrice: 420.0,
  currency: "USD",
  fundamentals: null,
  metrics: [
    { key: "pe", label: "P/E", value: 15, displayValue: "15", verdict: "good", note: "" },
  ],
  isLoading: false,
  error: null,
  lastUpdated: null,
  ...overrides,
});

describe("WatchlistGridCard", () => {
  it("renders name and symbol", () => {
    render(<WatchlistGridCard item={makeItem()} onRemove={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByText("Microsoft Corporation")).toBeTruthy();
    expect(screen.getByText("MSFT")).toBeTruthy();
  });

  it("renders price when available", () => {
    render(<WatchlistGridCard item={makeItem()} onRemove={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByText(/420/)).toBeTruthy();
  });

  it("does not render price when null", () => {
    render(<WatchlistGridCard item={makeItem({ currentPrice: null })} onRemove={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.queryByText(/USD/)).toBeFalsy();
  });

  it("shows loading spinner when isLoading", () => {
    render(<WatchlistGridCard item={makeItem({ isLoading: true })} onRemove={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("shows error text when error is set", () => {
    render(<WatchlistGridCard item={makeItem({ error: "Fetch failed" })} onRemove={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByText(/Fetch failed/)).toBeTruthy();
  });

  it("applies green border class when all metrics are good", () => {
    const { container } = render(<WatchlistGridCard item={makeItem()} onRemove={vi.fn()} onRefresh={vi.fn()} />);
    expect(container.firstChild?.toString()).toBeTruthy();
    // The card root element should have the green border class
    expect((container.firstChild as HTMLElement).className).toContain("border-emerald-500");
  });

  it("applies red border class when any metric is red", () => {
    const item = makeItem({
      metrics: [{ key: "pe", label: "P/E", value: 100, displayValue: "100", verdict: "red", note: "" }],
    });
    const { container } = render(<WatchlistGridCard item={item} onRemove={vi.fn()} onRefresh={vi.fn()} />);
    expect((container.firstChild as HTMLElement).className).toContain("border-rose-500");
  });

  it("calls onRemove when remove button clicked", async () => {
    const onRemove = vi.fn();
    render(<WatchlistGridCard item={makeItem()} onRemove={onRemove} onRefresh={vi.fn()} />);
    await userEvent.click(screen.getByTitle("Remove"));
    expect(onRemove).toHaveBeenCalledWith("grid-id");
  });

  it("calls onRefresh when refresh button clicked", async () => {
    const onRefresh = vi.fn();
    render(<WatchlistGridCard item={makeItem()} onRemove={vi.fn()} onRefresh={onRefresh} />);
    await userEvent.click(screen.getByTitle("Refresh"));
    expect(onRefresh).toHaveBeenCalledWith("grid-id");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/watchlist/WatchlistGridCard.test.tsx
```
Expected: FAIL — `WatchlistGridCard` module not found.

- [ ] **Step 3: Implement `src/watchlist/WatchlistGridCard.tsx`**

```typescript
// src/watchlist/WatchlistGridCard.tsx
import React from "react";
import type { WatchlistItem } from "./watchlist-types";
import { cardColor } from "./watchlist-card-color";

interface Props {
  item: WatchlistItem;
  onRemove: (id: string) => void;
  onRefresh: (id: string) => void;
}

const COLOR_CLASSES = {
  green:   { border: "border-emerald-500", bg: "bg-emerald-500/10" },
  amber:   { border: "border-amber-500",   bg: "bg-amber-500/10"   },
  red:     { border: "border-rose-500",    bg: "bg-rose-500/10"    },
  neutral: { border: "border-slate-600",   bg: "bg-slate-800/40"   },
} as const;

export const WatchlistGridCard: React.FC<Props> = ({ item, onRemove, onRefresh }) => {
  const color = cardColor(item);
  const { border, bg } = COLOR_CLASSES[color];

  return (
    <div className={`rounded-xl border-l-4 ${border} ${bg} p-4 flex flex-col gap-2`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-white truncate">{item.name}</p>
          <p className="text-xs text-slate-400 font-mono">{item.symbol}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            title="Refresh"
            onClick={() => onRefresh(item.id)}
            disabled={item.isLoading}
            className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors disabled:opacity-40"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
          <button
            title="Remove"
            onClick={() => onRemove(item.id)}
            className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Price */}
      {item.currentPrice !== null && (
        <p className="text-xs text-slate-300">
          {item.currency} {item.currentPrice.toFixed(2)}
        </p>
      )}

      {/* Loading spinner */}
      {item.isLoading && (
        <div className="flex justify-center py-2" role="status">
          <svg className="animate-spin w-4 h-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      )}

      {/* Error */}
      {item.error && (
        <p className="text-xs text-rose-300">{item.error}</p>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/watchlist/WatchlistGridCard.test.tsx
```
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/watchlist/WatchlistGridCard.tsx src/watchlist/WatchlistGridCard.test.tsx
git commit -m "feat(watchlist): add WatchlistGridCard compact colored card component"
```

---

## Task 3: View-mode toggle in `WatchlistView`

**Files:**
- Modify: `src/watchlist/WatchlistView.tsx`
- Modify: `e2e/watchlist.spec.ts`

The toggle is two icon buttons (list icon / grid icon) placed to the left of the existing Export CSV button in the toolbar. Active mode is highlighted (`bg-slate-600`). Selection is persisted to `localStorage` under key `watchlist_view_mode`.

- [ ] **Step 1: Write the failing E2E tests**

Append to `e2e/watchlist.spec.ts`:

```typescript
test("View toggle buttons are visible on watchlist", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Watchlist", exact: true }).click();
  await expect(page.getByTitle("List view")).toBeVisible();
  await expect(page.getByTitle("Grid view")).toBeVisible();
});

test("Switching to grid view shows grid cards instead of detail cards", async ({ page }) => {
  await page.goto("/");

  await page.evaluate(() => {
    const item = {
      id: "grid-toggle-id",
      input: "AAPL",
      symbol: "AAPL",
      name: "Apple Inc.",
      currentPrice: 175.0,
      currency: "USD",
      fundamentals: null,
      metrics: [
        { key: "pe", label: "P/E Ratio", value: 15, displayValue: "15.00", verdict: "good", note: "" },
      ],
      isLoading: false,
      error: null,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem("watchlist_state", JSON.stringify([item]));
  });

  await page.reload();
  await page.getByRole("button", { name: "Watchlist", exact: true }).click();

  // Switch to grid view
  await page.getByTitle("Grid view").click();

  // Stock name should still be visible in grid card
  await expect(page.getByText("Apple Inc.")).toBeVisible();
  await expect(page.getByText("AAPL")).toBeVisible();
});

test("Grid view mode persists across page reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Watchlist", exact: true }).click();

  // Switch to grid view
  await page.getByTitle("Grid view").click();
  await page.reload();
  await page.getByRole("button", { name: "Watchlist", exact: true }).click();

  // Grid view button should still be active (has bg-slate-600)
  const gridBtn = page.getByTitle("Grid view");
  await expect(gridBtn).toHaveClass(/bg-slate-600/);
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx playwright test e2e/watchlist.spec.ts --grep "View toggle|grid view|Grid view"
```
Expected: FAIL — toggle buttons not present.

- [ ] **Step 3: Update `WatchlistView.tsx`**

Add the `viewMode` state (with `localStorage` persistence) and toggle buttons, and switch the item rendering section:

```typescript
// src/watchlist/WatchlistView.tsx
import React, { useRef, useState } from "react";
import { useWatchlist } from "./useWatchlist";
import { WatchlistCard } from "./WatchlistCard";
import { WatchlistGridCard } from "./WatchlistGridCard";
import {
  generateWatchlistCSV,
  downloadWatchlistCSV,
  parseWatchlistCSV,
  type WatchlistCSVRow,
} from "./watchlist-csv";
import { ISIN_REGEX } from "./watchlist-api";

type ViewMode = "list" | "grid";

export const WatchlistView: React.FC = () => {
  const { items, addItem, removeItem, refreshItem, refreshAll } = useWatchlist();
  const [input, setInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("watchlist_view_mode");
    return saved === "grid" ? "grid" : "list";
  });

  const handleViewMode = (mode: ViewMode) => {
    localStorage.setItem("watchlist_view_mode", mode);
    setViewMode(mode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setIsAdding(true);
    setWarning(null);
    setSuccess(null);
    try {
      await addItem(input.trim());
      setInput("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setWarning(msg);
      setInput("");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRefreshAll = async () => {
    setIsRefreshingAll(true);
    try {
      await refreshAll();
    } finally {
      setIsRefreshingAll(false);
    }
  };

  const handleExport = () => {
    const today = new Date().toISOString().slice(0, 10);
    const csv = generateWatchlistCSV(
      items.map((it) => ({
        symbol: it.symbol,
        name: it.name,
        isin: ISIN_REGEX.test(it.input) ? it.input : undefined,
      })),
    );
    downloadWatchlistCSV(csv, `watchlist-${today}.csv`);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setWarning(null);
    setSuccess(null);

    let rows: WatchlistCSVRow[];
    try {
      rows = await parseWatchlistCSV(file);
    } catch {
      setWarning("Could not read the CSV file.");
      return;
    }

    setIsImporting(true);
    let added = 0;
    let skipped = 0;
    try {
      for (const row of rows) {
        try {
          await addItem(row.isin ?? row.symbol);
          added++;
        } catch {
          skipped++;
        }
      }
    } finally {
      setIsImporting(false);
    }
    setSuccess(
      skipped > 0
        ? `Imported ${added} item${added !== 1 ? "s" : ""} — ${skipped} skipped (already in watchlist or not recognised).`
        : `Imported ${added} item${added !== 1 ? "s" : ""}.`,
    );
  };

  const activeBtn = "p-1.5 rounded bg-slate-600 text-white transition-colors";
  const inactiveBtn = "p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors";

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Add form */}
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Watchlist</h2>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <button
              onClick={() => handleViewMode("list")}
              title="List view"
              className={viewMode === "list" ? activeBtn : inactiveBtn}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
            </button>
            <button
              onClick={() => handleViewMode("grid")}
              title="Grid view"
              className={viewMode === "grid" ? activeBtn : inactiveBtn}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
              </svg>
            </button>
            {/* Divider */}
            <div className="w-px h-5 bg-slate-700" />
            <button
              onClick={handleExport}
              disabled={items.length === 0}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Export CSV
            </button>
            <button
              onClick={handleImportClick}
              disabled={isImporting}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isImporting ? "Importing..." : "Import CSV"}
            </button>
            <button
              onClick={handleRefreshAll}
              disabled={items.length === 0 || isImporting}
              className={`p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isRefreshingAll ? "animate-spin" : ""}`}
              title="Refresh All"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-300">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              hidden
              onChange={handleFileChange}
            />
          </div>
        </div>

        {/* Warning banner */}
        {warning && (
          <div className="mb-4 p-3 bg-amber-500/20 border border-amber-500/40 rounded-lg text-amber-300 text-sm flex items-center justify-between">
            <span>{warning}</span>
            <button onClick={() => setWarning(null)} className="ml-3 text-amber-400 hover:text-amber-200 transition-colors" aria-label="Dismiss">✕</button>
          </div>
        )}

        {/* Success banner */}
        {success && (
          <div className="mb-4 p-3 bg-green-500/20 border border-green-500/40 rounded-lg text-green-300 text-sm flex items-center justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="ml-3 text-green-400 hover:text-green-200 transition-colors" aria-label="Dismiss">✕</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-4">
          <input
            type="text"
            placeholder="Symbol or ISIN (e.g. AAPL, US0378331005)"
            className="glass-input flex-1 uppercase"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            required
          />
          <button type="submit" disabled={isAdding} className="glass-button whitespace-nowrap disabled:opacity-50">
            {isAdding ? "Adding..." : "Add to Watchlist"}
          </button>
        </form>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <p className="text-center text-slate-500 py-8">
          No stocks in your watchlist yet. Add a symbol or ISIN above.
        </p>
      )}

      {/* List view */}
      {viewMode === "list" && items.map((item) => (
        <WatchlistCard
          key={item.id}
          item={item}
          onRemove={removeItem}
          onRefresh={refreshItem}
        />
      ))}

      {/* Grid view */}
      {viewMode === "grid" && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <WatchlistGridCard
              key={item.id}
              item={item}
              onRemove={removeItem}
              onRefresh={refreshItem}
            />
          ))}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run unit tests**

```bash
npx vitest run src/watchlist/
```
Expected: PASS (all watchlist unit tests).

- [ ] **Step 5: Run E2E tests**

```bash
npx playwright test e2e/watchlist.spec.ts
```
Expected: PASS (all tests including the three new ones).

- [ ] **Step 6: Commit**

```bash
git add src/watchlist/WatchlistView.tsx e2e/watchlist.spec.ts
git commit -m "feat(watchlist): add grid/list view toggle with localStorage persistence"
```

---

## Task 4: Write spec doc

**Files:**
- Create: `docs/superpowers/specs/2026-05-17-watchlist-grid-view-design.md`

- [ ] **Step 1: Write spec**

Create `docs/superpowers/specs/2026-05-17-watchlist-grid-view-design.md`:

```markdown
# Watchlist Grid View — Design Spec

**Date:** 2026-05-17
**Status:** Implemented

## Feature

A second view mode for the watchlist. Toggled by two icon buttons (list / grid) in the panel header. Default is list. Selection persists to `localStorage` under `watchlist_view_mode`.

## Color Logic (`cardColor`)

Priority order:
1. **Neutral** — loading, error, or no metrics yet
2. **Red** — any metric verdict is `"red"`
3. **Amber** — any metric verdict is `"caution"` (and none red)
4. **Green** — all metrics are `"good"` or `"na"`

| Color   | Border              | Background tint      |
|---------|---------------------|----------------------|
| green   | `border-emerald-500`| `bg-emerald-500/10`  |
| amber   | `border-amber-500`  | `bg-amber-500/10`    |
| red     | `border-rose-500`   | `bg-rose-500/10`     |
| neutral | `border-slate-600`  | `bg-slate-800/40`    |

## Grid Card

Each card shows: name (truncated), symbol, price+currency, spinner or error text. No metrics table.
Grid layout: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`.

## Files

| File | Responsibility |
|------|----------------|
| `src/watchlist/watchlist-card-color.ts` | Pure `cardColor` helper |
| `src/watchlist/watchlist-card-color.test.ts` | Unit tests (7 cases) |
| `src/watchlist/WatchlistGridCard.tsx` | Compact card component |
| `src/watchlist/WatchlistGridCard.test.tsx` | Unit tests (9 cases) |
| `src/watchlist/WatchlistView.tsx` | Toggle state + localStorage + conditional rendering |
| `e2e/watchlist.spec.ts` | 3 new E2E tests for toggle behaviour |
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-05-17-watchlist-grid-view-design.md
git commit -m "docs: add watchlist grid view design spec"
```
