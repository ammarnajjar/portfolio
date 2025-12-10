import React, { useState } from 'react';
import { useStore } from '../services/useStore';

export const AddStockForm: React.FC = () => {
  const { addStock, isLoading } = useStore();
  const [symbol, setSymbol] = useState('');
  const [qty, setQty] = useState('');
  const [avgPrice, setAvgPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || !qty || !avgPrice) return;

    try {
      await addStock(symbol, parseInt(qty), parseFloat(avgPrice));
      setSymbol('');
      setQty('');
      setAvgPrice('');
      setError(null);
    } catch (err: unknown) {
      console.error(err);
      if (err instanceof Error) {
        setError(err.message || 'Failed to add stock. Please check the Symbol/ISIN.');
      } else {
        setError(String(err) || 'Failed to add stock. Please check the Symbol/ISIN.');
      }
    }
  };

  return (
    <div className="glass-panel p-6 mb-8 transform hover:scale-[1.01] transition-all duration-300">
      <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
        <span>+</span> Add Stock
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-rose-500/20 border border-rose-500/50 rounded-lg text-rose-200 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4">
        <input
          type="text"
          placeholder="Symbol or ISIN"
          className="glass-input flex-1 uppercase"
          value={symbol}
          onChange={e => setSymbol(e.target.value)}
          required
        />
        <input
          type="number"
          placeholder="Quantity"
          className="glass-input w-full md:w-32"
          value={qty}
          onChange={e => setQty(e.target.value)}
          min="0.0001"
          step="any"
          required
        />
        <input
          type="number"
          placeholder="Avg Price (€)"
          className="glass-input w-full md:w-32"
          value={avgPrice}
          onChange={e => setAvgPrice(e.target.value)}
          min="0"
          step="any"
          required
        />
        <button
          type="submit"
          disabled={isLoading}
          className="glass-button whitespace-nowrap disabled:opacity-50"
        >
          {isLoading ? 'Adding...' : 'Add Asset'}
        </button>
      </form>
    </div>
  );
};
