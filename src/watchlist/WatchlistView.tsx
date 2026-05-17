// src/watchlist/WatchlistView.tsx
import React, { useState } from "react";
import { useWatchlist } from "./useWatchlist";
import { WatchlistCard } from "./WatchlistCard";

export const WatchlistView: React.FC = () => {
  const { items, addItem, removeItem, refreshItem } = useWatchlist();
  const [input, setInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setIsAdding(true);
    try {
      await addItem(input.trim());
      setInput("");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Add form */}
      <div className="glass-panel p-6">
        <h2 className="text-xl font-bold mb-4 text-white">Watchlist</h2>
        <form onSubmit={handleSubmit} className="flex gap-4">
          <input
            type="text"
            placeholder="Symbol or ISIN (e.g. AAPL, US0378331005)"
            className="glass-input flex-1 uppercase"
            value={input}
            onChange={e => setInput(e.target.value)}
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
      {items.map(item => (
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
