import React, { useState, useMemo } from 'react';
import { useStore } from '../services/useStore';
import { csvService } from '../services/csv';
import type { ParsedCSVRow } from '../services/csv';

type SortColumn = 'name' | 'symbol' | 'isin' | 'qty' | 'avgPrice' | 'current' | 'value' | 'gain' | 'lastUpdated';
type SortDirection = 'asc' | 'desc';

export const PortfolioList: React.FC = () => {
  const { portfolio, removeStock, addStock, refreshPortfolio, refreshStock, exportPortfolio, importPortfolio, selectedRange, forceRefreshPortfolioRange, isLoading } = useStore();
  const [sortCol, setSortCol] = useState<SortColumn>('name');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const jsonFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const csv = csvService.generateCSV(portfolio);
    csvService.downloadCSV(csv);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const items = await csvService.parseCSV(file);
      if (items.length === 0) {
        alert('No valid stocks found in CSV.');
        return;
      }

      const confirmImport = confirm(`Found ${items.length} stocks. Import now? This may take a moment.`);
      if (!confirmImport) return;

      let successCount = 0;
      // Sequential import
          for (const item of items as ParsedCSVRow[]) {
        try {
          // Check if already exists? Store allows duplicates currently, which is fine (separate lots).
          // During CSV import, add without fetching external quote to avoid refreshing immediately
          // If CSV provided gainLoss, estimate currentPrice = (cost + gain) / qty
          let meta: { lastUpdated?: string; currentPrice?: number } | undefined = undefined;
          if (item.lastUpdated) meta = { lastUpdated: item.lastUpdated };
          if (item.gainLoss !== undefined && !isNaN(item.gainLoss)) {
            const gain = item.gainLoss as number;
            const cost = item.qty * item.avgPrice;
            const currentPrice = (cost + gain) / item.qty;
            meta = { ...(meta || {}), currentPrice };
          }
          await addStock(item.symbol, item.qty, item.avgPrice, { fetchQuote: false }, meta);
          successCount++;
        } catch (err) {
          console.error(`Failed to import ${item.symbol}`, err);
        }
        // Brief pause to be nice to API
        await new Promise(r => setTimeout(r, 200));
      }
      alert(`Import complete. Successfully added ${successCount} stocks.`);
    } catch (err) {
      console.error('Import error', err);
      alert('Failed to parse CSV file.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };


  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const sortedPortfolio = useMemo(() => {
    return [...portfolio].sort((a, b) => {
      const currentA = a.currentPrice || a.avgPrice;
      const currentB = b.currentPrice || b.avgPrice;
      const valueA = a.qty * currentA;
      const valueB = b.qty * currentB;
      const gainA = valueA - (a.qty * a.avgPrice);
      const gainB = valueB - (b.qty * b.avgPrice);

      let valA: string | number = '';
      let valB: string | number = '';

      switch (sortCol) {
        case 'name':
          valA = (a.name || a.symbol).toLowerCase();
          valB = (b.name || b.symbol).toLowerCase();
          break;
        case 'isin':
          valA = (a.isin || '').toLowerCase();
          valB = (b.isin || '').toLowerCase();
          break;
        case 'symbol':
          valA = a.symbol.toLowerCase();
          valB = b.symbol.toLowerCase();
          break;
        case 'qty':
          valA = a.qty;
          valB = b.qty;
          break;
        case 'avgPrice':
          valA = a.avgPrice;
          valB = b.avgPrice;
          break;
        case 'current':
          valA = currentA;
          valB = currentB;
          break;
        case 'value':
          valA = valueA;
          valB = valueB;
          break;
        case 'gain':
          valA = gainA;
          valB = gainB;
          break;
        case 'lastUpdated':
          valA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
          valB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
          break;
      }

      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [portfolio, sortCol, sortDir]);

  const SortIcon = ({ col }: { col: SortColumn }) => {
    if (sortCol !== col) return <span className="text-slate-600 ml-1">↕</span>;
    return <span className="text-blue-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };
  const Header = ({ col, label, w }: { col: SortColumn, label: string, w?: string }) => (
    <th
      className={`p-4 cursor-pointer hover:bg-slate-700/40 transition-colors select-none ${w || ''}`}
      onClick={() => handleSort(col)}
    >
      <div className="flex items-center">
        {label}
        <SortIcon col={col} />
      </div>
    </th>
  );

  return (
    <div className="glass-panel overflow-hidden">
      <div className="p-4 flex justify-between items-center border-b border-slate-700/50">
            <button
             onClick={() => {
               if (!forceRefreshPortfolioRange) return;
               const r = selectedRange;
               if (!r) return;
               forceRefreshPortfolioRange(r);
             }}
             disabled={portfolio.length === 0 || !!isLoading}
             className="px-3 py-1.5 bg-rose-700 hover:bg-rose-600 text-slate-200 text-sm rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
             title="Force refresh selected range for all items"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-9-9" />
              </svg>
              Force Refresh
            </button>
        <h2 className="text-xl font-semibold text-white">Holdings</h2>
        <div className="flex gap-2">
          <div className="flex items-center gap-2">
            <button
             onClick={() => refreshPortfolio()}
             disabled={portfolio.length === 0 || !!isLoading}
             className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
             title="Refresh All"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Refresh All
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
             onClick={handleExport}
             disabled={portfolio.length === 0}
             className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
           >
             Export CSV
           </button>
           <button
             onClick={handleImportClick}
             className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors shadow-lg shadow-blue-500/20"
           >
             Import CSV
           </button>
           <input
             type="file"
             ref={fileInputRef}
             hidden
             onChange={handleFileChange}
             accept=".csv"
           />
          </div>

          <div className="flex items-center gap-2">
           <button
             onClick={() => {
               if (!exportPortfolio) return;
               const json = exportPortfolio();
               const blob = new Blob([json], { type: 'application/json' });
               const url = URL.createObjectURL(blob);
               const a = document.createElement('a');
               a.href = url;
               a.download = `portfolio-${new Date().toISOString().slice(0,10)}.json`;
               document.body.appendChild(a);
               a.click();
               a.remove();
               URL.revokeObjectURL(url);
             }}
             disabled={portfolio.length === 0}
             className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
           >
             Export JSON
           </button>
           <button
             onClick={() => jsonFileInputRef.current?.click()}
             className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors shadow-lg shadow-blue-500/20"
           >
             Import JSON
           </button>
           <input
             type="file"
             ref={jsonFileInputRef}
             hidden
             onChange={async (e) => {
               const file = e.target.files?.[0];
               if (!file) return;
               try {
                 const txt = await file.text();
                 if (!importPortfolio) return;
                 const count = importPortfolio(txt);
                 alert(`Imported ${count} items from JSON.`);
               } catch (err) {
                 console.error('Failed to import JSON', err);
                 alert('Invalid portfolio JSON file.');
               } finally {
                 if (jsonFileInputRef.current) jsonFileInputRef.current.value = '';
               }
             }}
             accept="application/json,.json"
           />
          </div>
        </div>
      </div>

      {portfolio.length === 0 ? (
        <div className="p-8 text-center text-slate-400">
          <p>Your portfolio is empty. Add a stock or import a CSV backed up previously.</p>
        </div>
      ) : (
      <div className="overflow-x-auto">
        <table className="w-full table-auto text-left">
          <thead>
            <tr className="bg-slate-700/30 text-slate-300">
              <Header col="name" label="Name" w="max-w-[20ch]" />
              <Header col="isin" label="ISIN" w="max-w-[20ch] w-36" />
              <Header col="symbol" label="Symbol" w="w-24" />
              <Header col="qty" label="Qty" w="w-20" />
              <Header col="avgPrice" label="Avg Price" w="w-28" />
              <Header col="current" label="Current" w="w-28" />
              <Header col="value" label="Value" w="w-28" />
              <Header col="gain" label="Gain/Loss" w="w-28" />
              <Header col="lastUpdated" label="Last Updated" w="w-40" />
              <th className="p-4 w-40">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {sortedPortfolio.map((item) => {
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
                    <td className="p-4 max-w-[20ch]">
                      <div className="font-bold text-white block lg:hidden truncate">{item.name || item.symbol}</div>
                      <div className="font-bold text-white hidden lg:block">{item.name || item.symbol}</div>
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
                         <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-48 bg-slate-800 text-xs text-slate-200 p-2 rounded shadow-xl border border-slate-700 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10">
                           {item.error}
                         </div>
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-slate-300 w-20 whitespace-nowrap">{item.qty}</td>
                  <td className="p-4 text-slate-400 w-28 whitespace-nowrap">€{item.avgPrice.toFixed(2)}</td>
                  <td className="p-4 w-28 whitespace-nowrap">€{current.toFixed(2)}</td>
                  <td className="p-4 font-semibold w-28 whitespace-nowrap">€{value.toFixed(2)}</td>
                  <td className={`p-4 font-medium w-28 whitespace-nowrap ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isPositive ? '+' : ''}€{gain.toFixed(2)} ({gainPercent.toFixed(2)}%)
                  </td>
                   <td className="p-4 w-40 whitespace-nowrap">{item.lastUpdated ? new Date(item.lastUpdated).toLocaleString() : '-'}</td>
                   <td className="p-4 flex gap-2">
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
                    <button
                      onClick={(e) => {
                         e.stopPropagation();
                         removeStock(item.id);
                      }}
                      className="text-slate-500 hover:text-rose-400 transition-colors text-sm px-2"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
       </div>
      )}
    </div>
  );
};
