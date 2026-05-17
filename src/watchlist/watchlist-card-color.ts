import type { WatchlistItem } from "./watchlist-types";

export type CardColor = "green" | "amber" | "red" | "neutral";

export const cardColor = (item: WatchlistItem): CardColor => {
  if (item.isLoading || item.error || item.metrics.length === 0) return "neutral";
  if (item.metrics.some((m) => m.verdict === "red")) return "red";
  if (item.metrics.some((m) => m.verdict === "caution")) return "amber";
  return "green";
};
