export interface Candle {
  time: string; // 'yyyy-mm-dd'
  value: number;
}

export interface Quote {
  symbol: string;
  price: number;
  changePercent: number;
  currency: string;
  name?: string;
  isin?: string;
}

const PROXY_BASE = 'https://api.allorigins.win/get?url=';
const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const YAHOO_SEARCH_BASE = 'https://query1.finance.yahoo.com/v1/finance/search';

// Fallback map for common ISINs that fail to resolve via free API
const ISIN_MAP: Record<string, string> = {
  'US0378331005': 'AAPL', // Apple
  'US5949181045': 'MSFT', // Microsoft
  'US0231351067': 'AMZN', // Amazon
  'FR0000120271': 'TTE.PA', // TotalEnergies
  'DE0007037129': 'RWE.DE', // RWE
  'GB00BP6MXD84': 'SHEL.L', // Shell
  'DE0008404005': 'ALV.DE', // Allianz
  'US02079K3059': 'GOOGL',  // Alphabet A
  'US88160R1014': 'TSLA',   // Tesla
  'US67066G1040': 'NVDA',   // NVIDIA
  'US11135F1012': 'AVGO',   // Broadcom
  'IE00B3WJKG14': 'QDVE.DE', // iShares S&P 500 Info Tech (Xetra EUR) - User verified
  'US30303M1027': 'META',   // Meta
  'US64110L1061': 'NFLX',   // Netflix
  'LU1781541179': 'SPOT',   // Spotify
  'IE00B5BMR087': 'CSSPX.MI', // iShares Core S&P 500 (Milan)
  'IE00B4L5Y983': 'IWDA.L',   // iShares Core MSCI World (London)
  'IE00B8FHGS14': 'SPMV.L',   // iShares Edge S&P 500 Min Vol (London)
  'US0000000000': 'SPY',  // Example placeholder
};

// Invert map for Symbol -> ISIN lookup
const SYMBOL_TO_ISIN = Object.entries(ISIN_MAP).reduce((acc, [isin, symbol]) => {
  acc[symbol] = isin;
  return acc;
}, {} as Record<string, string>);

type SearchQuote = { quoteType?: string; symbol?: string; [k: string]: unknown };

export const api = {
  async getMetadata(query: string, signal?: AbortSignal): Promise<{ symbol: string; name: string; isin?: string }> {
    const queryUrl = `${YAHOO_SEARCH_BASE}?q=${query}&quotesCount=1&newsCount=0`;
    const encodedUrl = encodeURIComponent(queryUrl);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      // If an external signal is provided, abort the local controller when it aborts
      if (signal) signal.addEventListener('abort', () => controller.abort());
      const response = await fetch(`${PROXY_BASE}${encodedUrl}`, { signal: controller.signal });
      clearTimeout(timeoutId);

      const data = await response.json();

      let symbol = query.toUpperCase();
      let name = query.toUpperCase();
      let isin: string | undefined;

      if (data.contents) {
        const searchData = JSON.parse(data.contents);
        const quote = searchData.quotes?.[0];
        if (quote) {
            symbol = quote.symbol;
            name = quote.longname || quote.shortname || quote.symbol;
            isin = quote.isin;
        }
      }

      // Fallback: Check local inverted map for ISIN if missing
      if (!isin && SYMBOL_TO_ISIN[symbol]) {
        isin = SYMBOL_TO_ISIN[symbol];
      }
      // Also check if the query itself was a known symbol in our map
      if (!isin && SYMBOL_TO_ISIN[query.toUpperCase()]) {
         isin = SYMBOL_TO_ISIN[query.toUpperCase()];
      }

      return { symbol, name, isin };
    } catch (e: unknown) {
      // If fetch was aborted, propagate so callers can stop
      const err = e as Error | undefined;
      if ((err && (err.name === 'AbortError' || err.message === 'AbortError')) || (signal && signal.aborted)) {
        throw e;
      }
      console.warn('Metadata fetch failed:', e);
      // Fallback to local map even on error
      const knownIsin = SYMBOL_TO_ISIN[query.toUpperCase()];
      return {
          symbol: query.toUpperCase(),
          name: query.toUpperCase(),
          isin: knownIsin
      };
    }
  },

  async resolveISIN(isin: string, signal?: AbortSignal): Promise<string> {
    // 0. Check local fallback map first
    if (ISIN_MAP[isin]) {
      console.log(`Resolved ISIN ${isin} via local map to ${ISIN_MAP[isin]}`);
      return ISIN_MAP[isin];
    }

    // Increase count to find better matches
    const queryUrl = `${YAHOO_SEARCH_BASE}?q=${isin}&quotesCount=5&newsCount=0`;
    const encodedUrl = encodeURIComponent(queryUrl);

    try {
      const controller = new AbortController();
      if (signal) signal.addEventListener('abort', () => controller.abort());
      const response = await fetch(`${PROXY_BASE}${encodedUrl}`, { signal: controller.signal });
      const data = await response.json();
      if (!data.contents) throw new Error('No data from proxy during ISIN resolve');

      const searchData = JSON.parse(data.contents);
      const quotes = (searchData.quotes || []) as SearchQuote[];

      // Filter for Equity first, then generic
      const equity = quotes.find(q => q.quoteType === 'EQUITY' && !!q.symbol);
      const bestMatch = equity || quotes[0];

      if (bestMatch && bestMatch.symbol) {
        return bestMatch.symbol;
      }
      throw new Error('ISIN not found');
    } catch (e: unknown) {
      // If aborted, propagate
      const err = e as Error | undefined;
      if ((err && (err.name === 'AbortError' || err.message === 'AbortError')) || (signal && signal.aborted)) {
        throw e;
      }
      console.warn('ISIN resolve failed, retrying...');
      // Retry once
      try {
        const controller2 = new AbortController();
        if (signal) signal.addEventListener('abort', () => controller2.abort());
        const response = await fetch(`${PROXY_BASE}${encodedUrl}`, { signal: controller2.signal });
        const data = await response.json();
        const searchData = JSON.parse(data.contents);
        const quotes = (searchData.quotes || []) as SearchQuote[];
        const bestMatch = quotes[0];
        if (bestMatch && bestMatch.symbol) return bestMatch.symbol;
      } catch (retryErr: unknown) {
        // If retry was aborted, propagate
        const rerr = retryErr as Error | undefined;
        if ((rerr && (rerr.name === 'AbortError' || rerr.message === 'AbortError')) || (signal && signal.aborted)) {
          throw retryErr;
        }
        console.error('ISIN Resolution Retry Error:', retryErr);
      }
      throw new Error(`Could not resolve ISIN ${isin}. Please try using the Ticker symbol (e.g. AAPL).`);
    }
  },

  async getExchangeRate(from: string, to: string, signal?: AbortSignal): Promise<number> {
    if (from === to) return 1;

    // Retry helper
    const fetchWithRetry = async (url: string, retries = 3): Promise<number | null> => {
      for (let i = 0; i < retries; i++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          if (signal) signal.addEventListener('abort', () => controller.abort());
          const response = await fetch(`${PROXY_BASE}${encodeURIComponent(url)}`, { signal: controller.signal });
          clearTimeout(timeoutId);
          const data = await response.json();
          if (!data.contents) throw new Error('No content');
          const yahooData = JSON.parse(data.contents);
          const rate = yahooData.chart.result?.[0]?.meta?.regularMarketPrice;
          if (rate) return rate;
             } catch {
               if (i === retries - 1) console.warn(`FX fetch failed after ${retries} attempts: ${url}`);
               await new Promise(r => setTimeout(r, 1000));
             }
      }
      return null;
    };

    // Special handling for USD -> EUR
    if (from === 'USD' && to === 'EUR') {
        const url = `${YAHOO_BASE}/EUR=X?interval=1d&range=1d`;
        const rate = await fetchWithRetry(url);
        if (rate) return rate; // EUR=X is USD/EUR (~0.95)
    }

    // Default strategy
    const pair = `${from}${to}=X`;
    const url = `${YAHOO_BASE}/${pair}?interval=1d&range=1d`;
    const rate = await fetchWithRetry(url);
    if (rate) return rate;

    console.warn('FX Rate failed, defaulting to 1');
    return 1;
  },

  async fetchStock(input: string, signal?: AbortSignal): Promise<{ quote: Quote; history: Candle[] }> {
    // 1. Resolve ISIN if detected
    let query = input;
    // Basic ISIN regex: 2 letters, 9 alphanum, 1 digit
    if (/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(input)) {
      try {
        query = await this.resolveISIN(input, signal);
        console.log(`Resolved ISIN ${input} to ${query}`);
      } catch (e) {
        console.warn('ISIN resolution failed in fetchStock', e);
        // Fallback to original input if resolve fails (though resolveISIN throws if not found)
      }
    }

    // 2. Get Metadata (Symbol, Name, ISIN) with resolved symbol
      const metadata = await this.getMetadata(query, signal);
    const symbol = metadata.symbol;

    const range = '1mo';
    const interval = '1d';
    const queryUrl = `${YAHOO_BASE}/${symbol}?interval=${interval}&range=${range}`;
    const encodedUrl = encodeURIComponent(queryUrl);

    let lastError: Error | null = null;
    // Retry loop for chart data (proxy can be flaky)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout for chart data
        if (signal) signal.addEventListener('abort', () => controller.abort());
        const response = await fetch(`${PROXY_BASE}${encodedUrl}`, { signal: controller.signal });
        clearTimeout(timeoutId);

        const data = await response.json();

        if (!data.contents) {
          throw new Error('No data received from proxy');
        }

        const yahooData = JSON.parse(data.contents);
        const result = yahooData.chart.result?.[0];

        if (!result) {
          // If 404 or empty result, might be invalid symbol, don't retry endlessly unless it's a 500-like error disguised
           throw new Error('Stock not found or API error');
        }

        // --- Success path ---
        const meta = result.meta;
        let currency = meta.currency || 'USD';
      let isPence = false;

      // Handle GBp (Pence Sterling)
      if (currency === 'GBp') {
        currency = 'GBP';
        isPence = true;
      }

      let rate = 1;
      if (currency !== 'EUR') {
            rate = await this.getExchangeRate(currency, 'EUR', signal);
      }

      const timestamps = result.timestamp || [];
      const quotes = result.indicators.quote[0];
      const closes = quotes.close || [];

      // Extract current price info
      let currentPrice = meta.regularMarketPrice;
      let previousClose = meta.chartPreviousClose;

      if (isPence) {
        currentPrice = currentPrice / 100;
        previousClose = previousClose / 100;
      }

      // Apply FX rate
      currentPrice = currentPrice * rate;
      previousClose = previousClose * rate;

      const changePercent = ((currentPrice - previousClose) / previousClose) * 100;

      // Map history for Lightweight Charts (Area Series)
      const history: Candle[] = timestamps.map((ts: number, i: number) => {
        const date = new Date(ts * 1000);
        // Format YYYY-MM-DD
        const time = date.toISOString().split('T')[0];
        let val = closes[i];

        if (val && isPence) {
          val = val / 100;
        }

        return {
          time,
          value: val ? val * rate : 0,
        };
      }).filter((c: Candle) => c.value !== null && c.value !== 0);

      console.log(`Fetched ${symbol} (${currency}):`, { currentPrice, changePercent, historyLen: history.length, fxRate: rate });

      return {
        quote: {
          symbol: symbol.toUpperCase(),
          price: currentPrice,
          changePercent,
          currency: 'EUR',
          name: metadata.name,
          isin: metadata.isin,
        },
        history,
      };
      } catch (e: unknown) {
        if (e instanceof Error) {
          console.warn(`Attempt ${attempt + 1} failed for ${symbol}:`, e.message);
          lastError = e;
        } else {
          console.warn(`Attempt ${attempt + 1} failed for ${symbol}:`, e);
          lastError = new Error(String(e));
        }
        // Wait 1s before retry
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    throw lastError || new Error(`Failed to fetch stock ${symbol} after retries`);
  }
};
