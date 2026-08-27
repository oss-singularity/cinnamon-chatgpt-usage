#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
set -eu

project_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
data_root=${XDG_DATA_HOME:-"$HOME/.local/share"}
uuid=chatgpt-usage@oss-singularity
applet_dir="$data_root/cinnamon/applets/$uuid"

mkdir -p "$applet_dir/icons"
for file in applet.js usage-format.js chatgpt_usage.py metadata.json settings-schema.json icon.png README.md LICENSE; do
    install -m 0644 "$project_dir/$file" "$applet_dir/$file"
done
for file in "$project_dir"/icons/*; do
    [ -f "$file" ] || continue
    install -m 0644 "$file" "$applet_dir/icons/$(basename "$file")"
done

printf '%s\n' "ChatGPT Usage installed. Add or reload it in Cinnamon Applets."
