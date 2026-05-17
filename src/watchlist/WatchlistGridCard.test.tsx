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
