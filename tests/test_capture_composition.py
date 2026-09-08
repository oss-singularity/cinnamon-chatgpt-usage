"""Public documentation must retain the full panel anchor and modal spacing."""

import importlib.util
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location("capture", Path(__file__).resolve().parent / "ui/capture.py")
capture = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(capture)


class CaptureCompositionTests(unittest.TestCase):
    def test_dialog_spacing_and_complete_anchor(self):
        actor = [1359, 625, 473, 407]
        panel = [1880, 0, 40, 1080, 1880, 992, 40, 88]
        crop = [1351, 617, 569, 463]
        capture.verify_composition(actor, panel, crop, [1920, 1080], "install-codex")
        with self.assertRaisesRegex(ValueError, "complete applet anchor"):
            capture.verify_composition(actor, panel, [1351, 617, 569, 423], [1920, 1080], "install-codex")
        with self.assertRaisesRegex(ValueError, "48 px"):
            capture.verify_composition([1399, 665, 473, 407], panel, crop, [1920, 1080], "install-codex")
        with self.assertRaisesRegex(ValueError, "right vertical"):
            capture.verify_composition(
                actor, [0, 0, 1920, 40, 1826, 0, 94, 40], [0, 0, 1920, 1080], [1920, 1080], "reset"
            )
