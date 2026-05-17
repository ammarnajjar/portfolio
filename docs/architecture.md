# Architecture

## Project Structure

```
portfolio/
├── src/
│   ├── App.tsx                        # Root: wraps Dashboard in StoreProvider
│   ├── main.tsx                       # Vite entry point
│   ├── index.css                      # Tailwind base styles
│   ├── components/
│   │   ├── Layout.tsx                 # Header: totals bar + auto-refresh controls
│   │   ├── AddStockForm.tsx           # Form to add a new holding
│   │   ├── Chart.tsx                  # Performance chart + range selector
│   │   ├── PortfolioList.tsx          # Holdings table shell
│   │   └── PortfolioList/
│   │       ├── PortfolioRow.tsx       # Single holding row
│   │       ├── HeaderControls.tsx     # Import/export buttons
│   │       └── usePortfolioList.tsx   # Sorting + import/export logic
│   └── services/
│       ├── store.tsx                  # Central state + all mutations
│       ├── store-context.ts           # React context definition
│       ├── store-types.ts             # TypeScript interfaces
│       ├── api.ts                     # Yahoo Finance wrapper
│       ├── csv.ts                     # CSV parse + generate
│       ├── storage.ts                 # localStorage abstraction
│       └── ranges.ts                  # Range types + Yahoo query strings
├── docs/                              # This documentation
├── public/
│   └── 404.html                       # SPA fallback for GitHub Pages routing
├── .github/workflows/                 # CI (test) + CD (deploy to Pages)
├── vite.config.ts
├── vitest.config.ts
└── tsconfig.app.json
```

---

## State Management

The app uses **React Context + useReducer-style mutations** rather than a third-party store.

```
StoreProvider (store.tsx)
    └── StoreContext  ←  useStore() hook consumed by all components
```

**State shape** (`AppState` in `store-types.ts`):

```ts
interface AppState {
  items: PortfolioItem[];       // All holdings
  isRefreshing: boolean;        // Global refresh in progress
  autoRefresh: AutoRefreshConfig;
}

interface PortfolioItem {
  symbol: string;
  name: string;
  isin?: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  lastUpdated?: string;         // ISO timestamp
  error?: string;               // Per-item fetch error
  isRefreshing?: boolean;       // Per-item spinner flag
  history: CandleData[];        // OHLCV candles for charting
  fetchedRanges: string[];      // Ranges already fetched (e.g. ['1M','1Y'])
}
```

**Persistence**: State is serialized to `localStorage` under the key `portfolio_state` after every mutation. UI preferences (chart/table/breakdown visibility) are stored separately so they don't pollute portfolio data.

---

## Component Tree

```
App
└── StoreProvider
    └── Dashboard (inline in App)
        ├── Layout                   # Header + totals + auto-refresh selector
        ├── AddStockForm             # Add holding by symbol or ISIN
        ├── Chart                    # Portfolio chart + range buttons
        └── PortfolioList
            ├── HeaderControls       # CSV/JSON import & export
            └── PortfolioRow[]       # One row per holding
```

---

## Data Flow

### Adding a holding

```
AddStockForm (user submits symbol/ISIN)
    → store.addItem(symbol, isin?)
        → api.fetchQuote(symbol)       # fetch live price
        → state.items.push(newItem)
        → storage.save(state)
```

### Refreshing prices

```
Layout (Refresh All button / auto-refresh timer)
    → store.refreshAll()
        → chunk items into batches of 3
        → for each batch:
            api.fetchQuote(symbol)     # parallel within batch
            → update item.currentPrice, item.lastUpdated
        → 500ms delay between batches
        → storage.save(state)
```

### Loading chart history

```
Chart (range button clicked)
    → store.fetchHistory(range)
        → for each item:
            if range in item.fetchedRanges → skip
            if item.history covers cutoff  → skip
            else api.fetchHistory(symbol, range)
                → merge new candles into item.history
                → item.fetchedRanges.push(range)
        → aggregate all items into portfolio-level series
        → storage.save(state)
```

### Import / Export

```
HeaderControls
    → usePortfolioList.exportCSV()   # generates CSV string → downloads
    → usePortfolioList.importCSV()   # parses file → store.replaceItems()
    → usePortfolioList.exportJSON()  # full state snapshot → downloads
    → usePortfolioList.importJSON()  # validates + store.replaceAll()
```

---

## Async Cancellation

All long-running operations use `AbortController`. The controller ref is stored in the store and passed to `api.*` calls. Clicking the stop button calls `controller.abort()`, which causes in-flight fetch promises to reject and halts the batch loop.

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| No backend | Keeps deployment to GitHub Pages trivial; localStorage is sufficient for personal use |
| Context API over Redux/Zustand | App state is small and co-located; no cross-cutting async middleware needed |
| Yahoo Finance via CORS proxy | No API key required; acceptable for low-frequency personal use |
| Range caching per item | Prevents hammering the proxy on every chart interaction; history check avoids stale over-fetching |
| Batch size 3 + 500ms delay | Stays within Yahoo Finance informal rate limits |
| AbortController throughout | Prevents state updates on unmounted components; gives user a stop button |
| localStorage only | No auth, no server costs, no privacy concerns for personal data |
