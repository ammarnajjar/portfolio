# Development Guide

## Prerequisites

- Node.js 24+
- npm

---

## Setup

```bash
git clone <repo-url>
cd portfolio
npm install
```

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start Vite dev server at `http://localhost:5173` |
| `npm run build` | TypeScript compile + Vite production build → `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run test` | Run all tests with Vitest (watch mode) |
| `npm run test -- --run` | Run tests once (CI mode) |
| `npm run lint` | ESLint check across `src/` |

---

## Testing

Tests live alongside source files in `src/` with `.test.ts` / `.test.tsx` suffixes.

**Stack**: Vitest + React Testing Library + jsdom

**Coverage areas:**

| Test file | What it covers |
|---|---|
| `store.test.tsx` | State mutations, refresh logic, range caching |
| `api.test.ts` | Yahoo Finance fetch, retry logic, FX conversion |
| `csv.test.ts` | CSV parse (minimal + extended), CSV generation |
| `Chart.test.tsx` | Chart render, range button interactions |
| `PortfolioRow.test.tsx` | Row display, per-item refresh, delete |
| `AddStockForm.test.tsx` | Form submission, ISIN input |
| `Layout.test.tsx` | Totals display, auto-refresh controls |

**Run a single test file:**
```bash
npm run test -- src/services/csv.test.ts
```

**Mocking pattern**: API calls are mocked via `vi.mock('../services/api')` in component tests. Store tests use a real store instance with a mocked fetch.

---

## Configuration Files

| File | Purpose |
|---|---|
| `vite.config.ts` | Base URL set from `VITE_BASE_URL` env var (used for GitHub Pages) |
| `vitest.config.ts` | jsdom environment, setup file path |
| `tsconfig.app.json` | Strict TypeScript, ES2022 target, bundler module resolution |
| `postcss.config.js` | Tailwind CSS plugin |
| `eslint.config.js` | TypeScript-aware ESLint with React hooks rules |

---

## Environment Variables

| Variable | When needed | Description |
|---|---|---|
| `VITE_BASE_URL` | Production build | Base path for GitHub Pages deployment (e.g. `/portfolio`) |

For local dev, no environment variables are needed. Vite serves from `/` by default.

---

## Adding a New Holding Field

1. Add the field to `PortfolioItem` in `src/services/store-types.ts`
2. Update the default item factory in `src/services/store.tsx`
3. Update CSV headers and parser in `src/services/csv.ts` if it should be importable/exportable
4. Update `PortfolioRow.tsx` to display it
5. Update relevant tests

---

## Adding a New Chart Range

1. Add the range label to the `Range` union type in `src/services/ranges.ts`
2. Add the Yahoo Finance query string mapping in the same file
3. The range button renders automatically from the `RANGES` array — no UI changes needed

---

## Deployment

Deployment to GitHub Pages is automated via `.github/workflows/deploy.yml`.

**Trigger**: push to `main` branch

**Steps:**
1. `npm ci`
2. `npm run test -- --run` (blocks deploy on test failure)
3. `npm run build` with `VITE_BASE_URL` set to the repo name
4. Upload `dist/` to GitHub Pages

**SPA routing**: `public/404.html` is a copy of `index.html`. GitHub Pages serves it for any unmatched path, letting client-side routing handle the URL.

**Manual deploy** (if needed):
```bash
VITE_BASE_URL=/portfolio npm run build
# then push dist/ to gh-pages branch, or use gh-pages npm package
```

---

## Local Data Management

Since all data is in `localStorage`, you can inspect or reset it from the browser console:

```js
// View current portfolio
JSON.parse(localStorage.getItem('portfolio_state'))

// Clear everything
localStorage.removeItem('portfolio_state')
localStorage.removeItem('portfolio_ui_state')

// Replace with a backup
localStorage.setItem('portfolio_state', JSON.stringify([...]))
```

Alternatively, use the app's built-in JSON export/import to back up and restore data.

---

## Common Issues

**CORS errors in development**

The app uses `corsproxy.io` to bypass Yahoo Finance CORS restrictions. If that proxy is down, fetch calls will fail. You can swap the proxy URL in `src/services/api.ts`.

**Prices not updating**

Yahoo Finance's unofficial API has no SLA. During market hours it's usually fresh; outside hours it may return the last closing price. This is expected behavior.

**TypeScript strict errors**

The project uses `strict: true` plus `noUnusedLocals` and `noUnusedParameters`. New code must satisfy all checks — `npm run build` will fail otherwise.

**localStorage quota**

With large history arrays (5Y range × many holdings), localStorage usage can grow. The JSON export is useful for backing up and trimming if you hit quota limits.
