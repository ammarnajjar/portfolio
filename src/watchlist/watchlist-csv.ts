export interface WatchlistCSVRow {
  symbol: string;
  name: string;
  isin?: string;
}

const quoteName = (name: string): string =>
  `"${name.replace(/"/g, '""')}"`;

const unquote = (s: string): string => {
  const trimmed = s.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const splitLine = (line: string): string[] => {
  const parts: string[] = [];
  let current = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && inQuote && line[i + 1] === '"') {
      current += '"';
      i++;
    } else if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === ';' && !inQuote) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current.trim());
  return parts;
};

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
  link.style.display = "none";
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
        const symbol = unquote(parts[0] ?? "").toUpperCase();
        if (!symbol) continue;
        const name = unquote(parts[1] ?? "") || symbol;
        const isin = unquote(parts[2] ?? "") || undefined;
        rows.push({ symbol, name, isin });
      }
      resolve(rows);
    };
    reader.readAsText(file);
  });
