#!/usr/bin/env python3
"""Tests for the stable ChatGPT usage snapshot."""

from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from chatgpt_usage import build_usage_history, normalise_rate_limits, update_usage_history


class NormaliseRateLimitsTests(unittest.TestCase):
    def test_canonical_bucket_ignores_model_specific_limits(self) -> None:
        result = {
            "rateLimits": {
                "limitId": "codex",
                "primary": {
                    "usedPercent": 13,
                    "windowDurationMins": 10080,
                    "resetsAt": 1788452781,
                },
            },
            "rateLimitsByLimitId": {
                "codex": {
                    "limitId": "codex",
                    "limitName": None,
                    "primary": {
                        "usedPercent": 13,
                        "windowDurationMins": 10080,
                        "resetsAt": 1788452781,
                    },
                    "secondary": None,
                    "credits": {
                        "hasCredits": False,
                        "unlimited": False,
                        "balance": "0",
                    },
                    "planType": "prolite",
                },
                "codex_model": {
                    "limitId": "codex_model",
                    "limitName": "Model limit",
                    "primary": {
                        "usedPercent": 0,
                        "windowDurationMins": 300,
                        "resetsAt": 1787884921,
                    },
                    "secondary": {
                        "usedPercent": 4.5,
                        "windowDurationMins": 10080,
                        "resetsAt": 1788471721,
                    },
                },
            },
            "rateLimitResetCredits": {"availableCount": 2, "credits": []},
        }

        snapshot = normalise_rate_limits(result, now=123)
        self.assertEqual(snapshot["updatedAt"], 123)
        self.assertEqual([item["id"] for item in snapshot["limits"]], ["codex"])
        self.assertEqual(snapshot["limits"][0]["label"], "Codex")
        self.assertEqual(snapshot["limits"][0]["windows"][0]["remainingPercent"], 87)
        self.assertEqual(snapshot["credits"]["balance"], "0")
        self.assertEqual(snapshot["credits"]["availableResetCount"], 2)

    def test_legacy_single_bucket_and_missing_five_hour_window(self) -> None:
        result = {
            "rateLimits": {
                "limitId": "codex",
                "primary": {
                    "usedPercent": 39,
                    "windowDurationMins": 10080,
                    "resetsAt": 1788452781,
                },
                "secondary": None,
            },
            "rateLimitResetCredits": None,
        }

        snapshot = normalise_rate_limits(result, now=456)
        self.assertEqual(len(snapshot["limits"]), 1)
        self.assertEqual(len(snapshot["limits"][0]["windows"]), 1)
        self.assertEqual(snapshot["limits"][0]["windows"][0]["remainingPercent"], 61)
        self.assertEqual(snapshot["credits"]["availableResetCount"], 0)

    def test_optional_five_hour_window_when_canonical_api_exposes_it(self) -> None:
        result = {
            "rateLimits": {
                "limitId": "codex",
                "primary": {
                    "usedPercent": 20,
                    "windowDurationMins": 300,
                    "resetsAt": 1787884921,
                },
                "secondary": {
                    "usedPercent": 40,
                    "windowDurationMins": 10080,
                    "resetsAt": 1788471721,
                },
            }
        }

        snapshot = normalise_rate_limits(result, now=789)
        windows = snapshot["limits"][0]["windows"]
        self.assertEqual([window["durationMinutes"] for window in windows], [300, 10080])
        self.assertEqual([window["remainingPercent"] for window in windows], [80, 60])


class UsageHistoryTests(unittest.TestCase):
    @staticmethod
    def snapshot(now: int, used: float = 20, resets_at: int = 9999) -> dict:
        return {
            "updatedAt": now,
            "limits": [
                {
                    "id": "codex",
                    "label": "Codex",
                    "windows": [
                        {
                            "durationMinutes": 10080,
                            "usedPercent": used,
                            "remainingPercent": 100 - used,
                            "resetsAt": resets_at,
                        }
                    ],
                }
            ],
            "credits": {"balance": "0"},
        }

    @staticmethod
    def sample(timestamp: int, used: float, resets_at: int = 9999) -> dict:
        return {
            "timestamp": timestamp,
            "windows": {"codex:10080": {"usedPercent": used, "resetsAt": resets_at}},
        }

    def test_periods_sum_only_positive_observed_consumption(self) -> None:
        now = 1_800_000_000
        samples = [
            self.sample(now - 3700, 10),
            self.sample(now - 3500, 11),
            self.sample(now - 1800, 13),
            self.sample(now, 18),
        ]

        history = build_usage_history(self.snapshot(now, 18), samples)
        periods = history["windows"][0]["periods"]
        self.assertEqual(periods["1h"]["consumedPercent"], 8)
        self.assertTrue(periods["1h"]["complete"])
        self.assertEqual(periods["4h"]["consumedPercent"], 8)
        self.assertFalse(periods["4h"]["complete"])

    def test_reset_counts_only_usage_in_the_new_window(self) -> None:
        now = 1_800_000_000
        samples = [
            self.sample(now - 3700, 90, 100),
            self.sample(now - 1800, 2, 200),
            self.sample(now, 5, 200),
        ]

        periods = build_usage_history(self.snapshot(now, 5, 200), samples)["windows"][0]["periods"]
        self.assertEqual(periods["1h"]["consumedPercent"], 5)

    def test_falling_rolling_value_is_ignored_before_new_consumption(self) -> None:
        now = 1_800_000_000
        samples = [
            self.sample(now - 3700, 10),
            self.sample(now - 3000, 15),
            self.sample(now - 2000, 12),
            self.sample(now, 14),
        ]

        periods = build_usage_history(self.snapshot(now, 14), samples)["windows"][0]["periods"]
        self.assertEqual(periods["1h"]["consumedPercent"], 7)

    def test_partial_history_is_marked_and_unknown_activity_is_null(self) -> None:
        now = 1_800_000_000
        samples = [self.sample(now - 1800, 10), self.sample(now, 15)]

        window = build_usage_history(self.snapshot(now, 15), samples)["windows"][0]
        self.assertFalse(window["periods"]["1h"]["complete"])
        self.assertEqual(window["periods"]["1h"]["consumedPercent"], 5)
        self.assertIsNone(window["activity24h"][0])
        self.assertEqual(window["trackedSince"], now - 1800)

    def test_history_file_contains_only_minimal_samples_and_is_private(self) -> None:
        now = 1_800_000_000
        snapshot = self.snapshot(now, 15)
        with TemporaryDirectory() as directory:
            path = Path(directory) / "history.json"
            update_usage_history(snapshot, path)
            text = path.read_text(encoding="utf-8")

            self.assertIn('"codex:10080"', text)
            self.assertNotIn("credits", text)
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            self.assertIn("history", snapshot)

    def test_history_is_built_for_every_active_window(self) -> None:
        now = 1_800_000_000
        snapshot = self.snapshot(now, 15)
        snapshot["limits"][0]["windows"].insert(
            0,
            {
                "durationMinutes": 300,
                "usedPercent": 4,
                "remainingPercent": 96,
                "resetsAt": 8888,
            },
        )
        samples = [
            {
                "timestamp": now,
                "windows": {
                    "codex:300": {"usedPercent": 4, "resetsAt": 8888},
                    "codex:10080": {"usedPercent": 15, "resetsAt": 9999},
                },
            }
        ]

        history = build_usage_history(snapshot, samples)
        self.assertEqual(
            [window["durationMinutes"] for window in history["windows"]],
            [300, 10080],
        )


if __name__ == "__main__":
    unittest.main()
