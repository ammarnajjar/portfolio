import React from 'react';

import { useStore } from '../services/useStore';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { totalValue, totalCost, totalGain, totalGainPercent, portfolio } = useStore();
  const isPositive = totalGain >= 0;

  return (
    <div className="min-h-screen pb-10">
      <header className="py-6 px-4 mb-8 border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-8xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              Portfolio Tracker
            </h1>
            <div className="text-xs text-slate-400 mt-1">
              Powered by Yahoo Finance
            </div>
          </div>

          {portfolio.length > 0 && (
            <div className="flex gap-8 text-right">
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
      <main className="max-w-8xl mx-auto px-4 space-y-8">
        {children}
      </main>
    </div>
  );
};
