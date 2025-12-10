import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, AreaSeries } from 'lightweight-charts';
import type { IChartApi } from 'lightweight-charts';
import { useStore } from '../services/useStore';

export const PortfolioChart: React.FC = () => {
  const { portfolioHistory, portfolio } = useStore();
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

    if (portfolioHistory.length > 0) {
      newSeries.setData(portfolioHistory);
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
  }, [portfolioHistory, portfolio.length]);

  return (
    <div className="glass-panel p-6">
      <h3 className="text-xl font-semibold mb-4 text-slate-200">Portfolio Performance (Last 30 Days)</h3>
      {portfolio.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center text-slate-500">
          No data to display
        </div>
      ) : (
        <div ref={chartContainerRef} className="w-full h-[300px]" />
      )}
    </div>
  );
};
