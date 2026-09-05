"""Real pipes and private executables; never invoke an installed backend."""

import json
import os
import signal
import subprocess
import sys
import time
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from chatgpt_usage import AuthenticationRequired, UsageError, _command_version, fetch_rate_limits


class TransportTests(unittest.TestCase):
    def setUp(self):
        self.directory = TemporaryDirectory(prefix="usage-pipe-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.backend = self.root / "backend with spaces"
        self.pidfile = self.root / "pid"

    def fixture(self, body, read=True):
        self.backend.write_text(
            f"#!{sys.executable}\nimport os, sys, time, signal\n"
            f"open({str(self.pidfile)!r}, 'w').write(str(os.getpid()))\n"
            + ("for _ in range(3): sys.stdin.readline()\n" if read else "")
            + body,
            encoding="utf-8",
        )
        self.backend.chmod(0o700)

    def assert_reaped(self):
        pid = int(self.pidfile.read_text())
        with self.assertRaises(ProcessLookupError):
            os.kill(pid, 0)

    def test_coalesced_lines_notifications_and_malformed_messages(self):
        wire = 'not json\n[]\n{"method":"notice"}\n{"id":1,"result":{}}\n{"id":2,"result":{"fixture":true}}\n'
        self.fixture(f"os.write(1, {wire.encode()!r})\ntime.sleep(10)\n")
        self.assertEqual(fetch_rate_limits(str(self.backend), 0.5), {"fixture": True})
        self.assert_reaped()

    def test_split_utf8_and_json(self):
        wire = json.dumps({"id": 2, "result": {"label": "Grüße"}}, ensure_ascii=False).encode() + b"\n"
        self.fixture(f"for byte in {wire!r}:\n os.write(1, bytes([byte]))\n time.sleep(0.001)\ntime.sleep(10)\n")
        self.assertEqual(fetch_rate_limits(str(self.backend), 1), {"label": "Grüße"})
        self.assert_reaped()

    def test_partial_line_obeys_deadline_even_when_sigterm_ignored(self):
        self.fixture("signal.signal(signal.SIGTERM, signal.SIG_IGN)\nos.write(1, b'{\"id\":2')\ntime.sleep(10)\n")
        start = time.monotonic()
        with self.assertRaisesRegex(UsageError, "Timed out"):
            fetch_rate_limits(str(self.backend), 0.2)
        self.assertLess(time.monotonic() - start, 0.8)
        self.assert_reaped()

    def test_early_eof_and_initialization_failure(self):
        for body, error in [
            ("sys.exit(0)\n", UsageError),
            (
                'os.write(1, b\'{"id":1,"error":{"message":"Not logged in"}}\\n\')\ntime.sleep(10)\n',
                AuthenticationRequired,
            ),
        ]:
            self.fixture(body)
            with self.assertRaises(error):
                fetch_rate_limits(str(self.backend), 0.5)
            self.assert_reaped()

    def test_broken_input_is_cleaned_up(self):
        self.fixture("os.close(0)\ntime.sleep(0.02)\nsys.exit(0)\n", read=False)
        with self.assertRaises((OSError, UsageError)):
            fetch_rate_limits(str(self.backend), 0.5)
        self.assert_reaped()

    def test_version_probes_bound_time_output_and_nonzero_exit(self):
        for body, expected in [
            ("print('fixture 1.0')", "fixture 1.0"),
            ("print('not a version'); sys.exit(1)", None),
            ("time.sleep(10)", None),
            ("os.write(1, b'x' * 20000); time.sleep(10)", None),
        ]:
            self.fixture(body, read=False)
            start = time.monotonic()
            self.assertEqual(_command_version(str(self.backend), 0.2), expected)
            self.assertLess(time.monotonic() - start, 0.6)
            self.assert_reaped()
        self.assertIsNone(_command_version(str(self.root / "absent")))

    def test_helper_sigterm_reaps_backend(self):
        self.fixture("time.sleep(10)\n")
        helper = subprocess.Popen(
            [
                sys.executable,
                "chatgpt_usage.py",
                "--no-history",
                "--codex",
                str(self.backend),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        self.addCleanup(lambda: helper.kill() if helper.poll() is None else None)
        deadline = time.monotonic() + 2
        while not self.pidfile.exists() and time.monotonic() < deadline:
            time.sleep(0.01)
        self.assertTrue(self.pidfile.exists())
        helper.send_signal(signal.SIGTERM)
        helper.wait(timeout=2)
        self.assert_reaped()
