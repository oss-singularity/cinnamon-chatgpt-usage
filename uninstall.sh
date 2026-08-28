#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
set -eu

data_root=${XDG_DATA_HOME:-"$HOME/.local/share"}
applet_dir="$data_root/cinnamon/applets/chatgpt-usage@oss-singularity"

if [ -d "$applet_dir" ]; then
    find "$applet_dir" -mindepth 1 -delete
    rmdir "$applet_dir"
fi

printf '%s\n' "ChatGPT Usage removed. Cinnamon settings and usage history were retained."
