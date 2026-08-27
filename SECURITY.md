# Security policy

ChatGPT Usage reads account-level limits through the locally installed Codex
CLI. The applet does not read credential files, accept API keys or persist usage
responses. Please use a private channel for anything that could expose Codex or
ChatGPT authentication data.

## Supported versions

Security fixes target the latest published release and the current `main`
branch. Older releases do not receive separate backports while the project is
in its pre-1.0 phase.

| Version        | Security support             |
| -------------- | ---------------------------- |
| Latest release | Supported                    |
| Current `main` | Supported development branch |
| Older releases | Upgrade first                |

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/oss-singularity/cinnamon-chatgpt-usage/security/advisories/new)
when possible. If that channel is unavailable, contact the repository owner
privately through the address published on the owner's GitHub profile.

Do not open a public issue containing credentials, tokens, Codex account files,
private paths, complete analytics responses or screenshots with account-specific
data. Include the smallest reproducible description, affected version, Linux
Mint and Cinnamon versions, Codex CLI version, expected security boundary and a
safe synthetic reproduction when possible.

## Security boundaries

- Authentication and network access remain the Codex CLI's responsibility.
- The helper sends one read-only `account/rateLimits/read` request to a local
  Codex app-server subprocess and exits.
- Project code never reads Codex credential files or stores the returned usage
  snapshot on disk.
- The applet exposes only normalized limits, reset times and credit counts in
  the local Cinnamon session.
- The analytics action opens the fixed official ChatGPT Analytics URL.
- The optional Codex executable setting is passed as one subprocess argument;
  no shell command is constructed from it.

## Out of scope and inherited risk

The project does not defend against a malicious process already running as the
same desktop user. Codex, ChatGPT, Cinnamon, Python and the operating system are
external trust boundaries. Report an upstream vulnerability to its owner and
also report it here privately if this integration makes the impact worse.
