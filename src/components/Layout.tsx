import React from 'react';

import { useStore } from '../services/useStore';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { totalValue, totalCost, totalGain, totalGainPercent, portfolio, autoRefreshEnabled, setAutoRefreshEnabled, autoRefreshIntervalMinutes, setAutoRefreshIntervalMinutes, autoRefreshIntervalIsDefault } = useStore();
  const isPositive = totalGain >= 0;

  return (
    <div className="min-h-screen pb-10 px-2 sm:px-4">
      <header className="py-6 px-4 mb-8 border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-8xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              Portfolio Tracker
            </h1>
            <div className="text-xs text-slate-400 mt-1">
              Powered by Yahoo Finance
            </div>
          </div>

          {portfolio.length > 0 && (
            <div className="flex gap-8 flex-wrap md:flex-nowrap text-right items-center">
              <div className="flex items-center gap-3">
                <button
                  className={`px-3 py-1 rounded-md text-sm font-medium ${autoRefreshEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-200'}`}
                  onClick={() => setAutoRefreshEnabled && setAutoRefreshEnabled(!autoRefreshEnabled)}
                >
                  {autoRefreshEnabled ? 'Auto Refresh: On' : 'Auto Refresh: Off'}
                </button>
                <div className="text-xs text-slate-400 ml-2 flex items-center gap-2">
                  <span>Interval</span>
                  <div className="flex items-center gap-2">
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                      {[1,5,15,60].map((m) => (
                        <div key={m} className="flex items-center gap-2">
                          <button
                            className={`w-full text-center px-2 py-1 rounded text-sm ${autoRefreshIntervalMinutes === m ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-200'}`}
                            onClick={() => setAutoRefreshIntervalMinutes && setAutoRefreshIntervalMinutes(m)}
                            aria-label={`set-interval-${m}`}
                          >
                            {m}m
                          </button>
                          {m === 5 && autoRefreshIntervalIsDefault && (
                            <span className="text-[10px] text-slate-300">(default)</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Total Invested</div>
                <div className="text-xl font-semibold text-slate-300">€{totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Total Value</div>
                <div className="text-2xl font-bold text-white">€{totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className={`text-sm font-medium ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isPositive ? '+' : ''}€{totalGain.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({totalGainPercent.toFixed(2)}%)
                </div>
              </div>
            </div>
          )}
        </div>
      </header>
      <main className="max-w-8xl mx-auto space-y-8">
        {children}
      </main>
    </div>
  );
};
