# Private Cinnamon capture workflow

The scripts run Xvfb, a private D-Bus session, HOME, XDG config/data/state/cache,
Codex home and dconf. They never fall back to the live display. The applet is
staged through the repository installer, then copied into the private session.
A disposable fake Codex executable prevents account-backed usage requests.
Reset captures open the native confirmation without activating redemption.

Requirements: Cinnamon, CJS, Xvfb, dbus-run-session, gsettings, gdbus, ImageMagick,
xsetroot, xdotool, xdpyinfo, Python 3.10+, GTK settings tools and the chosen
installed theme. Run from the repository root:

```bash
python3 tests/ui/capture.py --output /tmp/chatgpt-usage-captures
```

Use `--only usage-menu settings-colors` to limit variants. `--theme Mint-Y`
checks the light theme; the default is Mint-Y-Dark-Aqua. To reproduce a panel
extension, pass `--extension /absolute/extension-directory` and optionally
`--extension-config /absolute/settings.json`. Both are copied into the private
session; no host setting changes. The manifest records whether an extension
was used. Do not silently substitute a missing reference theme or extension.

Outputs include raw frames, geometry, cropped PNGs, diagnostic logs and
`inventory.json`: variant, panel, theme, locale, scale, screen, producing base
commit, exact source hashes, capture time, output dimensions and SHA-256.
The producing tree can contain local changes; its hashes, not merely the base
commit, identify it. Dates/countdowns are relative to the capture clock, and
native rendering can differ by system font/theme version. Reproducibility here
means a recorded fixture/environment and repeatable native rendering, not an
unsupported promise of identical pixels across all desktops.

The overview preserves the already approved visible quota/credit composition.
The other variants exercise unused Spark, expanded Spark, four rings, Codex
only, actual pointer-triggered tooltips, settings and setup dialogs. No real
account is required. The general settings image enables model-specific panel display as an
explicit example; all other general controls retain their defaults. Notifications
also shows defaults, with optional threshold controls revealed by their switches.

Every screenshot must be inspected before copying it to `docs/model-limits`.
Menu captures must measure 419 px on the native actor, plus Cinnamon's 1 px
visible edge (420 px total at scale 1). The capture fails on a width mismatch
and records actor geometry in the inventory. PNG dimensions additionally
include the crop margin and panel; dialogs, settings and panel-only images
have their own native dimensions. Never resize a screenshot to hide a layout bug.
Copy its corresponding inventory entry too. A valid PNG alone is not freshness
proof. Update captures when runtime visuals, schema or fixture behavior changes.
For public approval, show the final captures in the task before pushing them.
