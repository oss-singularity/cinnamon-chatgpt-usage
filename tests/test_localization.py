"""Exercise real gettext catalogs, placeholder order and the packaged template."""

import gettext
import importlib.util
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UUID = "chatgpt-usage@oss-singularity"


class LocalizationTests(unittest.TestCase):
    def test_real_catalog_reordering_fallback_and_backend_errors(self):
        with tempfile.TemporaryDirectory(prefix="usage-locale-test-") as directory:
            home = Path(directory)
            catalog = home / ".local/share/locale/zz/LC_MESSAGES" / f"{UUID}.mo"
            catalog.parent.mkdir(parents=True)
            messages = {
                "%s has %s remaining.": "%2$s restants pour %1$s.",
                "Reset applied": "RESET TRADUIT",
                "Codex CLI is not executable: %(path)s": "INEXECUTABLE : %(path)s",
                "Automatic paths checked. Your manual entries are unchanged.": "MANUAL VALUES PRESERVED",
            }
            header = "Content-Type: text/plain; charset=UTF-8\nLanguage: zz\n"
            po = home / "fixture.po"
            po.write_text(
                'msgid ""\nmsgstr '
                + json.dumps(header)
                + "\n\n"
                + "\n\n".join(f"msgid {json.dumps(key)}\nmsgstr {json.dumps(value)}" for key, value in messages.items())
                + "\n"
            )
            subprocess.run(["msgfmt", "--check-format", str(po), "-o", str(catalog)], check=True)
            env = {
                **os.environ,
                "HOME": str(home),
                "XDG_DATA_HOME": str(home / ".local/share"),
                "LANGUAGE": "zz",
                "LC_ALL": "en_US.UTF-8",
            }
            js = """
const GLib=imports.gi.GLib, ByteArray=imports.byteArray;
const module={exports:{}};
new Function("module", ByteArray.toString(GLib.file_get_contents("usage-format.js")[1]))(module);
const f=module.exports;
if(f.buildResetConsumeFeedback("reset").title!=="RESET TRADUIT") throw Error("gettext catalog unused");
if(f.buildResetConsumeFeedback("alreadyRedeemed").title!=="Reset already applied") throw Error("fallback");
const previous={limits:[{id:"codex",label:"Codex",windows:[{durationMinutes:300,remainingPercent:60}]}]};
const current={limits:[{id:"codex",label:"Codex",windows:[{durationMinutes:300,remainingPercent:20}]}]};
const event=f.buildUsageNotificationEvents(previous,current,{enableFiveHourLowNotifications:true,fiveHourWarningRemaining:25,fiveHourCriticalRemaining:10})[0];
if(event.message!=="20% restants pour Codex.") throw Error(event.message);
if(f.parseUsageHelperError("AUTH_REQUIRED:message").authenticationRequired!==true) throw Error("protocol");
"""
            subprocess.run(["cjs", "-c", js], cwd=ROOT, env=env, check=True)
            py = """
import chatgpt_usage as usage
try:
    usage.resolve_codex("/missing/manual-backend")
except usage.UsageError as error:
    assert str(error) == "INEXECUTABLE : /missing/manual-backend", str(error)
else:
    raise AssertionError("Invalid executable accepted")
"""
            subprocess.run(["python3", "-c", py], cwd=ROOT, env=env, check=True)
            translated = gettext.translation(UUID, localedir=str(home / ".local/share/locale"), languages=["zz"])
            self.assertEqual(
                translated.gettext("Automatic paths checked. Your manual entries are unchanged."),
                "MANUAL VALUES PRESERVED",
            )

    def test_template_includes_all_settings_metadata_and_safety_messages(self):
        spec = importlib.util.spec_from_file_location("update_translations", ROOT / "scripts/update-translations.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        template = module.POT.read_text()
        settings = json.loads((ROOT / "settings-schema.json").read_text())
        for message in module.settings_messages(settings):
            self.assertIn("msgid " + json.dumps(message, ensure_ascii=False), template)
        for message in ["I confirm using one reset credit.", "Retry the unresolved reset?", "ChatGPT Usage Monitor"]:
            self.assertIn("msgid " + json.dumps(message), template)
        self.assertNotIn("AUTH_REQUIRED:", template)
