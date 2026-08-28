# Changelog

## 0.2.0 — Unreleased

- Add observed consumption for the last 1h, 4h, 12h and local calendar day,
  calculated separately for every active account-level quota.
- Add a compact 24-hour activity bar timeline with time axis, two-hour buckets,
  peak scale and visually dimmed unknown history.
- Show safely observed consumption immediately in incomplete buckets as dimmed
  partial bars with an approximate (`~`) peak instead of hiding the activity.
- Persist only minimal credential-free samples for eight days in the user's XDG
  state directory with private file permissions.
- Treat resets as new quota generations, ignore falling rolling-window values
  and mark incomplete observation periods with `~`.
- Ignore one-minute reset-timestamp jitter so transient API rounding cannot
  create phantom consumption spikes.
- Add availability-aware ChatGPT App and Codex Terminal launch buttons plus
  direct links to ChatGPT, Codex Cloud and ChatGPT Analytics.

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
