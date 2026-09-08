# Review drafts for ChatGPT Usage Monitor 1.0.0

**Publication reference texts.** No contact requests are planned or authorized.
The maintainer selected replacement artwork and independent branding instead.
The maintainer has accepted the candidate, screenshots and public name;
see [the completed review](rights-review.md). Claudiu reviews subsequent
merge, submission and publication steps and has authorized publication.
Project PR #46 is merged; [Spices PR #9024](https://github.com/linuxmint/cinnamon-spices-applets/pull/9024)
is submitted. The catalog-announcement text below remains unsent until acceptance.
Catalog and release links are filled only after those objects exist.

## Project pull request draft

Suggested title: **Prepare ChatGPT Usage Monitor 1.0.0 for Cinnamon Spices**.

The release candidate makes backend discovery and subprocess transport
consistent, retains uncertain reset attempts safely, and adds explicit reset
acknowledgment. It also provides optional installation-path overrides with
automatic hints, persistent notification-center alerts, model visibility
controls and theme-aware menus. Gettext/POT covers the runtime, metadata and
settings. Normal text retains 420 px; larger text grows proportionally and long
menus scroll without hiding keyboard-focused actions.

Candidate: version 1.0.0 for Cinnamon 6.6, with original project artwork,
42 Python tests, JavaScript regressions and 15 current native screenshots.
The exact checks, qualified accessibility baseline and package hashes are in
`docs/spices-readiness.md` and `docs/release-checkpoint.json`. The six
required remote checks must pass on the actual PR; local checks are not a
substitute. Link the release-preparation issue intentionally at creation time.

## Spices submission draft

Suggested title: **ChatGPT Usage Monitor: add usage-limit applet**.

> This adds one independent applet that displays ChatGPT Work and Codex usage
> limits on Cinnamon's horizontal and vertical panels.
>
> The applet uses a user-installed Codex CLI or the backend bundled with a
> supported ChatGPT app. It does not install either product or read their
> credential files. The CLI is preferred; optional paths support custom
> installations. Earned reset redemption requires explicit confirmation and
> a fresh acknowledgment, and uncertain outcomes retain the same attempt key.
>
> Public project: OSS Singularity. Responsible maintainer and info.json.author:
> ClaudiuSchuster. UUID: chatgpt-usage@oss-singularity.
>
> Only this applet's directory is included. Code and third-party asset notices
> travel with the package. The applet is not affiliated with or endorsed by
> OpenAI.

Prepared version: 1.0.0; declared Cinnamon series: 6.6, tested on 6.6.9.
English fallback with gettext/POT; no completed translated languages yet.
Attach the approved commit and exact package receipt at submission time.
The candidate archive is accepted for proceeding with the project PR.

## GitHub release and forum announcement drafts

The GitHub 1.0.0 release can be published while catalog review is pending, with
that status clearly stated. Use the catalog-debut and forum wording below only
after filling in the verified catalog listing and final tag/commit.
Do not claim catalog acceptance merely because a tag or PR exists.

**Release title:** ChatGPT Usage Monitor 1.0.0 — Cinnamon Spices debut

> Our first Cinnamon Spices release brings ChatGPT Work and Codex usage limits,
> reset times and observed consumption into the Cinnamon panel. It supports
> Codex CLI and ChatGPT-app backends, optional path overrides, model-specific
> display controls, configurable warnings and retained notifications.
>
> Install from Cinnamon's Applets settings using the verified catalog listing.
> Existing manual installations should use the tested migration instructions
> included with this release. No credentials or usage history are bundled.
>
> An independent OSS Singularity project, made with love by Claudiu & Codex.

**Forum title:** ChatGPT Usage Monitor 1.0.0 for Cinnamon — now available as a Spice

> Hi everyone! We have released our first official Cinnamon Spice: a small
> panel companion for ChatGPT Work and Codex usage limits.
>
> It shows quota windows, reset times and recent observed consumption, with
> horizontal/vertical panel support, model display controls and configurable
> notifications. It works with a locally installed Codex CLI or a supported
> ChatGPT-app backend.
>
> Catalog, source, installation/migration notes and supported versions:
> insert the verified final links and support range here before posting.
>
> Feedback and reproducible bug reports are welcome. This is an independent
> community project and is not affiliated with or endorsed by OpenAI.

Choose the actual forum/category and review its current posting rules before
creating an account or sending this draft.
