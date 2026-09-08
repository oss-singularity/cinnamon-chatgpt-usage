# Private Cinnamon capture workflow

The scripts run Xvfb, a private D-Bus session, HOME, XDG config/data/state/cache,
Codex home and dconf. They never fall back to the live display. The applet is
staged through the repository installer, then copied into the private session.
A disposable fake Codex executable prevents account-backed usage requests.
Reset captures open the native confirmation without activating redemption.
The reset button starts disabled until its acknowledgment is checked. For
native keyboard/activation regression QA, set `QA_RESET_ACKNOWLEDGMENT=1`
and use the `reset` driver variant with `--settle-ms 20000`. It checks Enter,
Space, Escape, cancel/reopen, an unchecked callback and repeated activation;
dispatch is replaced by an in-memory counter, and the final frame shows the
checked state. No reset request is sent.

Run `tests/ui/check-path-settings.py` through the isolated wrapper for native GTK
placeholder, focus, Recheck and no-implicit-save checks. It uses fake executable
files and fails if discovery executes them.

For installation-path QA, set `QA_INSTALLATION_PATHS=1` with an `install-*`
variant. Native entries and the real private settings store exercise invalid
input, save/reopen, cancel and clearing. Usage refresh is replaced by a counter;
no real installation or account is touched.

Requirements: Cinnamon, CJS, Xvfb, dbus-run-session, gsettings, gdbus, ImageMagick,
xsetroot, xdotool, xdpyinfo, Python 3.10+, GTK settings tools and the chosen
installed theme. Run from the repository root:

```bash
python3 tests/ui/capture.py --output /tmp/chatgpt-usage-captures \
  --extension "$HOME/.local/share/cinnamon/extensions/transparent-panels@germanfr" \
  --extension-config "$HOME/.config/cinnamon/spices/transparent-panels@germanfr/transparent-panels@germanfr.json"
```

Use `--only usage-menu settings-colors` to limit variants. `--theme Mint-Y`
checks the light theme; the default is Mint-Y-Dark-Aqua. To reproduce a panel
extension, pass `--extension /absolute/extension-directory` and optionally
`--extension-config /absolute/settings.json`. Both are copied into the private
session; no host setting changes. The manifest records whether an extension
was used. Do not silently substitute a missing reference theme or extension.

For complete model-visibility QA, use `QA_MODEL_SPECIFIC_LIMITS=off` with
`--only usage-menu`: the fixture still contains Spark data, but its menu,
history, rings, panel and tooltip must show Codex only. Notification options
remain independent of this display setting.
`QA_ALIGNMENT=1` switches model-specific limits on, off and on again in the
same native session and checks visible ring/plot edges against the footer
buttons. Every popup capture repeats content-bound and alignment checks after
rebuild and reopen. Text checks measure glyph bounds and scrollbar checks use
actual visibility; unused allocation space is not visible content.

For panel threshold-color QA, run `QA_PANEL_ALERTS=on` or `QA_PANEL_ALERTS=off`
with `--only topbar vertical-panel` into separate output directories. This
private fixture shows 25% warning and 10% critical values at the exact default
boundaries, with the switch enabled or disabled. It does not alter live settings.

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
also shows defaults, with all notification options enabled and threshold controls visible.

For native notification retention QA, run the private wrapper with
`QA_NOTIFICATION_RETENTION=1`, an absolute `QA_NOTIFICATION_GEOMETRY` output
path and `--settle-ms 24000`, using the `panel` driver variant. The helper
loads Cinnamon's notification-center applet in the private session, sends
synthetic warning/critical/reset events through production code and waits for
their banners to expire. It requires three retained entries with transient
filtering enabled and verifies that unchanged refreshes do not add duplicates.
The final raw frame shows the open notification center. No live notification
settings, account data or real notifications are touched.

Every screenshot must be inspected before copying it to `docs/model-limits`.
Use the approved bright blue desktop from `tests/assets`. Setup and reset
dialogs sit 48 px left of the right vertical panel and 48 px above the screen
bottom at scale 1. The 8 px margin above/left belongs to the crop, not dialog
placement. Preserve the whole panel anchor, including every model indicator.
Only the private capture fixture moves the native modal and softens its
lightbox to 64/255; controls, geometry and input blocking remain native.
The inventory checker rejects clipped anchors, incorrect modal gaps, stale
backgrounds and dark modal backdrops.
Public captures require the reference Transparent Panels extension and settings.
The driver verifies the rendered panel background alpha; the inventory records
it and the settings hash, and rejects an opaque panel. These requirements apply
only to documentation composition, not to users' applet installations.

Set `QA_RELEASE_REVIEW=1` for native named-action, focus, animation and menu-stack
checks on right/top/bottom/left panels. `QA_TEXT_SCALE=1.25` and
`QA_ANIMATIONS=false` exercise larger text and reduced motion. Use a 24-second
capture delay for this review. `QA_SLOW_VERSION=1` adds a delayed fake version
probe and verifies that Cinnamon's main loop keeps advancing until it completes.
`QA_TEARDOWN=1` with the `bucket` variant removes
the applet through Cinnamon's manager while its tooltip is open and verifies
cleanup; this diagnostic frame is not a documentation screenshot.

Menu captures must measure 419 px on the native actor, plus Cinnamon's 1 px
visible edge (420 px total at scale 1). The capture fails on a width mismatch
and records actor geometry in the inventory. PNG dimensions additionally
include the crop margin and panel; dialogs, settings and panel-only images
have their own native dimensions. Never resize a screenshot to hide a layout bug.
Copy its corresponding inventory entry too. A valid PNG alone is not freshness
proof. Update captures when runtime visuals, schema or fixture behavior changes.
For public approval, show the final captures in the task before pushing them.
