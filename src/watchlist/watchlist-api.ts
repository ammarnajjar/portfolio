// src/watchlist/watchlist-api.ts
import type { FundamentalsData } from "./watchlist-types";

const PROXY_BASE = "https://corsproxy.io/?";
const YAHOO_BASE = "https://query1.finance.yahoo.com";
const YAHOO_SEARCH_BASE = `${YAHOO_BASE}/v1/finance/search`;

// Mirrors the ISIN_MAP from src/services/api.ts for ISIN resolution
const ISIN_MAP: Record<string, string> = {
  US5949181045: "MSFT",
  US0231351067: "AMZN",
  US02079K3059: "GOOGL",
  US88160R1014: "TSLA",
  US67066G1040: "NVDA",
  US30303M1027: "META",
  US64110L1061: "NFLX",
};

const isIsin = (input: string) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(input);

const proxyFetch = async (
  url: string,
  signal?: AbortSignal,
): Promise<unknown> => {
  const response = await fetch(`${PROXY_BASE}${encodeURIComponent(url)}`, {
    signal,
  });
  if (!response.ok) throw new Error(`HTTP error ${response.status}`);
  return response.json();
};

const resolveSymbol = async (
  isin: string,
  signal?: AbortSignal,
): Promise<string> => {
  if (ISIN_MAP[isin]) return ISIN_MAP[isin];
  const data = (await proxyFetch(
    `${YAHOO_SEARCH_BASE}?q=${isin}&quotesCount=5&newsCount=0`,
    signal,
  )) as { quotes?: Array<{ symbol?: string; quoteType?: string }> };
  const equity = data.quotes?.find(q => q.quoteType === "EQUITY" && q.symbol);
  if (equity?.symbol) return equity.symbol;
  throw new Error(`Could not resolve ISIN ${isin}`);
};

type RawField = { raw?: number } | undefined;
const raw = (f: RawField): number | null => f?.raw ?? null;

export interface FetchFundamentalsResult {
  symbol: string;
  name: string;
  currentPrice: number | null;
  currency: string;
  fundamentals: FundamentalsData;
}

export const fetchFundamentals = async (
  input: string,
  signal?: AbortSignal,
): Promise<FetchFundamentalsResult> => {
  const symbol = isIsin(input)
    ? await resolveSymbol(input, signal)
    : input.toUpperCase();

  const modules = "financialData,defaultKeyStatistics,price";
  const url = `${YAHOO_BASE}/v10/finance/quoteSummary/${symbol}?modules=${modules}`;
  const data = (await proxyFetch(url, signal)) as {
    quoteSummary: {
      result: Array<{
        defaultKeyStatistics: Record<string, RawField>;
        financialData: Record<string, RawField>;
        price: {
          regularMarketPrice?: RawField;
          currency?: string;
          longName?: string;
          symbol?: string;
        };
      }> | null;
      error?: { description?: string } | null;
    };
  };

  const qs = data.quoteSummary;
  if (qs.error)
    throw new Error(qs.error.description || "Yahoo Finance API error");
  if (!qs.result?.[0]) throw new Error("No data returned for symbol");

  const {
    defaultKeyStatistics: dks,
    financialData: fd,
    price: pr,
  } = qs.result[0];

  // trailingPE is computed from price / trailingEps when not directly available
  const trailingEps = raw(dks.trailingEps as RawField);
  const currentPrice = raw(pr.regularMarketPrice as RawField);
  const trailingPE =
    trailingEps && currentPrice && trailingEps > 0
      ? currentPrice / trailingEps
      : null;

  const fundamentals: FundamentalsData = {
    trailingPE,
    forwardPE: raw(dks.forwardPE as RawField),
    pegRatio: raw(dks.pegRatio as RawField),
    priceToBook: raw(dks.priceToBook as RawField),
    enterpriseToEbitda: raw(dks.enterpriseToEbitda as RawField),
    profitMargins: raw(fd.profitMargins as RawField),
    operatingMargins: raw(fd.operatingMargins as RawField),
    grossMargins: raw(fd.grossMargins as RawField),
    revenueGrowth: raw(fd.revenueGrowth as RawField),
    earningsGrowth: raw(fd.earningsGrowth as RawField),
    returnOnEquity: raw(fd.returnOnEquity as RawField),
    freeCashflow: raw(fd.freeCashflow as RawField),
    totalRevenue: raw(fd.totalRevenue as RawField),
    debtToEquity: raw(fd.debtToEquity as RawField),
    currentRatio: raw(fd.currentRatio as RawField),
    payoutRatio: raw(dks.payoutRatio as RawField),
    sharesOutstanding: raw(dks.sharesOutstanding as RawField),
    floatShares: raw(dks.floatShares as RawField),
  };

  return {
    symbol: pr.symbol || symbol,
    name: pr.longName || symbol,
    currentPrice,
    currency: pr.currency || "USD",
    fundamentals,
  };
};
