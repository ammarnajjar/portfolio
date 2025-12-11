import React from 'react';
import type { PortfolioItem } from '../../services/store-types';

type Props = {
  item: PortfolioItem;
  refreshStock: (id: string) => void;
  removeStock: (id: string) => void;
  isLoading?: boolean;
};

export const PortfolioRow: React.FC<Props> = ({ item, refreshStock, removeStock, isLoading }) => {
  const current = item.currentPrice || item.avgPrice;
  const value = item.qty * current;
  const cost = item.qty * item.avgPrice;
  const gain = value - cost;
  const gainPercent = (gain / cost) * 100;
  const isPositive = gain >= 0;

  return (
    <tr
      key={item.id}
      className={`hover:bg-slate-700/20 transition-colors
        ${item.isRefreshing ? 'bg-blue-900/30 ring-1 ring-blue-500/50 animate-pulse' : ''}
        ${item.error ? 'bg-red-900/20 ring-1 ring-red-500/30' : ''}
      `}
    >
      <td className="p-4 max-w-[20ch] min-w-0">
        <div className="font-bold text-white block lg:hidden truncate min-w-0">{item.name || item.symbol}</div>
        <div className="font-bold text-white hidden lg:block min-w-0 truncate">{item.name || item.symbol}</div>
      </td>
      <td className="p-4 w-36 max-w-[20ch]">
        {item.isin ? (
          <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
            <span className="truncate block lg:hidden max-w-[20ch]">{item.isin}</span>
            <span className="hidden lg:block max-w-[40ch] break-words">{item.isin}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(item.isin!);
              }}
              className="hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100"
              title="Copy ISIN"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5" />
              </svg>
            </button>
          </div>
        ) : null}
      </td>
      <td className="p-4 text-slate-300 font-medium w-24 whitespace-nowrap flex items-center gap-2">
        {item.symbol}
        {item.error && (
          <div className="group relative">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-red-400 cursor-help">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
            </svg>
            <div className="absolute lg:left-full left-auto right-0 top-1/2 -translate-y-1/2 lg:ml-2 ml-0 w-48 bg-slate-800 text-xs text-slate-200 p-2 rounded shadow-xl border border-slate-700 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10">
              {item.error}
            </div>
          </div>
        )}
      </td>
      <td className="p-4 text-slate-300 w-20 min-w-0 whitespace-normal sm:whitespace-nowrap">{item.qty}</td>
        <td className="p-4 text-slate-400 w-28 min-w-0 whitespace-normal sm:whitespace-nowrap">€{item.avgPrice.toFixed(2)}</td>
        <td className="p-4 w-28 min-w-0 whitespace-normal sm:whitespace-nowrap">€{current.toFixed(2)}</td>
        <td className="p-4 font-semibold w-28 min-w-0 whitespace-normal sm:whitespace-nowrap">€{value.toFixed(2)}</td>
        <td className={`p-4 font-medium w-28 min-w-0 whitespace-normal sm:whitespace-nowrap ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
        {isPositive ? '+' : ''}€{gain.toFixed(2)} ({gainPercent.toFixed(2)}%)
      </td>
        <td className="p-4 w-40 min-w-0 whitespace-normal sm:whitespace-nowrap">{item.lastUpdated ? new Date(item.lastUpdated).toLocaleString() : '-'}</td>
        <td className="p-4 flex gap-3 items-center min-w-0">
        <div className="relative group">
          <button
            onClick={(e) => {
              e.stopPropagation();
              refreshStock(item.id);
            }}
            className="p-1 text-slate-400 hover:text-blue-400 transition-colors"
            title="Refresh Quote"
            disabled={!!item.isRefreshing || !!isLoading}
          >
            {item.isRefreshing ? (
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          )}
        </button>
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-xs text-slate-200 p-1 rounded shadow-lg border border-slate-700 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity max-w-[90vw] lg:max-w-xs">
          Refresh
        </div>
        </div>

        <div className="relative group">
          <button
            onClick={(e) => {
               e.stopPropagation();
               removeStock(item.id);
            }}
            className="text-slate-500 hover:text-rose-400 transition-colors text-sm px-2"
            title="Remove stock"
            aria-label={`Remove ${item.symbol}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M9 3a1 1 0 00-1 1v1H5a1 1 0 000 2h14a1 1 0 100-2h-3V4a1 1 0 00-1-1H9z" />
              <path fillRule="evenodd" d="M6 8a1 1 0 011 1v9a3 3 0 003 3h4a3 3 0 003-3V9a1 1 0 112 0v9a5 5 0 01-5 5H10a5 5 0 01-5-5V9a1 1 0 011-1z" clipRule="evenodd" />
              <path d="M9 11a1 1 0 012 0v6a1 1 0 11-2 0v-6zm4 0a1 1 0 012 0v6a1 1 0 11-2 0v-6z" />
            </svg>
          </button>
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-xs text-slate-200 p-1 rounded shadow-lg border border-slate-700 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity max-w-[90vw] lg:max-w-xs">
            Remove
          </div>
        </div>
      </td>
    </tr>
  );
};