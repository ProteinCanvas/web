# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

**Key boundaries:**
- Mol* is isolated behind `structure-viewer/lib/molstar-bridge.ts`. Nothing outside `src/features/structure-viewer/` imports from molstar.
- Amino acid and pLDDT color functions live in `sequence-panel/lib/color-schemes.ts` — do not duplicate them.
- Adapters in `campaign-import/adapters/` implement `CampaignAdapter` and register in `campaign-import/registry.ts`. Order matters — first match wins. More specific adapters before generic ones.
- All metric keys from external files must pass through `normalizeMetricKey()` from `metric-registry.ts`. This maps aliases (`i_ptm` → `iptm`) so DuckDB columns stay consistent.
- PDB utilities (B-factor, sequence extraction, pLDDT normalization) live in `shared/lib/pdb-utils.ts`.

## UI structure

**Center pane tabs:** Summary · Candidates · Analytics · Funnel · Constraints · Compare · Experiments

**Analytics subtabs:** Scatter · Distribution · UMAP · Clusters

**Funnel subtabs:** Funnel (staged pass-rate) · Filters (global metric ranges)

**Right panel tabs:** Structure · Sequence · Compare (3D | Alignment) · PAE

## Rules

- TypeScript strict — no `any`
- No comments in code
- Tailwind only — no CSS files except globals.css
- Semantic color tokens: `text-foreground`, `text-muted-foreground`, `bg-card`, `bg-muted`, `border-border`
- `'use client'` on all interactive components and hooks
- `campaignStore` for campaign data (persisted to IndexedDB), `viewerStore` for ephemeral viewer state
- All DuckDB operations go through the `useDuckDB` hook
- New adapters: implement `CampaignAdapter`, call `normalizeMetricKey()` on all metric keys, register in `campaign-import/registry.ts`
- New metrics: add to `METRIC_REGISTRY` in `metric-registry.ts`, add aliases to `METRIC_KEY_ALIASES` if needed
- Experimental metrics (exp_kd, exp_expression, exp_tm, exp_binding) attach to ExperimentalResult, not Candidate.metrics

## Commands

```bash
bun run dev       # development server at localhost:3000
bun run build     # production build
bun run test      # unit tests (vitest)
bun run test src/shared/lib/__tests__/metrics.test.ts   # run a single test file
bun run lint      # ESLint
```

## Docker

```bash
docker compose up                                          # builds and serves at localhost:3000
PORT=8080 docker compose up                               # custom port
BASE_PATH=/tools/proteincanvas docker compose up --build  # sub-path deployment
```

The Dockerfile exports a static Next.js build and serves it via `nginx.conf.template`, which is processed at container startup via `sed` to inject `BASE_PATH`. COOP/COEP headers are set in the nginx config and must be forwarded by any upstream reverse proxy (required for DuckDB-Wasm).

## Non-obvious patterns

**campaignStore persistence:** Every mutation that should survive refresh calls the local `persist()` helper inside the setter. `persist()` is not a middleware — it's a plain function called manually within `set()` lambdas. Only `campaigns`, `activeCampaignId`, and `shortlist` are persisted; `filters` and `hydrated` are ephemeral. `hydrate()` is idempotent and called once on mount.

**Cross-component selection:** `useInteraction` (`shared/hooks/useInteraction.ts`) is the single place that drives `focusCandidate`, `hoverCandidate`, and `brushCandidates`. All interactive views (canvas, table, structure viewer) call these helpers instead of writing directly to `viewerStore`. This keeps selection behaviour consistent.

**UMAP dual-mode:** `EmbeddingProjection` checks `candidates.every(c => c.embedding?.length > 0)`. If true, it uses `candidate.embedding` vectors directly. If false, it falls back to normalised numeric metrics. This means populating `candidate.embedding` is the only change needed to switch from metric-space to sequence-space UMAP.

**Canvas rendering:** The UMAP canvas uses a `pointsRef` (mutable ref, not state) to avoid re-running UMAP on selection changes. `drawRef` holds the latest `draw` callback so it can be called from async contexts without stale closures. The UMAP fit only reruns when `candidates` or `numericFields` changes.

**DuckDB initialisation:** `useDuckDB` (`campaign-dashboard/hooks/useDuckDB.ts`) initialises the in-process DuckDB-Wasm instance lazily and builds a `candidates` table from the active campaign's metrics. All SQL filtering goes through this hook; do not bypass it with direct metric array iteration for anything that needs to scale.

**Adapter registration order matters:** `adapterRegistry` in `campaign-import/registry.ts` is ordered most-specific first. `detectAdapter` returns the first match. Generic CSV must remain last. Adapters should not overlap on `accepts()` — if they do, the earlier one wins silently.

**Feature index exports:** Each feature folder has an `index.ts` that defines its public API. Import from the feature root (`@/features/developability`) not from internal paths. Cross-feature imports are only allowed through these index files.
