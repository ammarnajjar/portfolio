export const RANGES = {
  '1D': '1D',
  '1W': '1W',
  '1M': '1M',
  '3M': '3M',
  '1Y': '1Y',
  '5Y': '5Y',
} as const;

export type Range = typeof RANGES[keyof typeof RANGES];

export const YAHOO_RANGE_MAP: Record<Range, string> = {
  '1D': '1d',
  '1W': '5d',
  '1M': '1mo',
  '3M': '3mo',
  '1Y': '1y',
  '5Y': '5y',
};

export const DEFAULT_RANGE: Range = RANGES['1M'];
