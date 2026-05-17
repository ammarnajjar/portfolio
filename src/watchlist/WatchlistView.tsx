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
      {/* Add form — sticky below the app header */}
      <div className="glass-panel p-6 sticky top-20 z-[9] backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Watchlist</h2>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <button
              onClick={() => handleViewMode("list")}
              title="List view"
              aria-label="List view"
              aria-pressed={viewMode === "list"}
              className={viewMode === "list" ? activeBtn : inactiveBtn}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
            </button>
            <button
              onClick={() => handleViewMode("grid")}
              title="Grid view"
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
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
              aria-label="Refresh All"
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
      {viewMode === "list" && items.length > 0 && items.map((item) => (
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
