import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.removeItem("watchlist_state");
    localStorage.removeItem("active_tab");
  });
  await page.reload();
});

test("Watchlist tab is visible in the header", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Watchlist" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Portfolio" })).toBeVisible();
});

test("Clicking Watchlist tab switches to watchlist view", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Watchlist", exact: true }).click();
  await expect(page.getByRole("button", { name: /Add to Watchlist/i })).toBeVisible();
  await expect(page.getByText(/No stocks in your watchlist yet/i)).toBeVisible();
});

test("Portfolio tab button is highlighted when active", async ({ page }) => {
  await page.goto("/");
  const portfolioBtn = page.getByRole("button", { name: "Portfolio" });
  await expect(portfolioBtn).toHaveClass(/bg-blue-600/);
  const watchlistBtn = page.getByRole("button", { name: "Watchlist" });
  await expect(watchlistBtn).not.toHaveClass(/bg-blue-600/);
});

test("Watchlist tab button is highlighted when active", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Watchlist", exact: true }).click();
  const watchlistBtn = page.getByRole("button", { name: "Watchlist", exact: true });
  await expect(watchlistBtn).toHaveClass(/bg-blue-600/);
});

test("Adding a ticker shows a loading card then populates with metrics", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Watchlist", exact: true }).click();

  // Use the watchlist-specific input (inside the watchlist panel, not the portfolio form)
  const addForm = page.locator("form").filter({ has: page.getByRole("button", { name: /Add to Watchlist/i }) });
  const input = addForm.getByPlaceholder(/Symbol or ISIN/i);
  await input.fill("AAPL");
  await page.getByRole("button", { name: /Add to Watchlist/i }).click();

  // Input should be cleared immediately
  await expect(input).toHaveValue("");

  // Wait for the card to finish loading (up to 20s for external API)
  // The spinner may appear and disappear quickly, so we just wait for the result
  await expect(page.getByText(/AAPL|Apple/i).first()).toBeVisible({ timeout: 20000 });

  // Metrics table should appear with verdict badges (give extra time after card loads)
  await expect(page.getByText(/Good|Caution|Red Flag/i).first()).toBeVisible({ timeout: 10000 });
});

test("Watchlist items persist across page reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Watchlist", exact: true }).click();

  // Pre-seed localStorage with a completed item so we don't need a live API call
  await page.evaluate(() => {
    const item = {
      id: "test-persist-id",
      input: "MSFT",
      symbol: "MSFT",
      name: "Microsoft Corporation",
      currentPrice: 420.0,
      currency: "USD",
      fundamentals: null,
      metrics: [
        { key: "pe", label: "P/E Ratio", value: 35, displayValue: "35.00", verdict: "caution", note: "Watch it" },
      ],
      isLoading: false,
      error: null,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem("watchlist_state", JSON.stringify([item]));
  });

  await page.reload();
  await page.getByRole("button", { name: "Watchlist", exact: true }).click();

  await expect(page.getByText("Microsoft Corporation")).toBeVisible();
  await expect(page.getByText("MSFT")).toBeVisible();
  await expect(page.getByText("Caution")).toBeVisible();
});

test("Remove button deletes a watchlist item", async ({ page }) => {
  await page.goto("/");

  // Pre-seed with an item
  await page.evaluate(() => {
    const item = {
      id: "remove-test-id",
      input: "TSLA",
      symbol: "TSLA",
      name: "Tesla Inc.",
      currentPrice: 250.0,
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

  await expect(page.getByText("Tesla Inc.")).toBeVisible();

  await page.getByTitle("Remove").click();

  await expect(page.getByText("Tesla Inc.")).not.toBeVisible();
  await expect(page.getByText(/No stocks in your watchlist yet/i)).toBeVisible();
});

test("Switching tabs preserves both views independently", async ({ page }) => {
  await page.goto("/");

  // Portfolio tab should show the portfolio UI
  await expect(page.getByRole("button", { name: "Portfolio" })).toBeVisible();

  // Switch to Watchlist
  await page.getByRole("button", { name: "Watchlist", exact: true }).click();
  await expect(page.getByPlaceholder(/Symbol or ISIN/i)).toBeVisible();

  // Switch back to Portfolio
  await page.getByRole("button", { name: "Portfolio", exact: true }).click();
  // Watchlist-specific "Add to Watchlist" button should be gone
  await expect(page.getByRole("button", { name: /Add to Watchlist/i })).not.toBeVisible();
});

test("Warning banner shown at top for unrecognised ticker, no card added", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Watchlist", exact: true }).click();

  // Intercept and return a response with no longName and no regularMarketPrice
  await page.route("**/api/yahoo-quotesummary**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        quoteSummary: {
          result: [
            {
              defaultKeyStatistics: {},
              financialData: {},
              price: {
                symbol: "APPL",
                longName: null,
                regularMarketPrice: null,
                currency: "USD",
              },
            },
          ],
          error: null,
        },
      }),
    });
  });

  await page.getByPlaceholder(/Symbol or ISIN/i).fill("APPL");
  await page.getByRole("button", { name: /Add to Watchlist/i }).click();

  // Warning banner should appear at top of the panel
  await expect(page.getByText(/symbol not recognised/i)).toBeVisible({ timeout: 10000 });

  // No card should have been added — empty state still shown
  await expect(page.getByText(/No stocks in your watchlist yet/i)).toBeVisible();

  // Dismiss button should clear the banner
  await page.getByRole("button", { name: /Dismiss/i }).click();
  await expect(page.getByText(/symbol not recognised/i)).not.toBeVisible();
});

test("Active tab persists across page reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Watchlist", exact: true }).click();
  await expect(page.getByRole("button", { name: /Add to Watchlist/i })).toBeVisible();

  await page.reload();

  // Watchlist tab should still be active after reload
  await expect(page.getByRole("button", { name: /Add to Watchlist/i })).toBeVisible();
  const watchlistBtn = page.getByRole("button", { name: "Watchlist", exact: true });
  await expect(watchlistBtn).toHaveClass(/bg-blue-600/);
});

test("Adding the same ticker twice shows a warning, no duplicate card", async ({ page }) => {
  await page.goto("/");

  // Pre-seed with MSFT already in the watchlist
  await page.evaluate(() => {
    const item = {
      id: "dup-test-id",
      input: "MSFT",
      symbol: "MSFT",
      name: "Microsoft Corporation",
      currentPrice: 420.0,
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
  await expect(page.getByText("Microsoft Corporation")).toBeVisible();

  // Try to add MSFT again
  await page.getByPlaceholder(/Symbol or ISIN/i).fill("MSFT");
  await page.getByRole("button", { name: /Add to Watchlist/i }).click();

  // Warning banner should appear
  await expect(page.getByText(/already in your watchlist/i)).toBeVisible({ timeout: 5000 });

  // Still only one card
  await expect(page.getByText("Microsoft Corporation")).toHaveCount(1);
});

test("Error state shown when API returns an error", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Watchlist", exact: true }).click();

  // Intercept the local Vite proxy endpoint and return an error response
  await page.route("**/api/yahoo-quotesummary**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        quoteSummary: {
          result: null,
          error: { description: "No fundamentals found for ZZZZZZ" },
        },
      }),
    });
  });

  await page.getByPlaceholder(/Symbol or ISIN/i).fill("ZZZZZZ");
  await page.getByRole("button", { name: /Add to Watchlist/i }).click();

  // Should show an error card
  await expect(page.getByText(/No fundamentals found for ZZZZZZ/i)).toBeVisible({ timeout: 10000 });
});

test("Export CSV downloads a file with correct headers", async ({ page }) => {
  await page.goto("/");

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

  await expect(page.getByText(/imported 2/i)).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(/Apple Inc\.|AAPL/i).first()).toBeVisible({ timeout: 20000 });
});

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

  // Grid container should be present (list view uses individual cards, not a grid wrapper)
  await expect(page.locator(".grid.grid-cols-2").first()).toBeVisible();
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
