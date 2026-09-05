# Cinnamon Spices and 1.0.0 preparation

Tracking: [issue #45](https://github.com/oss-singularity/cinnamon-chatgpt-usage/issues/45).
Baseline: v0.3.12, `a2b366ea56b02e0bb184a270e8b331b04e371e59`.
This is local preparation, not a released candidate or an accepted Spice.
No release number has been bumped for screenshots alone.

## Dependency order and evidence

| Audit                | Local preparation                                                                                                               | Candidate or release gate                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1. Package           | Shared allowlist, ASCII metadata, portable README, deterministic submission/install ZIPs, hashes and pinned upstream validation | Confirm author identity and final screenshot; review exported payload                       |
| 2. UI-thread probes  | Python discovery, bounded version output/time, asynchronous five-minute JS cache                                                | Private responsiveness and removal evidence; review residual local file I/O                 |
| 3. Transport         | Unbuffered nonblocking reads/writes, JSON framing, deadline, size cap, initialization errors and process-group cleanup          | Real-pipe tests run in `make verify`                                                        |
| 4. Reset uncertainty | Private attempt journal before dispatch; same parameters on explicit retry, retained through reload; SIGTERM cleanup            | Fake lost-response/reload/retry tests; account continuity remains a user requirement        |
| 5. Rolling totals    | Independent `periods["24h"]`; chart remains wall-clock aligned                                                                  | Half-hour, 60/120-minute buckets, incomplete history, midnight and DST tests                |
| 6. Invalid inputs    | Non-finite numbers rejected; invalid windows omitted; invalid history points ignored                                            | Legacy and named-limit robustness tests                                                     |
| 7. Themes            | Secondary/menu foregrounds, ring tracks and knot tint derive from the menu theme                                                | Inspect light/dark captures; high-contrast and scale matrix remain gates                    |
| 8. Screenshots       | Private capture scripts and 15-variant inventory, including Notifications                                                       | Review every final image and source/hash inventory before replacing/publication             |
| 9. Documentation     | README, SECURITY and bug form updated; installed README is portable                                                             | Support matrix and post-1.0 support policy review                                           |
| 10. Artwork          | Code/asset separation and full notices travel with package                                                                      | Robot and knot provenance/redistribution resolution is still required                       |
| 11. Discovery        | One Python discovery algorithm used by refresh and JS launch/version cache                                                      | CLI/app-only, explicit `~`, spaces, symlink-chain and precedence fixtures                   |
| 12. Compatibility    | Existing geometry preserved; scope and investigations made explicit below                                                       | Older Cinnamon, accessibility, translation and account boundaries are not declared complete |
| 13. Reproducibility  | Real-process tests, package round-trips, shared metadata version and UI entrypoint                                              | Pinned linter, final visual review and exact candidate artifact receipt                     |

## Version and support decisions

Prepare a functional pre-1.0 release only after the runtime and UI gates pass.
A possible milestone is 0.4.0; it is not selected or published by this document.
The first catalog target remains 1.0.0. Store submission and store acceptance
are separate events and must never be inferred from a tag.

The audit baseline and current private GUI work use Cinnamon 6.6.9. Python
syntax/runtime prerequisites are 3.10 or newer; the local interpreter is recorded
in the work log. Metadata still lists Cinnamon 5.8, 6.0, 6.2, 6.4 and 6.6.
Do not claim these older branches tested. Before 1.0, either exercise their
minimum/current environments or explicitly narrow the declared support range
with maintainer review. Do not silently relabel untested compatibility as proven.

The current source uses private popup instance methods, menu stack bookkeeping
and a fixed popup width across panel orientations. Review these against each supported Cinnamon
version; existing centering/disclosure tests do not prove shell compatibility.
The width regression is covered by production-method tests for all four panel
positions and native right/top captures after rebuild and reopen. At scale 1,
the actor measures 419 px plus the visible 1 px edge. Expanded horizontal Spark
and light-theme captures also retain that width. This does not complete the
broader compatibility matrix below.
A matrix must cover top/bottom/left/right panels, small displays, multiple
monitors, 125–200% scale, large fonts and RTL. Critical quota text stays static.
Cinnamon's current `environment.js` respects disabled animations when
`animationRequired` is false; test the actual reset-expiry actor as well.

Keyboard traversal/activation, focus after refresh, screen-reader names and
removal with open tooltips must be inspected in real private Cinnamon.
English-only remains the current state. Gettext setup, complete translatable
messages, settings extraction and a POT are required preparation before calling
the applet localization-ready. There is no claim of a completed translation.

History currently belongs to the desktop profile. It is not account-partitioned.
The documented manual tracking reset preserves this limitation honestly;
backend-path equality cannot prove account equality. Automatic partitioning
requires a stable backend identity contract without reading credential files.
Do not test this with the user's real account history.

## Ownership and assets

Preferred public identity: **OSS Singularity**, GitHub organization
`oss-singularity`; responsible maintainer: **Claudiu Schuster** (`ClaudiuSchuster`).
The existing UUID stays `chatgpt-usage@oss-singularity`.

`packaging/info.json` currently uses the approved fallback `ClaudiuSchuster`.
The upstream validator accepts an organization-shaped string but does not
verify organizational ownership. The documented workflow compares PR author
and `info.json.author`; an organization's repository administrator does not
therefore automatically match that field. Before submission, resolve whether
upstream accepts `oss-singularity` with Claudiu acting for it. Do not send that
question publicly without Claudiu reviewing the exact message.

Reference: [PDrive's rclone introduction](https://forum.rclone.org/t/pdrive-proton-drive-at-home-on-linux/54205)
uses OSS Singularity as its forum identity. That establishes the preferred
presentation, not a Cinnamon Spices ownership exception.

| Asset                                    | Current provenance                                                        | Redistribution disposition                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `icons/*-symbolic.svg` (four Yaru files) | Ubuntu Yaru 24.04.2; original files and bundled CC-BY-SA-4.0 text         | Notices included; retain original shapes and symbolic recoloring                        |
| `icons/codex.png`                        | Cropped desktop sprite frame                                              | Permission not documented; obtain evidence or review a distributable replacement        |
| `icons/chatgpt-white.png`, `icon.png`    | ChatGPT knot identification artwork                                       | Exact source and applicable redistribution/brand conditions still need a recorded basis |
| Social background and overlay            | Existing committed background plus reproducible SVG/renderer              | Record original background provenance before distribution review is complete            |
| UI captures                              | Private Cinnamon, staged current payload and constrained display fixtures | Review final images, themes and asset dependencies before publication                   |

Original gratitude wording remains here: Made with love by Claudiu & Codex. 🩷
ASCII store metadata does not remove the project's credit to its contributors.

## Reproduction and submission

```bash
make verify
python3 scripts/package.py export --output /tmp/chatgpt-spices-review --validate
```

The validator is pinned to upstream commit
`0fa36ed070daa26d51ced6ea87a08066b342eca4`; its SHA-256 is checked before execution.
Recheck upstream HEAD before submission. The network-free package tests are
part of `make verify`; the official validator requires network and Pillow.

The export contains the submission tree, `submission.zip`, `install.zip` and
`SHA256SUMS`. The ZIPs have sorted paths, fixed timestamps and regular-file
permissions. No binaries, credentials, state, cache, development tests or
installed executable are included. PNG artwork is included as listed above;
its presence in a structurally valid archive does not settle its rights.
The installer preserves unmanaged files during upgrade and refuses symlink
destinations; uninstall removes the selected applet directory but retains
external settings, history and unresolved-reset state.

After the candidate is complete, present its visuals, full diff, tests,
changelog and exact package hashes to Claudiu. Only then seek approval for the
specific public step. A submission should affect only this applet and use the
upstream title format `ChatGPT Usage: ...`. Preserve protected squash merges
and all six project PR checks; no administrator bypass.

Release/tag publication, the Spices PR, forum announcements and other public
posts each require Claudiu to see the concrete content before the final save.
After upstream acceptance, verify the actual catalog listing, downloaded
archive, and installation/update from Cinnamon System Settings. Record accepted
commit, package hashes and catalog version; only then call it an official Spice.

An original GPL-3.0-or-later terminal glyph is prepared as
[`docs/proposals/codex-launch-icon.svg`](proposals/codex-launch-icon.svg) for
review if permission for the cropped robot is unavailable. It is deliberately
not in the shipped manifest and has not replaced the accepted launch artwork.
