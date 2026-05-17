import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'

// Vite plugin that proxies Yahoo Finance quoteSummary requests, handling the
// A3 cookie + crumb session server-side (required since v10 added auth in 2024).
function yahooFinancePlugin(): Plugin {
  let a3Cookie = '';
  let crumb = '';
  let crumbExpiry = 0;

  async function refreshSession() {
    // Step 1: get A3 cookie from fc.yahoo.com
    const fcResp = await fetch('https://fc.yahoo.com', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36' },
      redirect: 'follow',
    });
    const setCookies = fcResp.headers.getSetCookie?.() ?? (fcResp.headers.get('set-cookie') ? [fcResp.headers.get('set-cookie')!] : []);
    const a3Entry = setCookies.find((c: string) => c.startsWith('A3='));
    if (a3Entry) a3Cookie = a3Entry.split(';')[0];

    // Step 2: get crumb
    const crumbResp = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Cookie': a3Cookie,
        'Accept': '*/*',
      },
    });
    if (!crumbResp.ok) throw new Error(`Crumb fetch failed: ${crumbResp.status}`);
    crumb = (await crumbResp.text()).trim();
    crumbExpiry = Date.now() + 30 * 60 * 1000; // 30 min cache
  }

  return {
    name: 'yahoo-finance-proxy',
    configureServer(server) {
      server.middlewares.use('/api/yahoo-quotesummary', async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const url = new URL(req.url!, `http://localhost`);
          const symbol = url.searchParams.get('symbol');
          const modules = url.searchParams.get('modules') ?? 'financialData,defaultKeyStatistics,price';

          if (!symbol) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'symbol required' }));
            return;
          }

          // Refresh crumb if expired or missing
          if (!crumb || Date.now() > crumbExpiry) {
            await refreshSession();
          }

          const yahooUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${encodeURIComponent(modules)}&crumb=${encodeURIComponent(crumb)}`;
          const yahooResp = await fetch(yahooUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0',
              'Cookie': a3Cookie,
              'Accept': 'application/json',
            },
          });

          // If crumb expired mid-session, refresh once and retry
          if (yahooResp.status === 401) {
            await refreshSession();
            const retry = await fetch(
              `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${encodeURIComponent(modules)}&crumb=${encodeURIComponent(crumb)}`,
              { headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': a3Cookie, 'Accept': 'application/json' } },
            );
            const body = await retry.text();
            res.writeHead(retry.status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(body);
            return;
          }

          const body = await yahooResp.text();
          res.writeHead(yahooResp.status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(body);
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(e) }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), yahooFinancePlugin()],
})
