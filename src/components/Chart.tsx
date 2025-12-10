import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createChart, ColorType, AreaSeries } from 'lightweight-charts';
import type { IChartApi } from 'lightweight-charts';
import { useStore } from '../services/useStore';
import type { Range } from '../services/ranges';
import { DEFAULT_RANGE } from '../services/ranges';

export const PortfolioChart: React.FC = () => {
  const { portfolioHistory, portfolio, refreshPortfolioRange, setSelectedRange } = useStore();
  const [range, setRange] = useState<Range>(DEFAULT_RANGE);
  const [isRangeLoading, setIsRangeLoading] = useState(false);

  const filteredHistory = useMemo(() => {
    if (!portfolioHistory || portfolioHistory.length === 0) return [];
    const now = new Date();
    let cutoff = new Date(0);
    if (range === '1M') cutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    if (range === '3M') cutoff = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    if (range === '1Y') cutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    if (range === '5Y') cutoff = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());

    return portfolioHistory.filter(h => new Date(h.time + 'T00:00:00') >= cutoff);
  }, [portfolioHistory, range]);

  // Range changes are handled directly by button clicks which call `refreshPortfolioRange`.

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (portfolio.length === 0) return;

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

    const newSeries = chart.addSeries(AreaSeries, {
      lineColor: '#3b82f6',
      topColor: 'rgba(59, 130, 246, 0.4)',
      bottomColor: 'rgba(59, 130, 246, 0.0)',
    });

    if (filteredHistory.length > 0) {
      newSeries.setData(filteredHistory);
      chart.timeScale().fitContent();
    }

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
    };
  }, [filteredHistory, portfolio.length]);

  return (
    <div className="glass-panel p-6">
      <h3 className="text-xl font-semibold mb-4 text-slate-200">Portfolio Performance {range === '1M' ? '(1 Month)' : range === '3M' ? '(3 Months)' : range === '1Y' ? '(1 Year)' : range === '5Y' ? '(5 Years)' : ''}{isRangeLoading ? ' — fetching...' : ''}</h3>
      {portfolio.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center text-slate-500">
          No data to display
        </div>
      ) : (
        <div ref={chartContainerRef} className="w-full h-[300px]" />
      )}
        <div className="flex items-center space-x-3">
          <div className="text-slate-300 text-sm">Range</div>
          <div className="inline-flex rounded bg-slate-800/30 p-1">
            <button
              onClick={async () => {
                if (!refreshPortfolioRange) return;
                setRange('1M');
                // If all items already have 1M fetched, skip network call
                const allHave = portfolio.length > 0 && portfolio.every(p => p.fetchedRanges && p.fetchedRanges.includes('1M'));
                if (allHave) {
                  if (setSelectedRange) setSelectedRange('1M' as Range);
                  return;
                }
                setIsRangeLoading(true);
                if (setSelectedRange) setSelectedRange('1M');
                try {
                  await refreshPortfolioRange('1M');
                } catch (err) {
                  // Log and continue; UI will show previous state
                  console.warn('Failed to refresh 1M range', err);
                } finally {
                  setIsRangeLoading(false);
                }
              }}
              className={`px-3 py-1 text-sm rounded ${range === '1M' ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/40'}`}>
              1M
            </button>
            <button
              onClick={async () => {
                if (!refreshPortfolioRange) return;
                setRange('3M');
                const allHave = portfolio.length > 0 && portfolio.every(p => p.fetchedRanges && p.fetchedRanges.includes('3M'));
                if (allHave) {
                  if (setSelectedRange) setSelectedRange('3M' as Range);
                  return;
                }
                setIsRangeLoading(true);
                if (setSelectedRange) setSelectedRange('3M' as Range);
                try {
                  await refreshPortfolioRange('3M' as Range);
                } catch (err) {
                  console.warn('Failed to refresh 3M range', err);
                } finally {
                  setIsRangeLoading(false);
                }
              }}
              className={`px-3 py-1 text-sm rounded ${range === '3M' ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/40'}`}>
              3M
            </button>
            <button
              onClick={async () => {
                if (!refreshPortfolioRange) return;
                setRange('1Y');
                const allHave = portfolio.length > 0 && portfolio.every(p => p.fetchedRanges && p.fetchedRanges.includes('1Y'));
                if (allHave) {
                  if (setSelectedRange) setSelectedRange('1Y' as Range);
                  return;
                }
                setIsRangeLoading(true);
                if (setSelectedRange) setSelectedRange('1Y' as Range);
                try {
                  await refreshPortfolioRange('1Y' as Range);
                } catch (err) {
                  console.warn('Failed to refresh 1Y range', err);
                } finally {
                  setIsRangeLoading(false);
                }
              }}
              className={`px-3 py-1 text-sm rounded ${range === '1Y' ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/40'}`}>
              1Y
            </button>
            <button
              onClick={async () => {
                if (!refreshPortfolioRange) return;
                setRange('5Y');
                const allHave = portfolio.length > 0 && portfolio.every(p => p.fetchedRanges && p.fetchedRanges.includes('5Y'));
                if (allHave) {
                  if (setSelectedRange) setSelectedRange('5Y' as Range);
                  return;
                }
                setIsRangeLoading(true);
                if (setSelectedRange) setSelectedRange('5Y' as Range);
                try {
                  await refreshPortfolioRange('5Y' as Range);
                } catch (err) {
                  console.warn('Failed to refresh 5Y range', err);
                } finally {
                  setIsRangeLoading(false);
                }
              }}
              className={`px-3 py-1 text-sm rounded ${range === '5Y' ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/40'}`}>
              5Y
            </button>
          </div>
        </div>
    </div>
  );
};
