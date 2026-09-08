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

    def test_custom_app_hint_preserves_cli_priority_and_never_uses_another_app(self):
        with TemporaryDirectory(prefix="custom ChatGPT ") as directory:
            root = Path(directory)
            commands = root / "bin"
            commands.mkdir()
            app = root / "Custom App"
            app.mkdir()
            launcher = app / "chatgpt"
            backend = app / "resources" / "codex"
            backend.parent.mkdir()
            for path in (launcher, backend):
                path.write_text("#!/bin/sh\nexit 0\n")
                path.chmod(0o700)
            link = root / "app link"
            link.symlink_to(launcher)
            with patch.dict(os.environ, {"PATH": str(commands), "HOME": str(root)}):
                self.assertEqual(resolve_codex(None, str(link)), str(backend))
                self.assertEqual(resolve_codex(None, "~/Custom App/chatgpt"), str(backend))
                cli = commands / "codex"
                cli.write_text("#!/bin/sh\nexit 0\n")
                cli.chmod(0o700)
                self.assertEqual(resolve_codex(None, str(link)), str(cli))
                self.assertEqual(resolve_codex(str(backend), str(link)), str(backend))
                self.assertEqual(resolve_codex(None, str(root / "missing")), str(cli))
                cli.unlink()
                local_cli = root / ".local" / "bin" / "codex"
                local_cli.parent.mkdir(parents=True)
                local_cli.symlink_to(backend)
                self.assertEqual(resolve_codex(None, str(link)), str(local_cli))
                local_cli.unlink()
                (commands / "chatgpt").symlink_to(launcher)
                for invalid in (str(root / "missing"), str(app), "Custom App/chatgpt"):
                    with self.subTest(invalid=invalid), self.assertRaises(UsageError):
                        resolve_codex(None, invalid)
                backend.unlink()
                with self.assertRaises(UsageError):
                    resolve_codex(None, str(launcher))

    def test_custom_app_is_forwarded_by_describe_and_usage_entrypoints(self):
        import chatgpt_usage

        arguments = ["helper", "--codex", "/explicit/codex", "--chatgpt-app", "/Custom App/chatgpt", "--no-history"]
        with (
            patch("sys.argv", arguments),
            patch("builtins.print"),
            patch.object(chatgpt_usage, "resolve_codex", return_value="/selected/backend") as resolve,
            patch.object(chatgpt_usage, "fetch_rate_limits", return_value={}) as fetch,
        ):
            self.assertEqual(chatgpt_usage.main(), 0)
            resolve.assert_called_once_with("/explicit/codex", "/Custom App/chatgpt")
            fetch.assert_called_once_with("/selected/backend", 25)
        with (
            patch("sys.argv", arguments + ["--describe-backend"]),
            patch("builtins.print"),
            patch.object(chatgpt_usage, "describe_backend", return_value={}) as describe,
        ):
            self.assertEqual(chatgpt_usage.main(), 0)
            describe.assert_called_once_with("/explicit/codex", "/Custom App/chatgpt")

    def test_automatic_path_placeholders_do_not_execute_programs(self):
        import chatgpt_usage

        with (
            patch.object(chatgpt_usage, "resolve_codex", return_value="/auto/codex") as codex,
            patch.object(chatgpt_usage, "_resolve_chatgpt_launcher", return_value="/auto/chatgpt"),
            patch.object(chatgpt_usage, "_command_version") as version,
        ):
            self.assertEqual(
                chatgpt_usage.detect_automatic_paths(), {"codex": "/auto/codex", "chatgpt": "/auto/chatgpt"}
            )
            codex.assert_called_once_with(None)
            version.assert_not_called()
