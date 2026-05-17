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
