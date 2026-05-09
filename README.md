# ProteinCanvas

**Visual analytics workbench for generative protein design.** Runs entirely in the browser — no server, no account, no installation.

Generative protein design campaigns now routinely produce thousands of candidate sequences per round, with iterative experimental feedback across multiple assay types. Analysing these campaigns requires using multiple existing tools in sequence — PyMOL or ChimeraX for structure inspection, Jupyter notebooks for metric distributions, and spreadsheets to track experimental rounds — with no integrated workflow across scales. ProteinCanvas is a browser-native visual analytics workbench that enables integrative exploration of computational scores, structural predictions, sequence features, and experimental readouts within a single coordinated interface, operating entirely client-side without server infrastructure.

---

## Quick start

```bash
git clone https://github.com/sjoerdvink99/ProteinCanvas
cd ProteinCanvas
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) and drag a folder of design outputs onto the import zone — or press **Load demo** to explore a pre-built IL-2Rα binder campaign.

```bash
bun run build   # production build
bun run test    # unit tests (Vitest)
bun run lint    # ESLint
```

**Docker:**
```bash
docker compose up               # builds and serves at localhost:3000
PORT=8080 docker compose up     # custom port
```

Press `?` at any time to see all keyboard shortcuts.

---

## Deploying on a shared or university server

ProteinCanvas is a fully static app — it runs entirely in the browser after the initial page load. The Docker container builds it once and serves the result via nginx.

**Critical requirement — COOP/COEP headers**

DuckDB-Wasm (used for SQL filtering) requires two HTTP response headers. If these are stripped by an upstream proxy the app will load but filtering will silently break:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

The built-in nginx already sets them. If you put a reverse proxy in front, you must forward them (see snippets below).

**Scenario 1 — Own subdomain (simplest)**

Build and start the container, then point your reverse proxy at it:

```bash
PORT=3000 docker compose up -d
```

Reverse proxy config: `deploy/apache-subdomain.conf` or `deploy/nginx-proxy.conf`.

**Scenario 2 — Sub-path on an existing server** (e.g. `https://server.uni.edu/tools/proteincanvas/`)

The base path is baked into the static HTML at build time, so you must pass it when building:

```bash
BASE_PATH=/tools/proteincanvas PORT=3000 docker compose up --build -d
```

Then configure the reverse proxy to pass the full path through without stripping the prefix — see `deploy/apache-subpath.conf`.

**Reverse proxy snippets**

| File | Use when |
|---|---|
| `deploy/apache-subdomain.conf` | Apache, own subdomain |
| `deploy/apache-subpath.conf` | Apache, sub-path on existing site |
| `deploy/nginx-proxy.conf` | nginx upstream |

**No Docker?** The output of `bun run build` is a plain static site in `out/`. Copy it to any web server — just ensure the COOP/COEP headers are set and `.wasm` files are served as `application/wasm`.

---

## Why ProteinCanvas

Generative protein design campaigns now routinely produce thousands of candidate sequences per round, with iterative experimental feedback across multiple assay types. Analysing a campaign requires using multiple existing tools sequentially — PyMOL or ChimeraX for structure inspection, Jupyter notebooks with matplotlib for metric distributions, and separate spreadsheets to track experimental rounds — with no integrated workflow. This makes it difficult to surface insights that depend on connecting observations across scales, from campaign-level metric distributions down to individual interface residues.

To overcome these problems with disconnected workflows, ProteinCanvas integrates structure viewing, sequence analysis, metric exploration, and experimental tracking into a single coordinated interface. Because the tool operates entirely client-side via DuckDB-Wasm and WebGL, it supports interactive exploration of campaigns with 50,000+ candidate sequences without server infrastructure. We anticipate that ProteinCanvas will accelerate the design–build–test–learn cycle by enabling observations that require linking computational predictions to experimental outcomes within a single session.

| Capability | ProteinCanvas | Jupyter + pandas + PyMOL |
|---|---|---|
| Load 480-candidate RFdiffusion output | Drag-and-drop, < 30 s | Custom parser, 1–2 h |
| Metric scatter plot with brush selection | Canvas-rendered, linked to 3D viewer | Static matplotlib, no cross-view link |
| UMAP projection of sequence embeddings | Automatic, color by metric or DBTL round | 50-line umap-learn script, no interactivity |
| Sequence identity clustering + dendrogram | Automatic UPGMA, linked to candidate table | 40-line scipy script |
| 3D structure viewer | Embedded Mol*, synchronized with selection | Separate PyMOL session |
| Design funnel / attrition analysis | One slider per gate, pass count live | Custom filter chains, re-run cell |
| Experimental round tracking | Built-in DBTL timeline with sparklines | Separate spreadsheet |
| Correlation: comp. metrics × wet-lab outcomes | Canvas heatmap + AUC-ROC chart | Custom seaborn, separate analysis |
| Export shortlist | ZIP / FASTA / CSV, one click | Custom download script |
| Requires installation | No — browser-native | Python + PyMOL + conda environment |
| Sharable | URL or static HTML | Jupyter nbconvert, PyMOL session file |

---

## Features

**Summary** — Stat cards and per-metric overview with mean, standard deviation, and quality-threshold markers. Provenance graph showing the design pipeline.

**Candidates** — Sortable, filterable table backed by DuckDB-Wasm SQL. Supports 10 000+ rows without pagination. Keyboard navigation with `j`/`k`, shortlist with `s`, compare with `c`.

**Analytics** — Four coordinated views: canvas-based scatter plot with rectangle brush, metric histograms with bar-click filtering, UMAP projection (color by metric or DBTL round), and sequence-identity clustering (UPGMA dendrogram + identity matrix). All views share selection state.

**Funnel** — One slider per metric quality gate. Shows attrition at each stage, highlights the bottleneck, and propagates the passing set to all other views.

**Experiments** — Import experimental results (CSV), track synthesis rounds with inline labeling and per-round sparklines, view per-round hit rates, and explore Pearson / Spearman correlations between computational metrics and wet-lab outcomes (Kd, expression, Tm, binding). Canvas heatmap + AUC-ROC bar chart.

**Structure viewer** — Mol* 3D viewer with pLDDT coloring, cartoon / surface / ball-and-stick representations, and PNG export. Optional target structure overlay with semi-transparent surface and orange hotspot residue highlighting.

**Sequence panel** — Residue-level view with pLDDT color strip and a conservation logo when 2+ candidates are shortlisted. Compare tab adds a multiple-sequence alignment with five color modes.

**Shortlist** — Star candidates, annotate with notes and status, export as ZIP / FASTA / CSV. Diversity selection via greedy max-min Hamming distance and one-per-cluster selection.

**Constraints** — Define hotspot residues, masks, locks, and motifs. Exports a ready-to-paste RFdiffusion YAML or BindCraft JSON for the next round.

**Campaign comparison** — Side-by-side metric histograms and pass-rate table for two campaigns.

---

## Supported tools

| Tool | Format |
|---|---|
| RFdiffusion | PDB + scores CSV |
| ProteinMPNN | FASTA with `score=` headers |
| LigandMPNN | FASTA with `ligand_mpnn` headers |
| AlphaFold2 | Ranked PDB + JSON scores |
| AlphaFold3 | `confidences.json` + CIF |
| ColabFold | Unrelaxed rank PDB + JSON scores |
| Chai-1 | CIF + scores JSON |
| Boltz-1 | `confidence_boltz1_*.json` + CIF |
| Boltz-2 | CIF + predictions JSON |
| ESMFold | PDB |
| ESM3 | FASTA with metric headers |
| DiffAb | CSV with CDR columns |
| BindCraft | Stats CSV |
| Rosetta | Score CSV |
| Generic | Any CSV with numeric columns |

Drop a folder from any of these tools onto the import zone — the correct adapter is detected automatically.

---

## Architecture

```
src/features/          one folder per domain feature
src/shared/types/      Campaign, Candidate, MetricField
src/shared/store/      campaignStore (IndexedDB-persisted) · viewerStore (ephemeral)
src/shared/lib/        duckdb · metric-registry · pdb-utils · nanoid
```

**Key boundaries:**

- Mol\* is isolated behind `structure-viewer/lib/molstar-bridge.ts` — nothing outside `src/features/structure-viewer/` imports from molstar
- Adapters in `campaign-import/adapters/` implement `CampaignAdapter` and register in `registry.ts`; first match wins — place more specific adapters before generic ones
- All metric keys from external files pass through `normalizeMetricKey()` from `metric-registry.ts` to keep DuckDB columns consistent
- Canvas-rendered views (scatter, UMAP, identity matrix, correlation heatmap) use a stable `drawRef` pattern for closures — see `EmbeddingProjection.tsx` for the canonical implementation

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `j` / `↓` | Next candidate |
| `k` / `↑` | Previous candidate |
| `s` | Toggle shortlist |
| `c` | Add to comparison |
| `?` | Toggle shortcuts panel |
| `Esc` | Close panel / exit fullscreen |

---

## Cite

If you use ProteinCanvas in your research, please cite it using the metadata in `CITATION.cff`:

```
@software{ProteinCanvas,
  author = {Vink, Sjoerd},
  title  = {ProteinCanvas: Visual analytics workbench for generative protein design},
  year   = {2026},
  url    = {https://github.com/sjoerdvink99/ProteinCanvas},
  license = {MIT}
}
```

---

## License

MIT
