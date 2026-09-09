# Translations

English is the fallback language. This release provides a translation template;
no completed language translations are shipped yet.

Run `make translations` with GNU gettext installed to update the POT from
JavaScript, Python, metadata and settings. `make check-translations` rejects a
stale template. Translate complete messages and preserve all printf placeholders;
JavaScript supports reordered placeholders such as `%2$s`.

Name a contributed catalog `LANGUAGE.po` in this directory. For local testing,
compile it with `msgfmt --check` to
`$XDG_DATA_HOME/locale/LANGUAGE/LC_MESSAGES/chatgpt-usage@oss-singularity.mo`
(normally `~/.local/share/locale/...`),
then reload the applet under that locale. Cinnamon Spices installs contributed
catalogs through its translation workflow. The repository's current installer
ships the template and does not compile development catalogs automatically.

The regression suite compiles a synthetic catalog and exercises native CJS and
Python gettext, fallback, reordered placeholders and machine-protocol isolation.
