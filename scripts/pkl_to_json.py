#!/usr/bin/env python3
"""Convert ColabFold / AlphaFold2 .pkl prediction files to JSON for ProteinCanvas import.

Usage:
    python scripts/pkl_to_json.py <directory>
    python scripts/pkl_to_json.py .

Outputs a sibling _scores.json file for each .pkl file found.
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


def convert_pkl(path: pathlib.Path) -> pathlib.Path:
    with open(path, "rb") as f:
        data = pickle.load(f)

    out: dict = {}

    plddt = data.get("plddt")
    if plddt is not None:
        out["plddt"] = to_serializable(plddt)

    ptm = data.get("ptm")
    if ptm is not None:
        out["ptm"] = float(ptm)

    iptm = data.get("iptm")
    if iptm is not None:
        out["iptm"] = float(iptm)

    pae = data.get("predicted_aligned_error")
    if pae is not None:
        out["predicted_aligned_error"] = to_serializable(pae)

    max_pae = data.get("max_predicted_aligned_error")
    if max_pae is not None:
        out["max_pae"] = float(max_pae)

    ranking_confidence = data.get("ranking_confidence")
    if ranking_confidence is not None:
        out["ranking_confidence"] = float(ranking_confidence)

    stem = path.stem
    if stem.endswith("_model"):
        stem = stem[:-6]
    out_path = path.with_name(f"{stem}_scores.json")
    out_path.write_text(json.dumps(out, indent=2))
    return out_path


def main():
    search_dir = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(".")
    pkl_files = list(search_dir.rglob("*.pkl"))

    if not pkl_files:
        print(f"No .pkl files found in {search_dir}")
        return

    for pkl_path in pkl_files:
        try:
            out_path = convert_pkl(pkl_path)
            print(f"  {pkl_path.name} -> {out_path.name}")
        except Exception as e:
            print(f"  ERROR {pkl_path.name}: {e}")

    print(f"\nConverted {len(pkl_files)} file(s). Drop the folder into ProteinCanvas to import.")


if __name__ == "__main__":
    main()
