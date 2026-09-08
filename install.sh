#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
set -eu

project_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
data_root=${XDG_DATA_HOME:-"$HOME/.local/share"}
exec python3 "$project_dir/scripts/package.py" install --data-root "$data_root"
