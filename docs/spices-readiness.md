# Cinnamon Spices and 1.0.x preparation

Tracking: [issue #45](https://github.com/oss-singularity/cinnamon-chatgpt-usage/issues/45).
Baseline: v0.3.12, `a2b366ea56b02e0bb184a270e8b331b04e371e59`.
This records the validated 1.0.0 package baseline. GitHub release publication and
Cinnamon Spices catalog acceptance are separate milestones.

## Current checkpoint — 2026-09-09

**Candidate review complete and accepted by Claudiu on 2026-09-08.**
The approved runtime and screenshots are recorded at `099d26b3dad79dd9a944832b77ba84ca86ba34ae`.
The subsequent documentation update records that approval and refreshes the
package receipt after removing the obsolete naming-review notice.
The manager description retains “usage beautifully in view” and fits one line
in a native 646 px manager row. The current local archive was installed through
Cinnamon's own Spices folder installer and recognized in Manage; metadata differs
only by Cinnamon's generated `last-edited` and JSON formatting. The other 23
payload files match exactly, and enabled applets/settings remain unchanged.

- [x] All 13 audit areas below are implemented, verified or explicitly scoped
      to the declared Cinnamon 5.8+ series and the accepted 6.6.9 baseline.
- [x] Maintainer identity, unchanged UUID and Cinnamon 5.8+ compatibility declared;
      native Cinnamon 6.6.9 support accepted.
- [x] Public name and original artwork accepted; naming review closed.
- [x] All 15 screenshots accepted by the maintainer.
- [x] Local tests, native UI checks, linter and structural package validation passed.
- [x] Package receipt reviewed; real archive and payload hashes recorded.

[Project PR #46](https://github.com/oss-singularity/cinnamon-chatgpt-usage/pull/46)
was merged as `ef77e9851ca73a4d113da7a62be49ecc75deefdf`, with all six PR checks
and both post-merge workflows passing. The maintainer authorized publication.
[Spices PR #9024](https://github.com/linuxmint/cinnamon-spices-applets/pull/9024)
has been submitted and is awaiting upstream review. Catalog acceptance and the
actual store installation/update check remain open; this is not yet an accepted Spice.

**Start with [the short maintainer handoff](release-next-steps.md)** for accounts,
manual decisions and publication order. The earlier commit-pinned copy is a
historical checkpoint, not the status of every later change.

The current candidate builds on `1397370`, adding gettext, native popup lifecycle
and accessibility/layout fixes: 42 Python tests plus the
JavaScript suites pass; all 15 screenshots match their producing sources;
the installed payload now has 24 files, including the native GTK path widget and POT.
Reset acknowledgment, retained notifications, panel warning colors, global
model visibility, dual installation-path hints and Recheck have additional
unit/native evidence. A fresh package passes the official structural validator.
[Artifact receipt](release-checkpoint.json) and
[unsent publication/contact drafts](release-drafts.md) are prepared.

The upstream validator at current HEAD
`b425f4d648196d279ff972d642f1693d5b23b55b` has the same SHA-256 as our pinned
validator. Its success covers package structure, not every review criterion.
Gettext/POT now covers JS, Python, metadata and settings; real compiled-catalog
tests cover fallback, reordered placeholders and machine-protocol isolation.
The native popup subclass delegates lifecycle and menu-stack handling to Cinnamon.
The six protected remote PR checks run on the project PR. Their current status
is tracked in the release issue; successful local checks do not replace them.

The existing GitHub account and approved `ClaudiuSchuster` author fallback are
sufficient for the documented submission workflow. An organization author is an
optional upstream clarification, not a prerequisite for using that fallback.
The social background's original ImageGen prompt is already recorded in
[its source README](../.github/social-preview-src/README.md); its missing-origin
task is closed. The [rights review](rights-review.md) records original replacement artwork and
independent public branding as **ChatGPT Usage Monitor**. No permission inquiries will
be sent. The former robot and knot graphics have been removed from the current
tree; the UUID and user state remain unchanged. The consistently requested
public name **ChatGPT Usage Monitor** was accepted by the maintainer, who closed
the naming item on 2026-09-08. It is no longer an open release-planning gate.

## Dependency order and evidence

| Audit                | Local preparation                                                                                                               | Accepted candidate evidence                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1. Package           | Shared allowlist, ASCII metadata, portable README, deterministic submission/install ZIPs, hashes and pinned upstream validation | Accepted maintainer identity, screenshot and payload; structural validation passed                             |
| 2. UI-thread probes  | Python discovery, bounded version output/time, asynchronous five-minute JS cache                                                | Native delayed-probe responsiveness and removal checks; residual I/O is local executable/desktop-file metadata |
| 3. Transport         | Unbuffered nonblocking reads/writes, JSON framing, deadline, size cap, initialization errors and process-group cleanup          | Real-pipe tests run in `make verify`                                                                           |
| 4. Reset uncertainty | Private attempt journal before dispatch; same parameters on explicit retry, retained through reload; SIGTERM cleanup            | Fake lost-response/reload/retry tests; account continuity remains a user requirement                           |
| 5. Rolling totals    | Independent `periods["24h"]`; chart remains wall-clock aligned                                                                  | Half-hour, 60/120-minute buckets, incomplete history, midnight and DST tests                                   |
| 6. Invalid inputs    | Non-finite numbers rejected; invalid windows omitted; invalid history points ignored                                            | Legacy and named-limit robustness tests                                                                        |
| 7. Themes            | Secondary/menu foregrounds, ring tracks and quota glyph tint derive from the menu theme                                         | Light/dark and large-font checks; other desktop configurations are outside the verified baseline below         |
| 8. Screenshots       | Private capture scripts and 15-variant inventory, including Notifications                                                       | All 15 final images visually reviewed, source/hash verified and accepted                                       |
| 9. Documentation     | README, SECURITY and bug form updated; installed README is portable                                                             | Cinnamon 5.8–6.6 declared; native 6.6.9 evidence; post-1.0 policy confirmed                                    |
| 10. Artwork          | Code/asset separation and full notices travel with package                                                                      | Original artwork, notices, final inventory and captures verified and accepted                                  |
| 11. Discovery        | One Python discovery algorithm used by refresh and JS launch/version cache                                                      | CLI/app-only, explicit `~`, spaces, symlink-chain and precedence fixtures                                      |
| 12. Compatibility    | Existing geometry preserved; scope and investigations made explicit below                                                       | Native 6.6 evidence, real gettext catalog and synthetic history/reset boundary tests                           |
| 13. Reproducibility  | Real-process tests, package round-trips, shared metadata version and UI entrypoint                                              | Pinned linter passed; final visuals and exact artifact receipt accepted                                        |

## Version and support decisions

The candidate version is 1.0.0; no intermediate 0.4.0 release is needed.
Store submission and store acceptance
are separate events and must never be inferred from a tag.

The audit baseline and current private GUI work use Cinnamon 6.6.9. Python
syntax/runtime prerequisites are 3.10 or newer; the local interpreter is recorded
in the work log. Version 1.0.4 declares Cinnamon **5.8, 6.0, 6.2, 6.4 and 6.6**,
matching the compatibility series used by the sibling Spices applets. The custom
settings-widget and binding APIs used by this applet are present in the official
Cinnamon 5.8 source; a separate 5.8 live desktop is not available on this host,
so native runtime evidence remains explicitly anchored at 6.6.9. The existing
SECURITY policy already covers 1.0 and later:
fixes target the latest published release and current main, without backports
to older releases.

The first-release presentation baseline is X11 with Mint-Y or Mint-Y-Dark-Aqua,
100% display scaling and 100–200% text size. At normal size, the popup actor is
419 px plus its visible 1 px edge. Increased text size scales the width instead
of hiding rings and graphs behind the panel. A native scroll view keeps long
menus within the monitor, and focused actions scroll into view. Tests check
actual visible child bounds after rebuild and animated close/reopen, not just
the outer width. Both disclosure arrows use their rotated allocation vertices
to align with the footer; native checks cover open and closed states.
Small-screen evidence uses 1366×768; standard captures use
1920×1080. Right/top/bottom/left panel cycles and light/dark themes are covered.

Named action actors, focus after rebuild, reset acknowledgment keyboard behavior,
reduced-motion reset-expiry actors and removal with an open tooltip have native
private-session checks. This is not a full Orca certification. Mixed-DPI or
multiple monitors, fractional display scaling, RTL translations and high-contrast
shell themes remain outside the verified first-release baseline. Unit scaling
coverage does not substitute for those desktop integration tests.

The runtime contains gettext hooks and a reproducible POT; English remains the
only shipped language. See [translation instructions](../po/README.md). A synthetic
catalog is compiled and exercised through real CJS and Python gettext in tests.

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

The candidate's visuals, tests, changelog and package receipt have been reviewed
and accepted by Claudiu. The project PR is merged and the Spices PR submitted.
GitHub 1.0.0 publication is authorized while catalog review is pending.
A submission should affect only this applet and use the
upstream title format `ChatGPT Usage Monitor: ...`. Preserve protected squash merges
and all six project PR checks; no administrator bypass.

Claudiu reviewed the prepared content and authorized the publication steps.
After upstream acceptance, verify the actual catalog listing, downloaded
archive, and installation/update from Cinnamon System Settings. Record accepted
commit, package hashes and catalog version; only then call it an official Spice.

The earlier terminal proposal remains historical design material. The shipped
replacement is the original terminal robot under `icons/`, with editable source
and no dependency on an OpenAI sprite.
