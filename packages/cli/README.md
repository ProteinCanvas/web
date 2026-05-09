# ProteinCanvas CLI

Visual analytics workbench for generative protein design.

## Installation

```bash
uv tool install proteincanvas
```

## Usage

Serve a local directory of RFdiffusion or ProteinMPNN outputs:

```bash
proteincanvas serve ./rfdiffusion_outputs/
```

Serve on a custom port:

```bash
proteincanvas serve ./outputs/ --port 8080
```

Serve without opening the browser:

```bash
proteincanvas serve ./outputs/ --no-open
```

Run the built-in demo:

```bash
proteincanvas serve --demo
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `PATH` | `.` | Campaign directory to serve |
| `--port` | `3847` | Port to listen on |
| `--host` | `127.0.0.1` | Host to bind to |
| `--no-open` | `false` | Skip opening the browser |

ProteinCanvas watches `PATH` for new `.pdb`, `.cif`, `.csv`, and `.fasta` files and prints a notification when they appear.
