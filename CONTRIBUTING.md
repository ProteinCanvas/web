# Contributing to ProteinCanvas

Thank you for your interest in contributing. This guide covers development setup, how to write a new adapter, the PR process, and code standards.

---

## Development Setup

```bash
git clone https://github.com/ProteinCanvas/web
cd proteincanvas
bun install
bun run dev
```

The app runs at `http://localhost:3000`. Drop any folder from `public/samples/` onto the interface to verify the full import-to-viewer pipeline.

**Prerequisites:** Bun 1.1+.

---

## Writing a New Adapter

Adapters are the primary extension point. Each generative tool gets one adapter that teaches ProteinCanvas how to recognize and parse its output format.

### The `CampaignAdapter` interface

```typescript
export interface CampaignAdapter {
  name: AdapterName
  label: string
  accepts: (files: File[]) => boolean
  parse: (files: File[]) => Promise<Omit<Campaign, 'id' | 'createdAt'>>
}
```

- `name` — machine identifier, added to the `AdapterName` union in `src/shared/types/index.ts`
- `label` — human-readable name shown in the UI
- `accepts` — fast, synchronous check run against the file list before any async work; return `true` only if this adapter owns these files
- `parse` — reads files, returns a normalized `Campaign` (without `id` and `createdAt`, which the store adds)

### Step-by-step example

**1. Create the adapter file.**

```
src/features/campaign-import/adapters/mytool.ts
```

```typescript
import type { Campaign, CampaignAdapter, Candidate } from '@/shared/types'
import { nanoid } from '@/shared/lib/nanoid'
import { inferMetricFields } from '@/shared/lib/metrics'

export const mytoolAdapter: CampaignAdapter = {
  name: 'mytool',
  label: 'MyTool',

  accepts(files: File[]): boolean {
    return files.some((f) => f.name.endsWith('.mytool.json'))
  },

  async parse(files: File[]): Promise<Omit<Campaign, 'id' | 'createdAt'>> {
    const candidates: Candidate[] = []

    for (const file of files) {
      const text = await file.text()
      const data = JSON.parse(text)

      candidates.push({
        id: nanoid(),
        name: data.name,
        sequence: data.sequence,
        metrics: { score: data.score },
        metadata: {},
        source: 'mytool',
      })
    }

    return {
      name: files[0].webkitRelativePath?.split('/')[0] ?? 'MyTool Campaign',
      source: 'mytool',
      candidates,
      metricFields: inferMetricFields(candidates),
      provenanceNodes: [],
      metadata: { fileCount: files.length },
    }
  },
}
```

**2. Add `'mytool'` to the `AdapterName` union** in `src/shared/types/index.ts`:

```typescript
export type AdapterName = 'rfdiffusion' | 'proteinmpnn' | 'boltzgen' | 'generic-csv' | 'bundle' | 'mytool'
```

And add `'mytool'` to `CampaignSource` if it does not already exist there.

**3. Register the adapter** in `src/features/campaign-import/registry.ts`:

```typescript
import { mytoolAdapter } from './adapters/mytool'

export const adapterRegistry: CampaignAdapter[] = [
  rfdiffusionAdapter,
  proteinmpnnAdapter,
  boltzgenAdapter,
  mytoolAdapter,   // <-- add before genericCsvAdapter
  genericCsvAdapter,
]
```

Order matters — the registry walks adapters in sequence and stops at the first `accepts()` that returns `true`. Put more specific adapters before `genericCsvAdapter`.

**4. Add the tool to the supported tools table in `README.md`.**

---

## PR Process

1. Fork the repo and create a branch from `main`.
2. Keep each PR focused — one adapter, one bug, one feature.
3. Before opening the PR: `bun run build` and `bun run lint` must pass with zero errors.
4. Fill in the PR template: what changed, how to test it, and which supported tool is affected.
5. At least one approval is required before merge.

For larger changes (new panels, changes to the `Campaign` schema, plugin SDK additions), open a discussion issue first.

---

## Code Standards

- **TypeScript strict mode** is enforced. No `any`. If you need an escape hatch, use `unknown` and narrow explicitly.
- **No comments in code.** Name things well enough that comments are unnecessary. Exception: JSDoc on exported interfaces in `src/shared/types/index.ts`.
- **Tailwind only** for styling. Do not create `.css` files except inside `src/features/structure-viewer/` for Mol* overrides.
- **Domain-Driven folder structure.** New feature code goes in `src/features/<feature-name>/`. Reusable hooks, utilities, and UI components go in `src/shared/`.
- **Mol* isolation.** Nothing outside `src/features/structure-viewer/` may import from `molstar`. All 3D interactions go through the `StructureViewer` wrapper and the `viewerStore`.
- **Zustand for cross-component state.** Local UI state uses `useState`. Anything that links two or more panels (e.g., a residue selection) lives in a Zustand store.

---

## Issue Templates

Bug reports and feature requests use GitHub issue templates. Please fill in all sections — especially the output folder structure and tool version for adapter-related bugs.
