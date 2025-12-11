import React from 'react';
import { StoreProvider } from './services/store';
import { useStore } from './services/useStore';
import { Layout } from './components/Layout';
import { AddStockForm } from './components/AddStockForm';
import { PortfolioList } from './components/PortfolioList';
import { PortfolioChart } from './components/Chart';

const Dashboard: React.FC = () => {
  const { totalValue, isLoading, refreshPortfolio, stopRefresh } = useStore();

  return (
    <Layout>
      <div className="grid grid-cols-1 gap-8">
        {/* Summary Card */}
        <div className="glass-panel p-6 bg-gradient-to-br from-blue-900/50 to-slate-900/50 flex justify-between items-center">
          <div>
            <h2 className="text-sm text-slate-400 font-medium uppercase tracking-wider">Total Portfolio Value</h2>
            <div className="text-4xl font-bold text-white mt-1">
              €{totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => isLoading ? stopRefresh && stopRefresh() : refreshPortfolio()}
              className={`p-2 rounded-full hover:bg-white/10 transition-colors ${isLoading ? 'bg-rose-600 text-white' : ''}`}
              title={isLoading ? 'Stop Refresh' : 'Refresh Prices'}
            >
            {isLoading ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
                   className={`w-6 h-6`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            )}
            </button>
            {/* refresh progress not exposed here */}
          </div>
        </div>

        <AddStockForm />

        <PortfolioChart />

        <PortfolioList />
      </div>
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <StoreProvider>
      <Dashboard />
    </StoreProvider>
  );
};

export default App;
