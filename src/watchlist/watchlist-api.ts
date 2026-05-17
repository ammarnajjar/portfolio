// src/watchlist/watchlist-api.ts
import type { FundamentalsData } from "./watchlist-types";
import { ISIN_MAP } from "../services/api";

const PROXY_BASE = "https://corsproxy.io/?";
const YAHOO_BASE = "https://query1.finance.yahoo.com";
const YAHOO_SEARCH_BASE = `${YAHOO_BASE}/v1/finance/search`;

const isIsin = (input: string) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(input);

const proxyFetch = async (
  url: string,
  signal?: AbortSignal,
): Promise<unknown> => {
  const response = await fetch(`${PROXY_BASE}${encodeURIComponent(url)}`, { signal });
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
  const url = `/api/yahoo-quotesummary?symbol=${encodeURIComponent(symbol)}&modules=${encodeURIComponent(modules)}`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP error ${response.status}`);
  const data = (await response.json()) as {
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
    defaultKeyStatistics: dks = {},
    financialData: fd = {},
    price: pr,
  } = qs.result[0];

  // trailingPE is computed from price / trailingEps when not directly available
  const trailingEps = raw(dks.trailingEps);
  const currentPrice = raw(pr.regularMarketPrice as RawField);
  const trailingPE =
    trailingEps !== null && trailingEps > 0 && currentPrice !== null
      ? currentPrice / trailingEps
      : null;

  const fundamentals: FundamentalsData = {
    trailingPE,
    forwardPE: raw(dks.forwardPE),
    pegRatio: raw(dks.pegRatio),
    priceToBook: raw(dks.priceToBook),
    enterpriseToEbitda: raw(dks.enterpriseToEbitda),
    profitMargins: raw(fd.profitMargins),
    operatingMargins: raw(fd.operatingMargins),
    grossMargins: raw(fd.grossMargins),
    revenueGrowth: raw(fd.revenueGrowth),
    earningsGrowth: raw(fd.earningsGrowth),
    returnOnEquity: raw(fd.returnOnEquity),
    freeCashflow: raw(fd.freeCashflow),
    totalRevenue: raw(fd.totalRevenue),
    debtToEquity: raw(fd.debtToEquity),
    currentRatio: raw(fd.currentRatio),
    payoutRatio: raw(dks.payoutRatio),
    sharesOutstanding: raw(dks.sharesOutstanding),
    floatShares: raw(dks.floatShares),
  };

  return {
    symbol: pr.symbol || symbol,
    name: pr.longName || symbol,
    currentPrice,
    currency: pr.currency || "USD",
    fundamentals,
  };
};
