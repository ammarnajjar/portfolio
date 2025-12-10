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

const PROXY_BASE = 'https://corsproxy.io/?';
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

const fetchWithTimeout = async (url: string, options: RequestInit & { timeout?: number } = {}) => {
  const { timeout = 10000, signal, ...rest } = options;
  const controller = new AbortController();

  // If external signal aborts, we abort our controller
  const onSignalAbort = () => {
    controller.abort(signal?.reason || new Error('Aborted by user'));
  };

  if (signal) {
    if (signal.aborted) throw (signal.reason || new Error('Aborted by user'));
    signal.addEventListener('abort', onSignalAbort);
  }

  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${timeout}ms`));
  }, timeout);

  try {
    const response = await fetch(url, { ...rest, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return response;
  } finally {
    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', onSignalAbort);
  }
};

export const api = {
  async getMetadata(query: string, signal?: AbortSignal): Promise<{ symbol: string; name: string; isin?: string }> {
    const queryUrl = `${YAHOO_SEARCH_BASE}?q=${query}&quotesCount=1&newsCount=0`;
    const encodedUrl = encodeURIComponent(queryUrl);

    try {
      const response = await fetchWithTimeout(`${PROXY_BASE}${encodedUrl}`, { signal, timeout: 8000 });
      // Direct JSON parsing (corsproxy returns the target response directly)
      const data = await response.json();

      let symbol = query.toUpperCase();
      let name = query.toUpperCase();
      let isin: string | undefined;

      const quote = data.quotes?.[0];
      if (quote) {
          symbol = quote.symbol;
          name = quote.longname || quote.shortname || quote.symbol;
          isin = quote.isin;
      }

      // Fallback: Check local inverted map for ISIN if missing
      if (!isin && SYMBOL_TO_ISIN[symbol]) {
        isin = SYMBOL_TO_ISIN[symbol];
      }
      if (!isin && SYMBOL_TO_ISIN[query.toUpperCase()]) {
         isin = SYMBOL_TO_ISIN[query.toUpperCase()];
      }

      return { symbol, name, isin };
    } catch (e: unknown) {
      // Propagate aborts
      if (signal?.aborted) throw e;

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
    if (ISIN_MAP[isin]) {
      return ISIN_MAP[isin];
    }

    const queryUrl = `${YAHOO_SEARCH_BASE}?q=${isin}&quotesCount=5&newsCount=0`;
    const encodedUrl = encodeURIComponent(queryUrl);

    // Retry loop
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetchWithTimeout(`${PROXY_BASE}${encodedUrl}`, { signal, timeout: 8000 });
        const data = await response.json(); // Direct JSON

        const quotes = (data.quotes || []) as SearchQuote[];

        const equity = quotes.find(q => q.quoteType === 'EQUITY' && !!q.symbol);
        const bestMatch = equity || quotes[0];

        if (bestMatch && bestMatch.symbol) {
          return bestMatch.symbol;
        }
        throw new Error('ISIN not found in search results');
      } catch (e) {
        if (signal?.aborted) throw e;
        console.warn(`ISIN resolve attempt ${attempt + 1} failed:`, e);
        if (attempt === 0) await new Promise(r => setTimeout(r, 1000));
      }
    }

    throw new Error(`Could not resolve ISIN ${isin}. Try using the Ticker (e.g. AAPL).`);
  },

  async getExchangeRate(from: string, to: string, signal?: AbortSignal): Promise<number> {
    if (from === to) return 1;

    const fetchRate = async (url: string): Promise<number | null> => {
      try {
        const response = await fetchWithTimeout(`${PROXY_BASE}${encodeURIComponent(url)}`, { signal, timeout: 6000 });
        const data = await response.json(); // Direct JSON
        const rate = data.chart?.result?.[0]?.meta?.regularMarketPrice;
        return rate || null;
      } catch (e) {
        if (signal?.aborted) throw e;
        return null; // Return null to indicate failure (and maybe try next fallback)
      }
    };

    // Special handling for USD -> EUR
    if (from === 'USD' && to === 'EUR') {
        const rate = await fetchRate(`${YAHOO_BASE}/EUR=X?interval=1d&range=1d`); // EUR=X is actually USD/EUR
        if (rate) return rate;
    }

    // Standard pair
    const pair = `${from}${to}=X`;
    const rate = await fetchRate(`${YAHOO_BASE}/${pair}?interval=1d&range=1d`);
    if (rate) return rate;

    // Retry once with slightly longer timeout
    await new Promise(r => setTimeout(r, 500));
    const retryRate = await fetchRate(`${YAHOO_BASE}/${pair}?interval=1d&range=1d`);
    if (retryRate) return retryRate;

    console.warn('FX Rate failed, defaulting to 1');
    return 1;
  },

  async fetchStock(input: string, rangeOrSignal?: import('./ranges').Range | AbortSignal, maybeSignal?: AbortSignal): Promise<{ quote: Quote; history: Candle[] }> {
    let query = input;
    // Default range for chart history
    const { YAHOO_RANGE_MAP, DEFAULT_RANGE } = await import('./ranges');
    let range = YAHOO_RANGE_MAP[DEFAULT_RANGE];
    let signal: AbortSignal | undefined;
    if (typeof rangeOrSignal === 'string') {
      range = YAHOO_RANGE_MAP[rangeOrSignal as import('./ranges').Range] || rangeOrSignal || YAHOO_RANGE_MAP[DEFAULT_RANGE];
      signal = maybeSignal;
    } else {
      signal = rangeOrSignal as AbortSignal | undefined;
    }
    if (/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(input)) {
      try {
        query = await this.resolveISIN(input, signal);
      } catch (e) {
        if (signal?.aborted) throw e;
        console.warn('ISIN resolution failed', e);
      }
    }

    const metadata = await this.getMetadata(query, signal);
    const symbol = metadata.symbol;

    const queryUrl = `${YAHOO_BASE}/${symbol}?interval=1d&range=${range}`;
    const encodedUrl = encodeURIComponent(queryUrl);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetchWithTimeout(`${PROXY_BASE}${encodedUrl}`, { signal, timeout: 10000 });
        const data = await response.json(); // Direct JSON

        const result = data.chart?.result?.[0];

        if (!result) throw new Error('Stock not found or invalid API response');

        const meta = result.meta;
        let currency = meta.currency || 'USD';
        let isPence = false;

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

        let currentPrice = meta.regularMarketPrice;
        let previousClose = meta.chartPreviousClose;

        if (isPence) {
          currentPrice /= 100;
          previousClose /= 100;
        }

        currentPrice *= rate;
        previousClose *= rate;

        const changePercent = ((currentPrice - previousClose) / previousClose) * 100;

        const history: Candle[] = timestamps.map((ts: number, i: number) => {
          const date = new Date(ts * 1000);
          const time = date.toISOString().split('T')[0];
          let val = closes[i];
          if (val && isPence) val /= 100;
          return {
            time,
            value: val ? val * rate : 0,
          };
        }).filter((c: Candle) => c.value !== null && c.value !== 0);

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
        if (signal?.aborted) throw e;

        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`Attempt ${attempt + 1} failed for ${symbol}: ${msg}`);
        lastError = e instanceof Error ? e : new Error(msg);

        if (attempt < 2) await new Promise(r => setTimeout(r, 1500));
      }
    }

    throw lastError || new Error(`Failed to fetch ${symbol}`);
  }
};
