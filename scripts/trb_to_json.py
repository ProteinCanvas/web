#!/usr/bin/env python3
"""Convert RFdiffusion .trb binary pickle files to JSON for ProteinCanvas import.

Usage:
    python scripts/trb_to_json.py <directory>
    python scripts/trb_to_json.py .

Outputs a sibling .trb.json file for each .trb file found.
"""

import pickle
import json
import sys
import pathlib
import numpy as np


def to_serializable(obj):
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, dict):
        return {k: to_serializable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [to_serializable(v) for v in obj]
    return obj


def convert_trb(path: pathlib.Path) -> pathlib.Path:
    with open(path, "rb") as f:
        data = pickle.load(f)

    out = {
        "config": to_serializable(data.get("config", {})),
        "con_ref_idx0": to_serializable(data.get("con_ref_idx0", [])),
        "con_hal_idx0": to_serializable(data.get("con_hal_idx0", [])),
        "fixed_residues": to_serializable(data.get("fixed_residues", {})),
        "inpaint_seq": to_serializable(data.get("inpaint_seq", [])),
        "sampled_mask": to_serializable(data.get("sampled_mask", [])),
    }

    out_path = path.with_suffix(".trb.json")
    out_path.write_text(json.dumps(out, indent=2))
    return out_path


def main():
    search_dir = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(".")
    trb_files = list(search_dir.rglob("*.trb"))

    if not trb_files:
        print(f"No .trb files found in {search_dir}")
        return

    for trb_path in trb_files:
        try:
            out_path = convert_trb(trb_path)
            print(f"  {trb_path.name} -> {out_path.name}")
        except Exception as e:
            print(f"  ERROR {trb_path.name}: {e}")

    print(f"\nConverted {len(trb_files)} file(s). Drop the folder into ProteinCanvas to import.")


if __name__ == "__main__":
    main()
