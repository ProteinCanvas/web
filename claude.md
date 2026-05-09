# ProteinCanvas

Visual analytics workbench for generative protein design. Browser-first, no backend required.

## Stack

- Next.js 14 (App Router), TypeScript strict, Tailwind CSS
- Zustand (state), DuckDB-Wasm (in-browser SQL), Mol* (3D viewer)
- Recharts, umap-js, @tanstack/react-table, @tanstack/react-virtual
- Papaparse (CSV), JSZip (export), idb (IndexedDB persistence)
- Vitest (unit tests)

## Architecture

```
src/features/*                   domain modules, one folder per feature
src/shared/types/index.ts        canonical types: Campaign, Candidate, MetricField
src/shared/store/                campaignStore (IndexedDB-persisted), viewerStore (ephemeral)
src/shared/lib/                  duckdb, indexeddb, bundle-parser, metrics, metric-registry, pdb-utils, nanoid
src/shared/lib/__tests__/        unit tests for shared utilities
```

Mol* is isolated behind `structure-viewer/lib/molstar-bridge.ts`. Nothing outside `src/features/structure-viewer/` imports from molstar.

Adapters in `campaign-import/adapters/` normalize tool outputs to the Campaign schema. They are registered in `campaign-import/registry.ts`. Order matters — the first adapter whose `accepts()` returns true handles the files. More specific adapters must appear before `genericCsvAdapter`.

All metric keys from external files must pass through `normalizeMetricKey()` from `metric-registry.ts` before being stored. This maps aliases like `i_ptm` to canonical keys like `iptm` so DuckDB column names stay consistent across tools.

PDB parsing utilities (B-factor extraction, sequence extraction, pLDDT normalization) live in `src/shared/lib/pdb-utils.ts` and are shared across adapters.

## Rules

- TypeScript strict — no `any`
- No comments in code
- Tailwind only — no CSS files except globals.css
- Semantic color tokens: `text-foreground`, `text-muted-foreground`, `bg-card`, `bg-muted`, `border-border`
- `'use client'` on all interactive components and hooks
- `campaignStore` for campaign data (persisted to IndexedDB), `viewerStore` for ephemeral viewer state
- All DuckDB operations go through the `useDuckDB` hook
- New adapters: implement `CampaignAdapter`, call `normalizeMetricKey()` on all metric keys read from external files, register in `campaign-import/registry.ts`
- New metrics: add to `METRIC_REGISTRY` in `metric-registry.ts`, add aliases to `METRIC_KEY_ALIASES` if needed

## Commands

```bash
bun run dev       # development server at localhost:3000
bun run build     # production build
bun run test      # unit tests (vitest)
bun run lint      # ESLint
```

## Docker

```bash
docker compose up   # builds and serves at localhost:3000
```

The Dockerfile exports a static Next.js build and serves it via nginx with the COOP/COEP headers required for DuckDB-Wasm.
