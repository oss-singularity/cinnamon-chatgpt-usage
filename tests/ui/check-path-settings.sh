#!/usr/bin/env bash
# Real GTK input on a private X11 display; never uses the live desktop or settings.
set -euo pipefail
test_root=$(cd -- "$(dirname -- "$0")/../.." && pwd)
test_home=$(mktemp -d /tmp/usage-path-settings.XXXXXX)
trap 'rm -rf -- "$test_home"' EXIT
xvfb-run -a -s '-screen 0 1024x768x24 -nolisten tcp' \
    dbus-run-session -- env -u WAYLAND_DISPLAY \
        HOME="$test_home" XDG_CONFIG_HOME="$test_home/config" \
        XDG_DATA_HOME="$test_home/data" XDG_CACHE_HOME="$test_home/cache" \
        XDG_STATE_HOME="$test_home/state" GDK_BACKEND=x11 GIO_USE_VFS=local NO_AT_BRIDGE=1 \
        USAGE_TEST_ISOLATED=1 /usr/bin/python3 "$test_root/tests/ui/check-path-settings.py"
