import type { PortfolioItem } from './store-types';

export type ParsedCSVRow = { symbol: string; qty: number; avgPrice: number; isin?: string; lastUpdated?: string; gainLoss?: number };

export const csvService = {
  generateCSV: (portfolio: PortfolioItem[]): string => {
    const headers = ['Symbol', 'Name', 'ISIN', 'Quantity', 'AvgPrice', 'LastUpdated', 'GainLoss'];
    const rows = portfolio.map(item => {
      const name = item.name ? `"${item.name.replace(/"/g, '""')}"` : '';
      const current = item.currentPrice ?? item.avgPrice;
      const value = item.qty * current;
      const cost = item.qty * item.avgPrice;
      const gain = value - cost;
      return [
        item.symbol,
        name,
        item.isin || '',
        item.qty.toString(),
        item.avgPrice.toString(),
        item.lastUpdated || '',
        gain.toString(),
      ].join(';');
    });
    return [headers.join(';'), ...rows].join('\n');
  },

  downloadCSV: (csvContent: string, filename: string = 'portfolio.csv') => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  },

  parseCSV: async (file: File): Promise<Array<{ symbol: string; qty: number; avgPrice: number; isin?: string; lastUpdated?: string; gainLoss?: number }>> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text) return resolve([]);

        const lines = text.split('\n');

        const splitLine = (line: string) => {
          const matches: string[] = [];
          let current = '';
          let inQuote = false;
          for (const char of line) {
            if (char === '"') {
              inQuote = !inQuote;
            } else if (char === ';' && !inQuote) {
              matches.push(current);
              current = '';
            } else {
              current += char;
            }
          }
          matches.push(current);
          return matches.map(s => s.trim());
        };

        const firstRow = lines[0] || '';
        const normalize = (s: string) => s.toLowerCase().replace(/\s|_|-|\//g, '').replace(/[^a-z0-9]/g, '');
        const firstRowParts = splitLine(firstRow).map(p => normalize(p));
        const headerLike = firstRowParts.some(p => ['symbol', 'isin', 'quantity', 'qty', 'avgprice', 'price', 'name'].includes(p));
        const hasHeader = headerLike;
        const startIndex = hasHeader ? 1 : 0;

        const items: Array<{ symbol: string; qty: number; avgPrice: number; isin?: string; lastUpdated?: string; gainLoss?: number }> = [];

        const headerMap: Record<string, number> = {};
        if (hasHeader) {
          const headers = splitLine(firstRow);
          headers.forEach((h, idx) => {
            headerMap[normalize(h)] = idx;
          });
        }

        const getByKeys = (parts: string[], keys: string[]) => {
          for (const k of keys) {
            const n = normalize(k);
            if (n in headerMap) return parts[headerMap[n]] ?? undefined;
          }
          return undefined;
        };

        for (let i = startIndex; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const parts = splitLine(line);
          let symbol: string | undefined;
          let qty: string | undefined;
          let price: string | undefined;
          let isin: string | undefined;
          let lastUpdatedRaw = '';
          let gainRaw = '';

          if (hasHeader) {
            symbol = getByKeys(parts, ['symbol']);
            qty = getByKeys(parts, ['quantity', 'qty']);
            price = getByKeys(parts, ['avgprice', 'price', 'avg_price']);
            isin = getByKeys(parts, ['isin']);
            lastUpdatedRaw = getByKeys(parts, ['lastupdated', 'lastupdate', 'updated']) || '';
            gainRaw = getByKeys(parts, ['gainloss', 'gain', 'gain/loss', 'profit']) || '';
          } else {
            if (parts.length >= 5) {
              symbol = parts[0];
              isin = parts[2] ? parts[2].replace(/^"|"$/g, '') : '';
              qty = parts[3];
              price = parts[4];
              lastUpdatedRaw = parts[5] || '';
              gainRaw = parts[6] || '';
            } else if (parts.length === 3) {
              symbol = parts[0];
              qty = parts[1];
              price = parts[2];
            } else {
              continue;
            }
          }

          if (symbol && qty && price) {
            items.push({
              symbol: symbol.replace(/^"|"$/g, ''),
              qty: parseFloat(qty),
              avgPrice: parseFloat(price),
              isin: isin || undefined,
              lastUpdated: lastUpdatedRaw || undefined,
              gainLoss: gainRaw ? parseFloat(gainRaw) : undefined,
            });
          }
        }
        resolve(items);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsText(file);
    });
  }
};
