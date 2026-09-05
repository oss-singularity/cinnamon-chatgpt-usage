#!/usr/bin/env python3
"""Recreate the README inventory in private Cinnamon sessions."""

import argparse
import datetime as dt
import hashlib
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
UI = ROOT / "tests/ui"
SPECS = [
    ("usage-menu", "overview", "vertical"),
    ("usage-menu-horizontal", "basic", "horizontal"),
    ("usage-menu-spark", "spark", "vertical"),
    ("usage-menu-four-rings", "four", "vertical"),
    ("usage-menu-codex-only", "codex-two", "vertical"),
    ("bucket-tooltip", "bucket", "vertical"),
    ("topbar", "panel", "horizontal"),
    ("vertical-panel", "panel", "vertical"),
    ("reset-confirmation", "reset", "horizontal"),
    ("install-chatgpt", "install-chatgpt", "horizontal"),
    ("install-codex", "install-codex", "horizontal"),
    ("panel-tooltip", "panel-tooltip", "horizontal"),
    ("settings-general", "settings-general", "vertical"),
    ("settings-colors", "settings-colors", "vertical"),
    ("settings-notifications", "settings-notifications", "vertical"),
]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--theme", default="Mint-Y-Dark-Aqua")
    parser.add_argument("--extension", type=Path)
    parser.add_argument("--extension-config", type=Path)
    parser.add_argument("--only", nargs="*")
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    stage = output / "stage"
    subprocess.run([str(ROOT / "install.sh")], check=True, env={**os.environ, "XDG_DATA_HOME": str(stage)})
    manifest_path = output / "inventory.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    source_paths = ["applet.js", "chatgpt_usage.py", "usage-format.js", "metadata.json", "settings-schema.json"]
    source_paths += [str(path.relative_to(ROOT)) for path in sorted(UI.iterdir()) if path.is_file()]
    sources = {name: sha(ROOT / name) for name in source_paths}
    for name, variant, mode in SPECS:
        if args.only and name not in args.only:
            continue
        raw = output / f"{name}.raw.png"
        geometry = output / f"{name}.geometry"
        panel = output / f"{name}.panel.geometry"
        image = output / f"{name}.png"
        size = "1920x1080x24"
        if mode == "horizontal" and variant in ["reset", "install-chatgpt", "install-codex", "panel-tooltip"]:
            size = "720x540x24"
        command = [
            str(UI / "run-isolated.sh"),
            "--stage-applet",
            str(stage / "cinnamon/applets/chatgpt-usage@oss-singularity"),
            "--output",
            str(raw),
            "--geometry",
            size,
            "--settle-ms",
            "13000",
        ]
        if args.extension:
            command += ["--stage-extension", str(args.extension)]
        if args.extension_config:
            command += ["--stage-extension-config", str(args.extension_config)]
        command += ["--", str(UI / "capture-variant.sh"), variant, str(geometry), mode, str(panel)]
        with (output / f"{name}.log").open("w") as log:
            subprocess.run(
                command,
                check=True,
                stdout=log,
                stderr=subprocess.STDOUT,
                env={**os.environ, "QA_THEME": args.theme},
                cwd=ROOT,
            )
        if variant == "panel":
            crop = [str(UI / "crop-panel.sh"), str(raw), str(panel), str(image), mode]
        else:
            crop = [str(UI / "crop-menu.sh"), str(raw), str(geometry), str(image), str(panel), mode]
        subprocess.run(crop, check=True)
        manifest[name + ".png"] = {
            "variant": variant,
            "panel": mode,
            "theme": args.theme,
            "locale": "C.UTF-8; LC_TIME=de_DE.UTF-8",
            "gtkTheme": "Mint-Y",
            "scale": 1,
            "screen": size,
            "extension": args.extension.name if args.extension else None,
            "capturedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
            "baseCommit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
            "sourceSha256": sources,
            "sha256": sha(image),
            "dimensions": subprocess.check_output(["identify", "-format", "%wx%h", str(image)], text=True),
        }
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
        print(f"Verified capture: {name}", flush=True)


if __name__ == "__main__":
    main()
