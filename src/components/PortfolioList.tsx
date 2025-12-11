import React from 'react';
import { HeaderControls } from './PortfolioList/HeaderControls';
import { PortfolioRow } from './PortfolioList/PortfolioRow';
import usePortfolioList from './PortfolioList/usePortfolioList';

type SortColumn = 'name' | 'symbol' | 'isin' | 'qty' | 'avgPrice' | 'current' | 'value' | 'gain' | 'lastUpdated';

export const PortfolioList: React.FC = () => {
  const {
    sortedPortfolio,
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
  } = usePortfolioList();
  const Header = ({ col, label, w }: { col: SortColumn, label: string, w?: string }) => (
    <th
      className={`p-4 cursor-pointer hover:bg-slate-700/40 transition-colors select-none min-w-0 ${w || ''}`}
      onClick={() => handleSort(col)}
    >
      <div className="flex items-center min-w-0">
        {label}
        <SortIcon col={col} />
      </div>
    </th>
  );

  return (
    <div className="glass-panel overflow-hidden max-w-full">
      <HeaderControls
        portfolioLength={portfolio.length}
        onRefreshAll={() => refreshPortfolio()}
        onForceRefresh={() => { if (forceRefreshPortfolioRange && selectedRange) forceRefreshPortfolioRange(selectedRange); }}
        onExportCSV={handleExport}
        onImportCSVClick={handleImportClick}
        onExportJSON={handleExportJSON}
        onImportJSONClick={handleImportJSONClick}
        fileInputRef={fileInputRef}
        jsonFileInputRef={jsonFileInputRef}
        onCSVFileChange={handleFileChange}
        onJSONFileChange={async (e) => {
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
        isLoading={isLoading}
      />
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
            {sortedPortfolio.map((item) => (
              <PortfolioRow key={item.id} item={item} refreshStock={refreshStock} removeStock={removeStock} isLoading={isLoading} />
            ))}
          </tbody>
        </table>
       </div>
      )}
    </div>
  );
};
