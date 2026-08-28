# Changelog

## Unreleased

- Keep quota and reset-progress rings fully inside the popup when Cinnamon's
  native model-history submenu adds its scrollbar allocation.

## 0.2.0 — 2026-08-28

- Discover every named usage bucket exposed by the Codex app-server, including
  dedicated GPT-5.3-Codex-Spark 5h and 7d limits when enabled for the account,
  while keeping unnamed internal buckets hidden.
- Group account and model-specific limits and their observed histories clearly
  in the popup while retaining a compact account-only panel by default, with
  an option to add model-specific limits to the panel. Model histories use
  native expandable Cinnamon submenus with overlay scrollbars to keep the
  default popup compact and its width stable.
- Add paired circular indicators for every active 5h and 7d window: available
  quota in a cyan popup-header ring and green reset progress in its usage row,
  with no additional API requests.
- Add native Cinnamon hover details to every one-hour activity bucket with its
  local time range, observed consumption and partial/unknown state, using a
  responsive 120 ms reveal delay.
- Show the elapsed collection duration beside the absolute history start time.
- Add observed consumption for the last 1h, 4h, 12h and local calendar day,
  calculated separately for every active account or named model quota.
- Add a compact 24-hour activity bar timeline with time axis, configurable
  one-hour or two-hour buckets, peak scale and visually dimmed unknown history.
- Show safely observed consumption immediately in incomplete buckets as dimmed
  partial bars with an approximate (`~`) peak instead of hiding the activity.
- Persist only minimal credential-free samples for eight days in the user's XDG
  state directory with private file permissions.
- Treat resets as new quota generations, ignore falling rolling-window values
  and mark incomplete observation periods with `~`.
- Ignore one-minute reset-timestamp jitter so transient API rounding cannot
  create phantom consumption spikes.
- Add availability-aware ChatGPT App and Codex CLI launch buttons that open
  native installation guidance instead of becoming inactive when software is
  missing, plus direct links to ChatGPT, Codex Cloud and ChatGPT Analytics.
- Keep the popup open while `Refresh now` updates the displayed usage values
  with a click-blocking activity spinner, then briefly confirm successful
  updates in green.
- Enrich the native Cinnamon About dialog with a short project note and credits.

## 0.1.0 — 2026-08-27

- Read ChatGPT Work and Codex limits through the official local Codex
  `account/rateLimits/read` app-server method.
- Mirror the canonical account-level Analytics limits while excluding internal
  model-specific buckets that the web page does not show.
- Discover primary and optional secondary windows dynamically, including the
  five-hour window only for accounts that expose it.
- Allow hiding the 7d panel block whenever a 5h window is active.
- Show a bold click-menu title plus active reset times, credits and earned resets
  in clearly separated rows.
- Label the canonical click-menu section `Usage limits` instead of exposing its
  internal bucket name.
- Adapt automatically between compact horizontal and 40 px vertical layouts.
- Add configurable refresh interval, CLI path, labels, icon, separator, font,
  colors and remaining-usage thresholds.
- Default to a three-minute refresh interval and 100% panel font size.
- Use the original ChatGPT knot mark as an optically sized transparent white panel glyph.
- Follow Cinnamon's system 12 / 24-hour clock preference for menu timestamps.
- Add parser, formatting, JSON, SVG, shell and CI checks.
