# Rights review for the first Spices release

Reviewed 2026-09-08. Scope: the current source tree, 23-file installed payload,
submission screenshot, 15 documentation captures and social preview.
This is an evidence review, not a legal opinion or a guarantee against claims.

**Artwork disposition:** the maintainer chose replacement, with no permission
inquiries. The former OpenAI knot and desktop robot have been removed from the
current tree and payload. Original quota, chat and terminal-robot SVGs and their
generated PNGs replace them. Their sources are included under GPL-3.0-or-later.

**Remaining naming limit:** the applet's metadata name is `Usage Monitor`.
At the maintainer's subsequent request, the social heading is
`ChatGPT Usage Monitor`. This still contains an OpenAI mark and is not
established as covered by the published branding conditions. Replacing the
pictures does not settle that separate name/branding question. No inquiry
will be sent. The conservative alternative remains the neutral heading
`Usage Monitor` with ChatGPT/Codex named only in descriptive compatibility copy.
The current requested social heading is a review choice, not a legal clearance.

## Verified components

| Component                             | Evidence and treatment                                                                                                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Project code and original SVGs        | Existing GPL-3.0-or-later declaration and full LICENSE; readable source shipped. Original geometric quota, chat and terminal robot designs replace third-party marks. No compiled backend or bundled dependency.               |
| Adaptive panel approach               | ATTRIBUTION credits OSS Singularity's Adaptive System Monitor, whose LICENSE was checked as GPL v3. Existing GPL declaration and credit retained.                                                                              |
| Four Yaru action SVGs                 | All four bytes match upstream commit `18b443818c0e5fed138bb4f43aff595b3e095951` (24.04.2), including resolved app aliases. Sam Hewitt credit, exact source revision, unchanged status and CC-BY-SA-4.0 license included.       |
| Social background/layout              | ImageGen source PNG and original prompt retained; project rights, if any, offered under GPL-3.0-or-later. Existing background and layout preserved, former knot replaced.                                                      |
| Noto Sans                             | Renderer font verified against local `fonts-noto-core` 20201225-2, OFL-1.1. Only rendered text distributed, no font binaries.                                                                                                  |
| Native screenshots                    | Private synthetic state with original project artwork, Yaru icons and Mint-Y/Mint-Y-Dark-Aqua rendering. Project screenshot rights offered under CC-BY-SA-4.0 with notices. This does not relicense the depicted GPL software. |
| Teal background and terminal proposal | Original SVG design sources retained under project GPL terms; the earlier terminal-only proposal is not shipped.                                                                                                               |

Yaru's [icon-specific COPYING](https://github.com/ubuntu/yaru/blob/18b443818c0e5fed138bb4f43aff595b3e095951/icons/COPYING)
offers GPL v3 or CC-BY-SA; this project retains its CC-BY-SA choice. The
[upstream copyright inventory](https://github.com/ubuntu/yaru/blob/18b443818c0e5fed138bb4f43aff595b3e095951/debian/copyright)
confirms the author. Our license text matches upstream after whitespace
normalization. Preserve attribution and licensing under the
[CC-BY-SA terms](https://creativecommons.org/licenses/by-sa/4.0/).

The [European OpenAI terms, Content](https://openai.com/policies/eu-terms-of-use/)
provide the documented basis for retaining generated output, subject to their
third-party and non-uniqueness limits. This does not establish exclusive
copyright in AI output. The [OFL FAQ](https://openfontlicense.org/ofl-faq/)
permits artwork produced using its fonts without relicensing the artwork as
font software. Mint-Y's installed `mint-themes` 2.3.8 notice is GPL-3+.

## Why the former artwork was replaced

The old desktop robot was attributed to a cropped sprite in commit
`42edd812c1b8fe2b590eb9f94a03e0562d0f771a`; the exact original knot download
was not recorded in initial commit `702dece`. No applicable redistribution
permission for those concrete image files was found in the inspected sources.

The official Codex [pet catalog](https://github.com/openai/codex/blob/main/codex-rs/tui/src/pets/catalog.rs)
names `codex-spritesheet-v4.webp`; its
[asset loader](https://github.com/openai/codex/blob/main/codex-rs/tui/src/pets/asset_pack.rs)
downloads built-in sprites separately from a CDN. The CLI repository's
Apache-2.0 license does not by itself prove licensing of that separate image.
This is a missing-evidence finding, not proof that no permission exists anywhere.

The [brand guidelines](https://openai.com/brand/) condition logo usage and
restrict primary app branding. They do not establish that the requested
social heading is cleared. No purported OpenAI endorsement or authorship is
claimed for the replacement robot or quota emblem.

The normal installer removes only byte-identical retired assets it previously
shipped. Modified files and symlinks remain untouched. Their old SHA-256 values
are recorded in the installer to identify those files, not to redistribute
them. All current captures are recreated from the replacement payload.

Historical commits, main and older published release archives still contain
earlier material until separately addressed. Their notices are not retroactive
permissions. This work does not rewrite Git history, remove releases or claim
that every historical public copy has been cleared.

## Backend and data boundary

Both `account/rateLimits/read` and `account/rateLimitResetCredit/consume` are
explicitly documented in the official [App Server reference](https://learn.chatgpt.com/docs/app-server).
The applet independently calls the user's backend through that protocol, with
explicit reset acknowledgment. It does not scrape pages or bypass quotas.
No Codex/ChatGPT executable, credential file or SDK is redistributed.

The backend's own account terms apply. History stays in the desktop profile;
project telemetry and a hosted account service are absent. Browser actions
open external services on user activation. README badges are external image
references, not bundled assets. Public captures use synthetic data and exclude
personal paths, unrelated windows and notifications.

The review covers declared source/asset provenance and visible integration,
not an exhaustive code-similarity, trademark-registration, patent or
jurisdiction-wide privacy opinion.

## Release handoff

[The asset inventory](rights-inventory.json) records every current image/vector
and its hash, license basis and distribution scope. Checks verify coverage,
unchanged PNG/SVG correspondence and exclusion of retired graphics; they do
not make legal determinations. Package tests also cover safe upgrade cleanup.

Before a public 1.0 release, resolve the social-heading choice, recheck the
exact artifact and notices, and complete the separate technical gates.
No contact request, PR, tag, release or announcement is sent by this review.
