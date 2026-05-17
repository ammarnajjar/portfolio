export interface WatchlistCSVRow {
  symbol: string;
  name: string;
  isin?: string;
}

const quoteName = (name: string): string =>
  `"${name.replace(/"/g, '""')}"`;

export const generateWatchlistCSV = (rows: WatchlistCSVRow[]): string => {
  const header = "Symbol;Name;ISIN";
  const lines = rows.map(
    (r) => `${r.symbol};${quoteName(r.name)};${r.isin ?? ""}`,
  );
  return [header, ...lines].join("\n");
};

export const downloadWatchlistCSV = (csv: string, filename: string): void => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const parseWatchlistCSV = (file: File): Promise<WatchlistCSVRow[]> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const text = (e.target?.result as string) ?? "";
      const lines = text.split("\n");

      const splitLine = (line: string): string[] => {
        const parts: string[] = [];
        let current = "";
        let inQuote = false;
        for (const ch of line) {
          if (ch === '"') {
            inQuote = !inQuote;
          } else if (ch === ";" && !inQuote) {
            parts.push(current.trim());
            current = "";
          } else {
            current += ch;
          }
        }
        parts.push(current.trim());
        return parts;
      };

      const normalize = (s: string) =>
        s.toLowerCase().replace(/[^a-z0-9]/g, "");

      const firstParts = splitLine(lines[0] ?? "").map(normalize);
      const hasHeader = firstParts.some((p) =>
        ["symbol", "name", "isin"].includes(p),
      );
      const startIdx = hasHeader ? 1 : 0;

      const rows: WatchlistCSVRow[] = [];
      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = splitLine(line);
        const symbol = parts[0]?.replace(/^"|"$/g, "").trim().toUpperCase();
        if (!symbol) continue;
        const name = parts[1]?.replace(/^"|"$/g, "").trim() ?? symbol;
        const isin = parts[2]?.replace(/^"|"$/g, "").trim() || undefined;
        rows.push({ symbol, name, isin });
      }
      resolve(rows);
    };
    reader.readAsText(file);
  });
