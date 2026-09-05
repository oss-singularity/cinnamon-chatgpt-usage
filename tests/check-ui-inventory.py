#!/usr/bin/env python3
"""Check screenshot coverage and the producing runtime/schema source hashes."""

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / "docs/model-limits"
manifest = json.loads((DIRECTORY / "inventory.json").read_text())
referenced = set(re.findall(r"docs/model-limits/([a-z0-9-]+\.png)", (ROOT / "README.md").read_text()))
if referenced != set(manifest):
    raise SystemExit(f"Screenshot inventory mismatch: {referenced.symmetric_difference(manifest)}")
for name, record in manifest.items():
    if hashlib.sha256((DIRECTORY / name).read_bytes()).hexdigest() != record["sha256"]:
        raise SystemExit(f"Screenshot changed without a reviewed inventory: {name}")
    for source, digest in record["sourceSha256"].items():
        # Descriptive documentation does not affect native rendering. Its old
        # hash remains useful provenance, but need not force new screenshots.
        if source.endswith(".md"):
            continue
        if hashlib.sha256((ROOT / source).read_bytes()).hexdigest() != digest:
            raise SystemExit(f"Screenshot {name} predates source change: {source}")
print(f"UI inventory: {len(manifest)} images match their producing source and output hashes.")
