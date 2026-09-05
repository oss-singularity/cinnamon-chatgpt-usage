"""Invalid input and rolling time boundaries, independent of chart alignment."""

import datetime as dt
import os
import time
import unittest
from unittest.mock import patch

from chatgpt_usage import _normalise_window, build_usage_history, normalise_rate_limits


class RobustnessTests(unittest.TestCase):
    def test_invalid_usage_never_becomes_full_availability(self):
        for used in [None, float("nan"), float("inf"), -1, 101, True, "bad"]:
            for field in ["rateLimits", "rateLimitsByLimitId"]:
                with self.subTest(used=used, field=field):
                    bucket = {"primary": {"windowDurationMins": 300, "usedPercent": used}}
                    result = {field: {"codex": bucket} if field.endswith("Id") else bucket}
                    self.assertEqual(normalise_rate_limits(result)["limits"], [])
        self.assertIsNone(_normalise_window({"windowDurationMins": 300}))

    def test_nonfinite_times_are_unavailable(self):
        for bad in [float("inf"), float("-inf"), float("nan"), True]:
            self.assertIsNone(_normalise_window({"windowDurationMins": bad, "usedPercent": 5}))
            window = _normalise_window({"windowDurationMins": 300, "usedPercent": 5, "resetsAt": bad})
            self.assertIsNone(window["resetsAt"])

    def test_rolling_day_is_independent_of_buckets_midnight_and_dst(self):
        original = os.environ.get("TZ")
        self.addCleanup(self.restore_timezone, original)
        for zone in ["UTC", "Europe/Berlin"]:
            with patch.dict(os.environ, {"TZ": zone}):
                time.tzset()
                for date in [
                    "2026-09-05T12:30:00+00:00",
                    "2026-03-29T01:30:00+00:00",
                    "2026-10-25T01:30:00+00:00",
                    "2026-09-05T22:30:00+00:00",
                ]:
                    now = int(dt.datetime.fromisoformat(date).timestamp())
                    samples = [
                        {"timestamp": timestamp, "windows": {"codex:300": {"usedPercent": used}}}
                        for timestamp, used in [(now - 90000, 0), (now - 85500, 10), (now, 10)]
                    ]
                    snapshot = {"updatedAt": now, "limits": [{"id": "codex", "windows": [{"durationMinutes": 300}]}]}
                    for minutes in [60, 120]:
                        history = build_usage_history(snapshot, samples, minutes)
                        self.assertEqual(
                            history["windows"][0]["periods"]["24h"], {"consumedPercent": 10, "complete": True}
                        )
                        incomplete = build_usage_history(snapshot, samples[1:], minutes)
                        self.assertFalse(incomplete["windows"][0]["periods"]["24h"]["complete"])

    @staticmethod
    def restore_timezone(value):
        if value is None:
            os.environ.pop("TZ", None)
        else:
            os.environ["TZ"] = value
        time.tzset()
