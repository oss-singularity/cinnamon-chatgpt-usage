"""Supported discovery layouts and path normalization without installed apps."""

import os
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from chatgpt_usage import UsageError, resolve_codex


class DiscoveryTests(unittest.TestCase):
    def test_cli_app_symlink_chain_explicit_home_and_precedence(self):
        with TemporaryDirectory(prefix="usage discovery ") as directory:
            root = Path(directory)
            commands = root / "bin"
            commands.mkdir()
            app = root / "app" / "bin"
            app.mkdir(parents=True)
            resources = root / "app" / "resources"
            resources.mkdir()
            backend = resources / "codex"
            backend.write_text("#!/bin/sh\nexit 0\n")
            backend.chmod(0o700)
            launcher = app / "chatgpt"
            launcher.write_text("#!/bin/sh\nexit 0\n")
            launcher.chmod(0o700)
            (commands / "link").symlink_to(launcher)
            (commands / "chatgpt").symlink_to("link")
            with patch.dict(os.environ, {"PATH": str(commands), "HOME": str(root)}):
                self.assertEqual(resolve_codex(None), str(backend))
                self.assertEqual(resolve_codex("~/app/resources/codex"), str(backend))
                with self.assertRaises(UsageError):
                    resolve_codex("~/missing")
                (commands / "codex").symlink_to(backend)
                self.assertEqual(resolve_codex(None), str(commands / "codex"))
                (commands / "chatgpt").unlink()
                self.assertEqual(resolve_codex(None), str(commands / "codex"))
                (commands / "codex").unlink()
                with self.assertRaises(UsageError):
                    resolve_codex(None)
