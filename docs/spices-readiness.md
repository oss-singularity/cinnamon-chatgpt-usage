# Cinnamon Spices and 1.0.0 preparation

Tracking: [issue #45](https://github.com/oss-singularity/cinnamon-chatgpt-usage/issues/45).
Baseline: v0.3.12, `a2b366ea56b02e0bb184a270e8b331b04e371e59`.
This is local preparation, not a released candidate or an accepted Spice.
No release number has been bumped for screenshots alone.

## Current checkpoint — 2026-09-08

**Start with [the short maintainer handoff](release-next-steps.md)** for accounts,
manual decisions and publication order. The earlier commit-pinned copy is a
historical checkpoint, not the status of every later change.

The current candidate builds on `314a4ca`, adding original artwork, Cinnamon
6.6 scope and packaging regression coverage: 38 Python tests plus the
JavaScript suites pass; all 15 screenshots match their producing sources;
the installed payload now has 23 files, including the native GTK path widget.
Reset acknowledgment, retained notifications, panel warning colors, global
model visibility, dual installation-path hints and Recheck have additional
unit/native evidence. A fresh package passes the official structural validator.
[Artifact receipt](release-checkpoint.json) and
[unsent publication/contact drafts](release-drafts.md) are prepared.

The upstream validator at current HEAD
`b425f4d648196d279ff972d642f1693d5b23b55b` has the same SHA-256 as our pinned
validator. Its success covers package structure, not every review criterion.
Gettext/POT is still absent. Remaining Cinnamon 6.6 accessibility evidence and the
private-menu integration review remain open. The six protected remote PR checks
have not run because this branch has no PR. Do not mark these gates green from
the successful local functional checks.

The existing GitHub account and approved `ClaudiuSchuster` author fallback are
sufficient for the documented submission workflow. An organization author is an
optional upstream clarification, not a prerequisite for using that fallback.
The social background's original ImageGen prompt is already recorded in
[its source README](../.github/social-preview-src/README.md); its missing-origin
task is closed. The [rights review](rights-review.md) records original replacement artwork and
independent public branding as **Usage Monitor**. No permission inquiries will
be sent. The former robot and knot graphics have been removed from the current
tree; the UUID and user state remain unchanged. The subsequently requested
social heading **ChatGPT Usage Monitor** remains a separate naming/brand review
limit; no complete legal clearance is claimed.

## Dependency order and evidence

| Audit                | Local preparation                                                                                                               | Candidate or release gate                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1. Package           | Shared allowlist, ASCII metadata, portable README, deterministic submission/install ZIPs, hashes and pinned upstream validation | Confirm author identity and final screenshot; review exported payload                |
| 2. UI-thread probes  | Python discovery, bounded version output/time, asynchronous five-minute JS cache                                                | Private responsiveness and removal evidence; review residual local file I/O          |
| 3. Transport         | Unbuffered nonblocking reads/writes, JSON framing, deadline, size cap, initialization errors and process-group cleanup          | Real-pipe tests run in `make verify`                                                 |
| 4. Reset uncertainty | Private attempt journal before dispatch; same parameters on explicit retry, retained through reload; SIGTERM cleanup            | Fake lost-response/reload/retry tests; account continuity remains a user requirement |
| 5. Rolling totals    | Independent `periods["24h"]`; chart remains wall-clock aligned                                                                  | Half-hour, 60/120-minute buckets, incomplete history, midnight and DST tests         |
| 6. Invalid inputs    | Non-finite numbers rejected; invalid windows omitted; invalid history points ignored                                            | Legacy and named-limit robustness tests                                              |
| 7. Themes            | Secondary/menu foregrounds, ring tracks and quota glyph tint derive from the menu theme                                         | Inspect light/dark captures; high-contrast and scale matrix remain gates             |
| 8. Screenshots       | Private capture scripts and 15-variant inventory, including Notifications                                                       | Review every final image and source/hash inventory before replacing/publication      |
| 9. Documentation     | README, SECURITY and bug form updated; installed README is portable                                                             | Cinnamon 6.6 scope selected; existing post-1.0 policy confirmed                      |
| 10. Artwork          | Code/asset separation and full notices travel with package                                                                      | Original replacement artwork and notices; verify final inventory and captures        |
| 11. Discovery        | One Python discovery algorithm used by refresh and JS launch/version cache                                                      | CLI/app-only, explicit `~`, spaces, symlink-chain and precedence fixtures            |
| 12. Compatibility    | Existing geometry preserved; scope and investigations made explicit below                                                       | Cinnamon 6.6 accessibility, translation and account boundaries remain under review   |
| 13. Reproducibility  | Real-process tests, package round-trips, shared metadata version and UI entrypoint                                              | Pinned linter, final visual review and exact candidate artifact receipt              |

## Version and support decisions

Prepare a functional pre-1.0 release only after the runtime and UI gates pass.
A possible milestone is 0.4.0; it is not selected or published by this document.
The first catalog target remains 1.0.0. Store submission and store acceptance
are separate events and must never be inferred from a tag.

The audit baseline and current private GUI work use Cinnamon 6.6.9. Python
syntax/runtime prerequisites are 3.10 or newer; the local interpreter is recorded
in the work log. On 2026-09-08 the maintainer chose Cinnamon **6.6 only** for
the first Spices release and explicitly dropped the proposed 5.8–6.4 test series.
Metadata now declares only 6.6. Older versions are outside this release's
supported scope. The existing SECURITY policy already covers 1.0 and later:
fixes target the latest published release and current main, without backports
to older releases.

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
therefore automatically match that field. Only if the organization-author alternative is pursued, clarify whether
upstream accepts `oss-singularity` with Claudiu acting for it. Do not send that
question publicly without Claudiu reviewing the exact message.

Reference: [PDrive's rclone introduction](https://forum.rclone.org/t/pdrive-proton-drive-at-home-on-linux/54205)
uses OSS Singularity as its forum identity. That establishes the preferred
presentation, not a Cinnamon Spices ownership exception.

| Asset                                    | Current provenance                                                     | Redistribution disposition                                       |
| ---------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `icons/*-symbolic.svg` (four Yaru files) | Ubuntu Yaru 24.04.2; original files and bundled CC-BY-SA-4.0 text      | Notices included; retain original shapes and symbolic recoloring |
| Original applet and action art           | Editable quota, chat and terminal-robot SVGs plus reproducible PNGs    | GPL-3.0-or-later; source files included in the payload           |
| Social preview                           | Original generated background and SVG layout with project quota emblem | Source prompt and license recorded; former knot removed          |
| UI captures                              | Private native Cinnamon with synthetic data and current original icons | CC-BY-SA-4.0 notices, current source/hash inventory              |

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
upstream title format `Usage Monitor: ...`. Preserve protected squash merges
and all six project PR checks; no administrator bypass.

Release/tag publication, the Spices PR, forum announcements and other public
posts each require Claudiu to see the concrete content before the final save.
After upstream acceptance, verify the actual catalog listing, downloaded
archive, and installation/update from Cinnamon System Settings. Record accepted
commit, package hashes and catalog version; only then call it an official Spice.

The earlier terminal proposal remains historical design material. The shipped
replacement is the original terminal robot under `icons/`, with editable source
and no dependency on an OpenAI sprite.
