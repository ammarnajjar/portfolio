import React from 'react';
// Header controls for PortfolioList

type Props = {
  portfolioLength: number;
  onRefreshAll: () => void;
  onForceRefresh?: () => void;
  onExportCSV: () => void;
  onImportCSVClick: () => void;
  onExportJSON: () => void;
  onImportJSONClick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  jsonFileInputRef: React.RefObject<HTMLInputElement | null>;
  onCSVFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onJSONFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  isLoading?: boolean;
};

export const HeaderControls: React.FC<Props> = ({
  portfolioLength,
  onRefreshAll,
  onForceRefresh,
  onExportCSV,
  onImportCSVClick,
  onExportJSON,
  onImportJSONClick,
  fileInputRef,
  jsonFileInputRef,
  onCSVFileChange,
  onJSONFileChange,
  isLoading,
}) => {
  return (
    <div className="p-4 flex justify-between items-center border-b border-slate-700/50">
      <div className="flex items-center gap-2">
        <button
          onClick={onRefreshAll}
          disabled={portfolioLength === 0 || !!isLoading}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          title="Refresh All"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Refresh All
        </button>

        <button
          onClick={onForceRefresh}
          disabled={portfolioLength === 0 || !!isLoading}
          className="px-3 py-1.5 bg-rose-700 hover:bg-rose-600 text-slate-200 text-sm rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          title="Force refresh selected range for all items"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-9-9" />
          </svg>
          Force Refresh
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onExportCSV}
          disabled={portfolioLength === 0}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Export CSV
        </button>
        <button
          onClick={onImportCSVClick}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors shadow-lg shadow-blue-500/20"
        >
          Import CSV
        </button>
        <input
          type="file"
          ref={fileInputRef}
          hidden
          onChange={onCSVFileChange}
          accept=".csv"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onExportJSON}
          disabled={portfolioLength === 0}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Export JSON
        </button>
        <button
          onClick={onImportJSONClick}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors shadow-lg shadow-blue-500/20"
        >
          Import JSON
        </button>
        <input
          type="file"
          ref={jsonFileInputRef}
          hidden
          onChange={onJSONFileChange}
          accept="application/json,.json"
        />
      </div>
    </div>
  );
};
