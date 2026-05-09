# ProteinCanvas

Visual analytics workbench for generative protein design. Runs entirely in the browser with no server required.

Protein designers using tools like RFdiffusion, AlphaFold, and ProteinMPNN generate hundreds of candidates per campaign. ProteinCanvas imports those outputs, links a candidate table to a live structure viewer, and gives you the analytics to decide which designs are worth synthesizing.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) [![CI](https://github.com/ProteinCanvas/web/actions/workflows/ci.yml/badge.svg)](https://github.com/ProteinCanvas/web/actions) [![Built with Next.js](https://img.shields.io/badge/Built%20with-Next.js-black?logo=next.js)](https://nextjs.org)

---

## Quick start

**Docker** (no clone required):

```bash
curl -O https://raw.githubusercontent.com/ProteinCanvas/web/main/compose.yml
docker compose up
```

Open http://localhost:3000, then drag a folder of output files onto the import zone.

**Python CLI** (for local data directories):

```bash
uv tool install proteincanvas
proteincanvas serve ./my-campaign/
```

Open http://localhost:3847.

---

## What it does

**Summary** — Stat cards for total candidates, structures, sequences, and shortlist count. Per-metric overview with mean position bar and good-threshold marker.

**Candidates** — Sortable table with in-browser SQL filtering via DuckDB-Wasm. Supports 10k+ candidates without pagination. Keyboard navigation with ↑/↓. Click any row to load the structure.

**Analytics** — Scatter plot, metric distribution histograms with clickable bar selection, and UMAP projection of design space. All charts export as PNG.

**Design Funnel** — One slider per metric quality gate. Shows attrition at each stage, highlights the bottleneck, and selects the passing candidates for you.

**Structure viewer** — Mol* 3D viewer with pLDDT coloring, cartoon/surface/ball-and-stick modes, and side-by-side comparison of up to 6 structures.

**Sequence panel** — Residue-level view with a pLDDT color strip when per-residue confidence is available.

**Shortlist** — Star candidates, then export as ZIP, FASTA, or CSV. Diversity selection via greedy max-min Hamming distance.

**Constraint editor** — Define hotspot residues, masks, and locks based on your current results. Exports a ready-to-paste RFdiffusion YAML or BindCraft JSON for the next round.

**Campaign comparison** — Side-by-side metric distribution histograms and pass-rate table for two campaigns.

---

## Supported tools

| Tool | Input format |
|---|---|
| RFdiffusion | PDB files + scores CSV |
| ProteinMPNN | FASTA files with `score=` headers |
| LigandMPNN | FASTA files with `ligand_mpnn` headers |
| AlphaFold2 | Ranked PDB files + JSON scores |
| AlphaFold3 | `confidences.json` + CIF files |
| ColabFold | Unrelaxed rank PDB files + JSON scores |
| Chai-1 | CIF files + scores JSON |
| Boltz-2 | CIF files + predictions JSON |
| ESMFold | PDB files |
| BindCraft | Stats CSV |
| Rosetta | Score CSV |
| Generic | Any CSV with numeric columns |

Drop a folder of output files from any of these tools onto the import zone. The correct adapter is detected automatically.

RFdiffusion `.trb` and ColabFold `.pkl` files are binary pickles that cannot be read in the browser. Convert them first with the provided scripts:

```bash
uv run scripts/trb_to_json.py ./rfdiffusion_outputs/
uv run scripts/pkl_to_json.py ./colabfold_outputs/
```

---

## Architecture

ProteinCanvas is a Next.js 14 app with no API routes or server-side rendering.

- `src/features/` — one folder per domain (campaign-dashboard, campaign-import, structure-viewer, etc.)
- `src/shared/types/index.ts` — canonical types: Campaign, Candidate, MetricField
- `src/shared/store/` — campaignStore (persisted to IndexedDB) and viewerStore (ephemeral)
- `src/features/campaign-import/adapters/` — one adapter per supported tool, registered in `registry.ts`
- `src/features/structure-viewer/` — Mol* isolation boundary; nothing outside this directory imports from molstar

DuckDB-Wasm handles in-browser SQL over candidate metrics. Zustand manages cross-panel state such as selected candidate and brushed candidates.

---

## Development

```bash
git clone https://github.com/ProteinCanvas/web
cd proteincanvas
bun install
bun run dev      # http://localhost:3000
bun run test     # unit tests
bun run build    # production build
```

CI runs type check, lint, tests, and build on every pull request.

To build the Docker image from source instead of pulling it, run `docker compose up --build`.

Adding a new tool adapter takes about 60 lines of TypeScript. See [CONTRIBUTING.md](CONTRIBUTING.md) for a step-by-step guide.

---

## License

MIT
