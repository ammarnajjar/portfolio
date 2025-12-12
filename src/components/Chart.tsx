import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createChart, ColorType, AreaSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { useStore } from '../services/useStore';
import uiStorage from '../services/ui-storage';
import type { Range } from '../services/ranges';
import { DEFAULT_RANGE } from '../services/ranges';

const RANGE_LABELS: Record<Range, string> = {
  '1D': '(1 Day)',
  '1W': '(1 Week)',
  '1M': '(1 Month)',
  '3M': '(3 Months)',
  '1Y': '(1 Year)',
  '5Y': '(5 Years)',
};

const ORDERED_RANGES: Range[] = ['1D', '1W', '1M', '3M', '1Y', '5Y'];

const getRangeCutoff = (range: Range): Date => {
  const now = new Date();
  switch (range) {
    case '1D':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    case '1W':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    case '1M':
      return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    case '3M':
      return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    case '1Y':
      return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    case '5Y':
      return new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
    default:
      return new Date(0);
  }
};

export const PortfolioChart: React.FC = () => {
  const { portfolioHistory, portfolio, refreshPortfolioRange, setSelectedRange, totalValue } = useStore();
  const [range, setRange] = useState<Range>(DEFAULT_RANGE);
  const [isRangeLoading, setIsRangeLoading] = useState(false);
  const uiState = uiStorage.readUIState();
  const [showBreakdown, setShowBreakdown] = useState<boolean>(() => uiState.showBreakdown ?? false);
  const [showChart, setShowChart] = useState<boolean>(() => uiState.showChart ?? true);

  // persist preference
  useEffect(() => {
    uiStorage.writeUIState({ showChart });
  }, [showChart]);

  // persist breakdown preference
  useEffect(() => {
    uiStorage.writeUIState({ showBreakdown });
  }, [showBreakdown]);

  const filteredHistory = useMemo(() => {
    if (!portfolioHistory || portfolioHistory.length === 0) return [];
    const cutoff = getRangeCutoff(range);
    return portfolioHistory.filter(h => new Date(h.time + 'T00:00:00') >= cutoff);
  }, [portfolioHistory, range]);

  const displayedHistory = useMemo(() => {
    if (!filteredHistory || filteredHistory.length === 0) return [];
    const arr = [...filteredHistory];
    const last = arr[arr.length - 1];
    const today = new Date().toISOString().split('T')[0];
    // compute today's aggregate from per-stock currentPrice * qty (fallback to last candle value)
    let todayValue = 0;
    if (Array.isArray(portfolio) && portfolio.length > 0) {
      todayValue = portfolio.reduce((acc, p) => {
        const qty = p.qty || 0;
        const price = typeof p.currentPrice === 'number' ? p.currentPrice : (Array.isArray(p.history) && p.history.length > 0 ? p.history[p.history.length - 1].value : 0);
        return acc + (price * qty);
      }, 0);
    } else {
      todayValue = totalValue;
    }
    // if computed value is zero, fallback to totalValue
    const finalValue = todayValue > 0 ? todayValue : totalValue;

    if (last.time === today) {
      // replace final point value so chart matches header
      arr[arr.length - 1] = { time: today, value: finalValue };
    } else {
      arr.push({ time: today, value: finalValue });
    }
    return arr;
  }, [filteredHistory, totalValue, portfolio]);

  const periodGain = useMemo(() => {
    if (!displayedHistory || displayedHistory.length < 2) return null;
    const first = displayedHistory[0].value;
    const last = displayedHistory[displayedHistory.length - 1].value;
    const diff = last - first;
    const percent = first > 0 ? (diff / first) * 100 : 0;
    return { diff, percent };
  }, [displayedHistory]);

  const fmt = useMemo(() => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }), []);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  // initialize chart once
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#334155' },
        horzLines: { color: '#334155' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 300,
      timeScale: {
        borderColor: '#475569',
      },
      rightPriceScale: {
        borderColor: '#475569',
      }
    });

    seriesRef.current = chart.addSeries(AreaSeries, {
      lineColor: '#3b82f6',
      topColor: 'rgba(59, 130, 246, 0.4)',
      bottomColor: 'rgba(59, 130, 246, 0.0)',
    });

    chartRef.current = chart;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // mount only once
  }, []);

  // update series data whenever displayedHistory (which includes today's total) changes
  useEffect(() => {
    if (!seriesRef.current) return;
    if (displayedHistory.length > 0) {
      seriesRef.current.setData(displayedHistory);
      chartRef.current?.timeScale().fitContent();
    } else {
      seriesRef.current.setData([]);
    }
  }, [displayedHistory]);

  // when toggling visibility, adjust chart height and fit content
  useEffect(() => {
    if (!chartRef.current || !chartContainerRef.current) return;
    try {
      chartRef.current.applyOptions({ height: showChart ? 300 : 0, width: chartContainerRef.current.clientWidth });
      if (showChart) {
        setTimeout(() => chartRef.current?.timeScale().fitContent(), 50);
      }
    } catch (e) {
      // non-fatal

      console.warn('Failed to resize chart on toggle', e);
    }
  }, [showChart]);

  const perStockBreakdown = useMemo(() => {
    if (!portfolio || portfolio.length === 0) return [];
    const cutoff = getRangeCutoff(range);

    return portfolio.map(p => {
      const h = Array.isArray(p.history) ? p.history.filter(h => new Date(h.time + 'T00:00:00') >= cutoff) : [];
      if (!h || h.length < 2) return { id: p.id, symbol: p.symbol, diff: 0, percent: 0, qty: p.qty };
      const first = h[0].value;
      const last = h[h.length - 1].value;
      const diff = (last - first) * (p.qty || 0);
      const percent = first > 0 ? ((last - first) / first) : 0;
      return { id: p.id, symbol: p.symbol, diff, percent, qty: p.qty };
    }).filter(Boolean).sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [portfolio, range]);

  // Update range locally and set selectedRange in store.
  // Trigger a network fetch only when the chosen range has never been fetched
  // for any portfolio item (applies to all ranges).
  const handleRangeChange = useCallback(async (targetRange: Range) => {
    setRange(targetRange);
    if (setSelectedRange) setSelectedRange(targetRange);

    if (!refreshPortfolioRange) return;

    // If ANY item already has this range, skip network fetch.
    // Special-case DEFAULT_RANGE: consider items with undefined/empty `fetchedRanges`
    // as having fetched DEFAULT_RANGE. Also treat items whose existing `history`
    // already covers the 1M cutoff as having the DEFAULT_RANGE available so we
    // don't trigger a redundant refresh when the local storage contains history
    // but `fetchedRanges` doesn't list "1M".
    const anyHave = Array.isArray(portfolio) && portfolio.some(p => {
      if (Array.isArray(p.fetchedRanges) && p.fetchedRanges!.includes(targetRange)) return true;
      if (targetRange === DEFAULT_RANGE) {
        if (!p.fetchedRanges || p.fetchedRanges.length === 0) return true;
        // if the item's history already reaches back past the 1M cutoff, treat it
        // like we have the DEFAULT_RANGE data available
        if (Array.isArray(p.history) && p.history.length > 0) {
          try {
            // compute earliest date by scanning all history entries (handles unsorted arrays)
            let earliestTs = Infinity;
            for (const row of p.history) {
              const d = Date.parse(row.time + 'T00:00:00');
              if (!Number.isNaN(d) && d < earliestTs) earliestTs = d;
            }
            if (earliestTs !== Infinity) {
              const earliest = new Date(earliestTs);
              const cutoff = getRangeCutoff(DEFAULT_RANGE);
              // normalize to UTC midnight for inclusive comparison
              const eUtc = Date.UTC(earliest.getFullYear(), earliest.getMonth(), earliest.getDate());
              const cUtc = Date.UTC(cutoff.getFullYear(), cutoff.getMonth(), cutoff.getDate());
              if (eUtc <= cUtc) return true;
            }
          } catch {
            // ignore parsing errors and fall through to fetch
          }
        }
      }
      return false;
    });
    if (anyHave) return;

    setIsRangeLoading(true);
    try {
      await refreshPortfolioRange(targetRange);
    } catch (err) {
      console.warn(`Failed to refresh ${targetRange} range`, err);
    } finally {
      setIsRangeLoading(false);
    }
  }, [portfolio, refreshPortfolioRange, setSelectedRange]);

  return (
    <div className="glass-panel p-6">
      <h3 className="text-xl font-semibold mb-4 text-slate-200">Portfolio Performance {RANGE_LABELS[range] ?? ''}{isRangeLoading ? ' — fetching...' : ''}
        {periodGain ? (
          <span className={`ml-3 text-sm ${periodGain.diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {periodGain.diff >= 0 ? '+' : '-'}{fmt.format(Math.abs(periodGain.diff))} ({periodGain.percent >= 0 ? '+' : '-'}{Math.abs(periodGain.percent).toFixed(2)}%)
          </span>
        ) : null}
      </h3>
      {portfolio.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center text-slate-500">
          No data to display
        </div>
      ) : (
        <>
          <div className="mb-2">
            <button
              onClick={() => setShowChart(s => !s)}
              className="text-sm text-slate-300 hover:underline"
              aria-expanded={showChart}
              aria-controls="portfolio-chart-region"
            >
              {showChart ? 'Hide' : 'Show'} chart
            </button>
          </div>
          <div className="w-full">
            <div
              id="portfolio-chart-region"
              ref={chartContainerRef}
              className="w-full overflow-hidden"
              style={{ height: showChart ? 300 : 0 }}
              aria-hidden={!showChart}
            />
            {!showChart ? (
              <div className="h-10 flex items-center justify-between text-slate-200 px-3">
                <div className="text-sm">{fmt.format(totalValue)}</div>
                {periodGain ? (
                  <div className={`text-sm ${periodGain.diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {periodGain.diff >= 0 ? '+' : '-'}{fmt.format(Math.abs(periodGain.diff))} <span className="text-slate-400">({periodGain.percent >= 0 ? '+' : '-'}{Math.abs(periodGain.percent).toFixed(2)}%)</span>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">—</div>
                )}
              </div>
            ) : null}
          </div>
        </>
      )}
        <div className="flex items-center space-x-3">
          <div className="text-slate-300 text-sm">Range</div>
          <div className="inline-flex rounded bg-slate-800/30 p-1">
            {ORDERED_RANGES.map(option => (
              <button
                key={option}
                onClick={() => void handleRangeChange(option)}
                className={`px-3 py-1 text-sm rounded ${range === option ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/40'}`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        {perStockBreakdown.length > 0 ? (
          <div className="mt-4">
            <button onClick={() => setShowBreakdown(s => !s)} className="text-sm text-slate-300 hover:underline mb-2">
              {showBreakdown ? 'Hide' : 'Show'} per-stock breakdown ({perStockBreakdown.length})
            </button>

            {showBreakdown ? (
              <div className="grid grid-cols-2 gap-2">
                {perStockBreakdown.map(s => (
                  <div key={s.id} className="flex items-center justify-between px-3 py-2 bg-slate-800/20 rounded">
                    <div className="text-sm text-slate-200">{s.symbol}</div>
                    <div className={`text-sm ${s.diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{s.diff >= 0 ? '+' : '-'}{fmt.format(Math.abs(s.diff))} <span className="text-slate-400">({(s.percent * 100).toFixed(2)}%)</span></div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
    </div>
  );
};
