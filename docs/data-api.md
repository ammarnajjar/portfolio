# Data & API Reference

## Yahoo Finance Integration

All market data comes from Yahoo Finance's unofficial JSON API, proxied through a public CORS proxy to work from a browser.

**Base URL pattern:**
```
https://corsproxy.io/?url=https://query1.finance.yahoo.com/...
```

### Quote fetch (`api.fetchQuote`)

Fetches the current price for a single symbol.

- **Endpoint**: `v8/finance/chart/{symbol}?interval=1d&range=1d`
- **Timeout**: 6 seconds
- **Retries**: up to 3, with exponential backoff (1s, 2s, 4s)
- **Returns**: `{ price: number, currency: string }`

### History fetch (`api.fetchHistory`)

Fetches OHLCV daily candles for a given time range.

- **Endpoint**: `v8/finance/chart/{symbol}?interval=1d&range={yahooRange}`
- **Timeout**: 10 seconds
- **Returns**: `CandleData[]` — array of `{ time, open, high, low, close }`

**Range mapping** (defined in `ranges.ts`):

| UI Range | Yahoo query param |
|---|---|
| 1D | `1d` |
| 1W | `5d` |
| 1M | `1mo` |
| 3M | `3mo` |
| 1Y | `1y` |
| 5Y | `5y` |

---

## ISIN Resolution

When a user enters an ISIN instead of a ticker symbol, the app resolves it to a Yahoo Finance symbol.

**Resolution order:**
1. Check the built-in fallback map (`api.ts`) — covers 30+ common ISINs (AAPL, MSFT, common ETFs, etc.)
2. If not found, attempt Yahoo Finance symbol search endpoint

**Fallback map examples:**

| ISIN | Symbol |
|---|---|
| US0378331005 | AAPL |
| US5949181045 | MSFT |
| US02079K3059 | GOOGL |
| US0231351067 | AMZN |
| IE00B4L5Y983 | IWDA.AS |

---

## Currency Conversion

All prices are normalized to **EUR**.

- If the Yahoo Finance quote currency is already `EUR` — used as-is.
- If the currency is `GBp` (British pence) — divided by 100 to convert to GBP, then converted to EUR.
- For any other currency — fetches the `{CURRENCY}EUR=X` exchange rate from Yahoo Finance and multiplies.

The FX rate fetch uses the same retry/timeout logic as the quote fetch.

---

## Range Caching

To avoid redundant network requests, each `PortfolioItem` stores which ranges have already been fetched:

```ts
item.fetchedRanges: string[]   // e.g. ['1M', '1Y', '3M']
```

Before fetching history for a range, the store checks two conditions:

1. **Explicit cache**: is the range already in `fetchedRanges`?
2. **History coverage check**: does `item.history` already contain candles going back far enough to cover the range cutoff date?

If either condition is true, the fetch is skipped for that item. This means switching between previously-loaded ranges is instant with no network activity.

**Cache invalidation**: Caches are cleared when a user explicitly triggers a per-item or bulk refresh.

---

## localStorage Schema

All data is stored under two keys:

### `portfolio_state`

```ts
PortfolioItem[]   // full array, JSON stringified
```

Each item:
```ts
{
  symbol: string;
  name: string;
  isin?: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  lastUpdated?: string;       // ISO 8601 timestamp
  history: CandleData[];      // { time: string, open, high, low, close }[]
  fetchedRanges: string[];    // e.g. ['1M', '1Y']
  error?: string;
}
```

### `portfolio_ui_state`

```ts
{
  showChart: boolean;
  showTable: boolean;
  showBreakdown: boolean;
}
```

---

## CSV Format

### Export

Semicolon-separated with headers:

```
Symbol;Name;ISIN;Quantity;AvgPrice;LastUpdated;GainLoss
AAPL;Apple Inc;US0378331005;10;150.00;2024-01-15T10:00:00Z;12.50
```

### Import

The parser is flexible and supports:

- **Minimal format**: `Symbol;Qty;Price` (3 columns, no headers required)
- **Extended format**: any subset of `Symbol;Name;ISIN;Quantity;AvgPrice;LastUpdated;GainLoss`
- Header detection is case-insensitive
- If `GainLoss` is present, the importer back-calculates `currentPrice` so gain/loss displays immediately without a live fetch

---

## JSON Export/Import

### Export

Full application state snapshot:

```json
{
  "items": [ ...PortfolioItem[] ]
}
```

Includes `history` arrays and `fetchedRanges` — restoring from JSON means the chart works immediately without re-fetching history.

### Import

- Validates that the root object has an `items` array
- Replaces the entire current portfolio (no merge)
- Triggers a save to localStorage immediately after import

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Network timeout | Retried up to 3 times with backoff; item marked with error message on final failure |
| Symbol not found | Error set on item: "Symbol not found" |
| ISIN not resolvable | Error set on item: falls back to using ISIN as symbol |
| FX rate fetch failure | Falls back to 1.0 rate (price shown in original currency) |
| AbortError | Silently ignored — user-initiated cancellation |
| Invalid CSV/JSON | Alert shown to user; import aborted |
