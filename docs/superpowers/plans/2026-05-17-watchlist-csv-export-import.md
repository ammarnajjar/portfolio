# Watchlist CSV Export/Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Export CSV and Import CSV buttons to the watchlist panel so users can back up their watchlist and restore it across sessions; on import, metrics are fetched fresh for each ticker.

**Architecture:** A thin `watchlist-csv.ts` service handles CSV generation and parsing (3 columns: Symbol, Name, ISIN). `WatchlistView` grows two buttons and a hidden file input wired to the service. Import delegates to the existing `addItem` flow (which fetches metrics and handles duplicates). No new store primitives needed.

**Tech Stack:** React 19, TypeScript 5.9, Vitest, Playwright

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/watchlist/watchlist-csv.ts` | `generateWatchlistCSV` and `parseWatchlistCSV` — pure CSV logic |
| Create | `src/watchlist/watchlist-csv.test.ts` | Unit tests for CSV generation and parsing |
| Modify | `src/watchlist/WatchlistView.tsx` | Add Export/Import buttons, file input ref, handlers |
| Modify | `e2e/watchlist.spec.ts` | E2E tests for export and import flows |

---

## Task 1: CSV service — generate and parse

**Files:**
- Create: `src/watchlist/watchlist-csv.ts`
- Create: `src/watchlist/watchlist-csv.test.ts`

### Step 1: Write the failing tests

Create `src/watchlist/watchlist-csv.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateWatchlistCSV, parseWatchlistCSV } from "./watchlist-csv";

describe("generateWatchlistCSV", () => {
  it("produces header row + one data row", () => {
    const csv = generateWatchlistCSV([
      { symbol: "AAPL", name: "Apple Inc.", isin: "US0378331005" },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Symbol;Name;ISIN");
    expect(lines[1]).toBe('AAPL;"Apple Inc.";US0378331005');
  });

  it("quotes names that contain semicolons", () => {
    const csv = generateWatchlistCSV([
      { symbol: "X", name: 'Foo;Bar', isin: "" },
    ]);
    expect(csv.split("\n")[1]).toBe('X;"Foo;Bar";');
  });

  it("escapes double-quotes in names", () => {
    const csv = generateWatchlistCSV([
      { symbol: "X", name: 'Say "Hi"', isin: "" },
    ]);
    expect(csv.split("\n")[1]).toBe('X;"Say ""Hi""";');
  });

  it("handles empty isin gracefully", () => {
    const csv = generateWatchlistCSV([
      { symbol: "MSFT", name: "Microsoft", isin: undefined },
    ]);
    expect(csv.split("\n")[1]).toBe('MSFT;"Microsoft";');
  });
});

describe("parseWatchlistCSV", () => {
  it("parses a standard CSV with header row", async () => {
    const file = new File(
      ['Symbol;Name;ISIN\nAAPL;"Apple Inc.";US0378331005\n'],
      "watchlist.csv",
      { type: "text/csv" },
    );
    const rows = await parseWatchlistCSV(file);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ symbol: "AAPL", name: "Apple Inc.", isin: "US0378331005" });
  });

  it("parses CSV without header (symbol-only rows)", async () => {
    const file = new File(["AAPL\nMSFT\n"], "watchlist.csv", { type: "text/csv" });
    const rows = await parseWatchlistCSV(file);
    expect(rows).toHaveLength(2);
    expect(rows[0].symbol).toBe("AAPL");
    expect(rows[1].symbol).toBe("MSFT");
  });

  it("skips blank lines", async () => {
    const file = new File(
      ["Symbol;Name;ISIN\nAAPL;"Apple";US123\n\nMSFT;"Microsoft";\n"],
      "watchlist.csv",
      { type: "text/csv" },
    );
    const rows = await parseWatchlistCSV(file);
    expect(rows).toHaveLength(2);
  });

  it("trims whitespace from symbol", async () => {
    const file = new File([" AAPL ; Apple ; \n"], "watchlist.csv", { type: "text/csv" });
    const rows = await parseWatchlistCSV(file);
    expect(rows[0].symbol).toBe("AAPL");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/watchlist/watchlist-csv.test.ts
```
Expected: FAIL — `watchlist-csv` module not found.

- [ ] **Step 3: Implement `src/watchlist/watchlist-csv.ts`**

```typescript
export interface WatchlistCSVRow {
  symbol: string;
  name: string;
  isin?: string;
}

const quoteName = (name: string): string =>
  `"${name.replace(/"/g, '""')}"`;

export const generateWatchlistCSV = (rows: WatchlistCSVRow[]): string => {
  const header = "Symbol;Name;ISIN";
  const lines = rows.map(
    (r) => `${r.symbol};${quoteName(r.name)};${r.isin ?? ""}`,
  );
  return [header, ...lines].join("\n");
};

export const downloadWatchlistCSV = (csv: string, filename: string): void => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const parseWatchlistCSV = (file: File): Promise<WatchlistCSVRow[]> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const text = (e.target?.result as string) ?? "";
      const lines = text.split("\n");

      const splitLine = (line: string): string[] => {
        const parts: string[] = [];
        let current = "";
        let inQuote = false;
        for (const ch of line) {
          if (ch === '"') {
            inQuote = !inQuote;
          } else if (ch === ";" && !inQuote) {
            parts.push(current.trim());
            current = "";
          } else {
            current += ch;
          }
        }
        parts.push(current.trim());
        return parts;
      };

      const normalize = (s: string) =>
        s.toLowerCase().replace(/[^a-z0-9]/g, "");

      const firstParts = splitLine(lines[0] ?? "").map(normalize);
      const hasHeader = firstParts.some((p) =>
        ["symbol", "name", "isin"].includes(p),
      );
      const startIdx = hasHeader ? 1 : 0;

      const rows: WatchlistCSVRow[] = [];
      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = splitLine(line);
        const symbol = parts[0]?.replace(/^"|"$/g, "").trim().toUpperCase();
        if (!symbol) continue;
        const name = parts[1]?.replace(/^"|"$/g, "").trim() ?? symbol;
        const isin = parts[2]?.replace(/^"|"$/g, "").trim() || undefined;
        rows.push({ symbol, name, isin });
      }
      resolve(rows);
    };
    reader.readAsText(file);
  });
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/watchlist/watchlist-csv.test.ts
```
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/watchlist/watchlist-csv.ts src/watchlist/watchlist-csv.test.ts
git commit -m "feat(watchlist): add CSV export/import service"
```

---

## Task 2: Wire Export/Import into WatchlistView

**Files:**
- Modify: `src/watchlist/WatchlistView.tsx`

The view needs:
- An `Export CSV` button (disabled when no items) that calls `generateWatchlistCSV` + `downloadWatchlistCSV`.
- An `Import CSV` button that triggers a hidden file input.
- A hidden `<input type="file" accept=".csv">` with a `useRef`.
- An import handler that parses the CSV and calls `addItem` for each row, collecting a summary message (added / skipped duplicates).
- A success/info banner (green) shown after import completes, reusing the same dismissible pattern as the amber warning banner.

- [ ] **Step 1: Write the failing E2E tests**

Add to `e2e/watchlist.spec.ts`:

```typescript
test("Export CSV downloads a file with correct headers", async ({ page }) => {
  await page.goto("/");

  // Pre-seed with one item
  await page.evaluate(() => {
    const item = {
      id: "export-test-id",
      input: "AAPL",
      symbol: "AAPL",
      name: "Apple Inc.",
      currentPrice: 175.0,
      currency: "USD",
      fundamentals: null,
      metrics: [],
      isLoading: false,
      error: null,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem("watchlist_state", JSON.stringify([item]));
  });

  await page.reload();
  await page.getByRole("button", { name: "Watchlist", exact: true }).click();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Export CSV/i }).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/^watchlist-\d{4}-\d{2}-\d{2}\.csv$/);
  const path = await download.path();
  const fs = await import("fs");
  const content = fs.readFileSync(path!, "utf-8");
  expect(content).toContain("Symbol;Name;ISIN");
  expect(content).toContain("AAPL");
  expect(content).toContain("Apple Inc.");
});

test("Import CSV adds items and shows success banner", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Watchlist", exact: true }).click();

  // Intercept API calls so import doesn't need live Yahoo Finance
  await page.route("**/api/yahoo-quotesummary**", async (route) => {
    const url = new URL(route.request().url());
    const symbol = url.searchParams.get("symbol") ?? "UNKNOWN";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        quoteSummary: {
          result: [{
            defaultKeyStatistics: {},
            financialData: {},
            price: {
              symbol,
              longName: symbol === "AAPL" ? "Apple Inc." : "Microsoft Corporation",
              regularMarketPrice: { raw: 175.0 },
              currency: "USD",
            },
          }],
          error: null,
        },
      }),
    });
  });

  const csvContent = "Symbol;Name;ISIN\nAAPL;Apple Inc.;US0378331005\nMSFT;Microsoft Corporation;\n";
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Import CSV/i }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "watchlist.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csvContent),
  });

  // Success banner should appear
  await expect(page.getByText(/imported 2/i)).toBeVisible({ timeout: 30000 });

  // Both cards should appear
  await expect(page.getByText(/Apple Inc\.|AAPL/i).first()).toBeVisible({ timeout: 20000 });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx playwright test e2e/watchlist.spec.ts --grep "Export CSV|Import CSV"
```
Expected: FAIL — buttons not present.

- [ ] **Step 3: Update `WatchlistView.tsx`**

Replace the full file:

```typescript
// src/watchlist/WatchlistView.tsx
import React, { useRef, useState } from "react";
import { useWatchlist } from "./useWatchlist";
import { WatchlistCard } from "./WatchlistCard";
import {
  generateWatchlistCSV,
  downloadWatchlistCSV,
  parseWatchlistCSV,
} from "./watchlist-csv";

export const WatchlistView: React.FC = () => {
  const { items, addItem, removeItem, refreshItem } = useWatchlist();
  const [input, setInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleExport = () => {
    const today = new Date().toISOString().slice(0, 10);
    const csv = generateWatchlistCSV(
      items.map((it) => ({ symbol: it.symbol, name: it.name, isin: it.input.match(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/) ? it.input : undefined })),
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

    let rows: Awaited<ReturnType<typeof parseWatchlistCSV>>;
    try {
      rows = await parseWatchlistCSV(file);
    } catch {
      setWarning("Could not read the CSV file.");
      return;
    }

    let added = 0;
    let skipped = 0;
    for (const row of rows) {
      try {
        await addItem(row.isin ?? row.symbol);
        added++;
      } catch {
        skipped++;
      }
    }
    setSuccess(
      skipped > 0
        ? `Imported ${added} item${added !== 1 ? "s" : ""} — ${skipped} skipped (already in watchlist or not recognised).`
        : `Imported ${added} item${added !== 1 ? "s" : ""}.`,
    );
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Add form */}
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Watchlist</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={items.length === 0}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Export CSV
            </button>
            <button
              onClick={handleImportClick}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors shadow-lg shadow-blue-500/20"
            >
              Import CSV
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
            <button
              onClick={() => setWarning(null)}
              className="ml-3 text-amber-400 hover:text-amber-200 transition-colors"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* Success banner */}
        {success && (
          <div className="mb-4 p-3 bg-green-500/20 border border-green-500/40 rounded-lg text-green-300 text-sm flex items-center justify-between">
            <span>{success}</span>
            <button
              onClick={() => setSuccess(null)}
              className="ml-3 text-green-400 hover:text-green-200 transition-colors"
              aria-label="Dismiss"
            >
              ✕
            </button>
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
          <button
            type="submit"
            disabled={isAdding}
            className="glass-button whitespace-nowrap disabled:opacity-50"
          >
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

      {/* Cards */}
      {items.map((item) => (
        <WatchlistCard
          key={item.id}
          item={item}
          onRemove={removeItem}
          onRefresh={refreshItem}
        />
      ))}
    </div>
  );
};
```

- [ ] **Step 4: Run unit tests to confirm CSV service still passes**

```bash
npx vitest run src/watchlist/
```
Expected: PASS (all watchlist unit tests).

- [ ] **Step 5: Run E2E tests**

```bash
npx playwright test e2e/watchlist.spec.ts
```
Expected: PASS (all tests including the two new ones).

- [ ] **Step 6: Commit**

```bash
git add src/watchlist/WatchlistView.tsx e2e/watchlist.spec.ts
git commit -m "feat(watchlist): add Export/Import CSV buttons to watchlist panel"
```

---

## Task 3: Write spec and update docs

**Files:**
- Create: `docs/superpowers/specs/2026-05-17-watchlist-csv-export-import-design.md`

- [ ] **Step 1: Write the spec**

Create `docs/superpowers/specs/2026-05-17-watchlist-csv-export-import-design.md`:

```markdown
# Watchlist CSV Export/Import — Design Spec

**Date:** 2026-05-17
**Status:** Implemented

## Feature

Export and Import CSV buttons in the watchlist panel header allow users to
back up their watchlist and restore it across sessions or devices.

## CSV Format

Semicolon-delimited, 3 columns:

```
Symbol;Name;ISIN
AAPL;"Apple Inc.";US0378331005
MSFT;"Microsoft Corporation";
```

- Name is always quoted (handles names containing semicolons).
- ISIN is optional — empty string if not available.
- Import also accepts symbol-only rows (no header, one symbol per line).

## Export

- Triggered by "Export CSV" button (disabled when watchlist is empty).
- Filename: `watchlist-YYYY-MM-DD.csv`.
- If the item's `input` field matches the ISIN regex, it is written to the ISIN column; otherwise left blank.
- Metrics and prices are NOT exported — they are always re-fetched on import.

## Import

- Triggered by "Import CSV" button → opens hidden file input (`.csv`).
- Parses CSV via `parseWatchlistCSV` (handles header detection, quoted fields, blank lines).
- For each row, calls `addItem(isin ?? symbol)` — reuses the existing fetch + duplicate-check flow.
- Duplicate rows are silently skipped (counted).
- Unrecognised tickers are silently skipped (counted).
- A green success banner shows the result: "Imported N items." or "Imported N items — M skipped."

## Files

| File | Responsibility |
|------|----------------|
| `src/watchlist/watchlist-csv.ts` | `generateWatchlistCSV`, `downloadWatchlistCSV`, `parseWatchlistCSV` |
| `src/watchlist/watchlist-csv.test.ts` | Unit tests for CSV service |
| `src/watchlist/WatchlistView.tsx` | Export/Import buttons, file input ref, handlers, success banner |
| `e2e/watchlist.spec.ts` | E2E tests for export download and import flow |
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-05-17-watchlist-csv-export-import-design.md
git commit -m "docs: add watchlist CSV export/import design spec"
```
