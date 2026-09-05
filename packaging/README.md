# ChatGPT Usage for Cinnamon

An independent OSS Singularity applet showing ChatGPT Work and Codex limits,
reset times, credits and observed consumption on horizontal or vertical panels.

Requires Python 3.10 or newer and a signed-in Codex CLI or a ChatGPT desktop
package containing `resources/codex`. The applet never installs a backend or
reads its credentials. Set an explicit backend path in the applet settings if
auto-discovery does not match your package layout.

Open the popup to refresh, inspect each model's limits, or launch the apps and
web shortcuts. An earned reset requires explicit confirmation. If its outcome
is unknown, retry the saved request using the same account. Do not switch
accounts until that attempt is resolved.

The white panel text color and the blue/yellow/pink usage colors are configured
separately. Model-specific panel mode selects the tightest remaining quota for
each duration. The popup retains every available model/window.

Usage history stores eight days of sampled percentages and reset timestamps.
It reports observed changes, including incomplete periods marked with `~`, and
cannot reconstruct consumption between samples. Its state is local to this
desktop profile, not partitioned by account; see the full guide before switching
accounts. Uninstalling retains settings, history and unresolved reset attempts.

- [Full guide and screenshots](https://github.com/oss-singularity/cinnamon-chatgpt-usage#readme)
- [Support and bug reports](https://github.com/oss-singularity/cinnamon-chatgpt-usage/issues)
- [Security policy](https://github.com/oss-singularity/cinnamon-chatgpt-usage/blob/main/SECURITY.md)
- [Code license](https://github.com/oss-singularity/cinnamon-chatgpt-usage/blob/main/LICENSE)
- [Artwork attribution](https://github.com/oss-singularity/cinnamon-chatgpt-usage/blob/main/ATTRIBUTION.md)

Code is GPL-3.0-or-later. Bundled Yaru action icons are CC-BY-SA-4.0. LICENSE,
SECURITY.md, ATTRIBUTION.md and the icon notices are also included in the
installed applet directory. OpenAI, ChatGPT and Codex are OpenAI trademarks.
This community applet is not affiliated with or endorsed by OpenAI.
