import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Clear localStorage watchlist state before each test
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("watchlist_state"));
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
