import React, { useMemo, useState } from 'react'
import { csvService } from '../../services/csv'
import type { ParsedCSVRow } from '../../services/csv'
import { useStore } from '../../services/useStore'

type SortColumn = 'name' | 'symbol' | 'isin' | 'qty' | 'avgPrice' | 'current' | 'value' | 'gain' | 'lastUpdated';
type SortDirection = 'asc' | 'desc';

export const usePortfolioList = () => {
  const { portfolio, addStock, importPortfolio, exportPortfolio, refreshPortfolio, refreshStock, selectedRange, forceRefreshPortfolioRange, isLoading, removeStock } = useStore();

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
      for (const item of items as ParsedCSVRow[]) {
        try {
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

  const handleExportJSON = () => {
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
  };

  const handleImportJSONClick = () => {
    jsonFileInputRef.current?.click();
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

  return {
    sortedPortfolio,
    sortCol,
    sortDir,
    handleSort,
    SortIcon,
    fileInputRef,
    jsonFileInputRef,
    handleExport,
    handleImportClick,
    handleFileChange,
    handleExportJSON,
    handleImportJSONClick,
    refreshStock,
    refreshPortfolio,
    forceRefreshPortfolioRange,
    selectedRange,
    isLoading,
    portfolio,
    importPortfolio,
    removeStock,
  };
}

export default usePortfolioList;
