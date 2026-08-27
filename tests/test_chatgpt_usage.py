#!/usr/bin/env python3
"""Tests for the stable ChatGPT usage snapshot."""

from __future__ import annotations

import unittest

from chatgpt_usage import normalise_rate_limits


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


if __name__ == "__main__":
    unittest.main()
