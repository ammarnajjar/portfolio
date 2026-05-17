// src/watchlist/WatchlistCard.tsx
import React from "react";
import type { WatchlistItem } from "./watchlist-types";
import { MetricRow } from "./MetricRow";

interface Props {
  item: WatchlistItem;
  onRemove: (id: string) => void;
  onRefresh: (id: string) => void;
}

export const WatchlistCard: React.FC<Props> = ({
  item,
  onRemove,
  onRefresh,
}) => {
  return (
    <div className="glass-panel p-6">
      {/* Card header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-white">{item.name}</h3>
          <span className="text-sm text-slate-400 font-mono">
            {item.symbol}
          </span>
          {item.currentPrice !== null && (
            <span className="ml-3 text-sm text-slate-300">
              {item.currency} {item.currentPrice.toFixed(2)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            title="Refresh"
            onClick={() => onRefresh(item.id)}
            disabled={item.isLoading}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors disabled:opacity-40"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
          </button>
          <button
            title="Remove"
            onClick={() => onRemove(item.id)}
            className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Loading state */}
      {item.isLoading && (
        <div className="flex justify-center py-6" role="status">
          <svg
            className="animate-spin w-6 h-6 text-blue-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
        </div>
      )}

      {/* Error state */}
      {item.error && (
        <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-lg text-rose-300 text-sm">
          {item.error}
        </div>
      )}

      {/* Warning state — unrecognised symbol */}
      {!item.error && item.warning && (
        <div className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-lg text-amber-300 text-sm">
          {item.warning}
        </div>
      )}

      {/* Metrics table */}
      {!item.isLoading && !item.error && !item.warning && item.metrics.length > 0 && (
        <table className="w-full">
          <tbody>
            {item.metrics.map(m => (
              <MetricRow key={m.key} metric={m} />
            ))}
          </tbody>
        </table>
      )}

      {item.lastUpdated && (
        <p className="text-xs text-slate-500 mt-3">
          Updated {new Date(item.lastUpdated).toLocaleString()}
        </p>
      )}
    </div>
  );
};
