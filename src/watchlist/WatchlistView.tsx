// src/watchlist/WatchlistView.tsx
import React, { useRef, useState } from "react";
import { useWatchlist } from "./useWatchlist";
import { WatchlistCard } from "./WatchlistCard";
import {
  generateWatchlistCSV,
  downloadWatchlistCSV,
  parseWatchlistCSV,
  type WatchlistCSVRow,
} from "./watchlist-csv";
import { ISIN_REGEX } from "./watchlist-api";

export const WatchlistView: React.FC = () => {
  const { items, addItem, removeItem, refreshItem } = useWatchlist();
  const [input, setInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

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
              disabled={isImporting}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isImporting ? "Importing..." : "Import CSV"}
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
