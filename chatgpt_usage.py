#!/usr/bin/env python3
"""Read ChatGPT Work and Codex limits through the local Codex app-server."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import select
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any


CLIENT_INFO = {
    "name": "cinnamon_chatgpt_usage",
    "title": "Cinnamon ChatGPT Usage",
    "version": "0.2.0",
}

HISTORY_VERSION = 1
HISTORY_RETENTION_SECONDS = 8 * 24 * 60 * 60
ACTIVITY_BUCKET_SECONDS = 2 * 60 * 60
ACTIVITY_BUCKET_COUNT = 12
RESET_TIMESTAMP_JITTER_SECONDS = 60


class UsageError(RuntimeError):
    """A user-facing usage retrieval error."""


def _number(value: Any, default: float = 0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _normalise_window(window: Any) -> dict[str, Any] | None:
    if not isinstance(window, dict):
        return None
    duration = int(_number(window.get("windowDurationMins")))
    if duration <= 0:
        return None
    used = min(100.0, max(0.0, _number(window.get("usedPercent"))))
    resets_at = int(_number(window.get("resetsAt"))) or None
    return {
        "durationMinutes": duration,
        "usedPercent": used,
        "remainingPercent": 100.0 - used,
        "resetsAt": resets_at,
    }


def normalise_rate_limits(result: dict[str, Any], now: int | None = None) -> dict[str, Any]:
    """Convert the canonical Analytics-card limits into an applet snapshot."""

    single = result.get("rateLimits")
    buckets_by_id = result.get("rateLimitsByLimitId")
    if not isinstance(single, dict):
        if isinstance(buckets_by_id, dict):
            single = buckets_by_id.get("codex")
            if not isinstance(single, dict):
                single = next(
                    (bucket for bucket in buckets_by_id.values() if isinstance(bucket, dict)),
                    None,
                )

    buckets = {single.get("limitId", "codex"): single} if isinstance(single, dict) else {}

    limits = []
    credit_details = single.get("credits") if isinstance(single, dict) else None
    if not isinstance(credit_details, dict) and isinstance(buckets_by_id, dict):
        codex_bucket = buckets_by_id.get("codex")
        if isinstance(codex_bucket, dict) and isinstance(codex_bucket.get("credits"), dict):
            credit_details = codex_bucket["credits"]
    for bucket_id, bucket in buckets.items():
        if not isinstance(bucket, dict):
            continue
        windows = []
        for field in ("primary", "secondary"):
            normalised = _normalise_window(bucket.get(field))
            if normalised:
                windows.append(normalised)
        if not windows:
            continue

        limit_id = str(bucket.get("limitId") or bucket_id)
        label = bucket.get("limitName") or ("Codex" if limit_id == "codex" else limit_id)
        limits.append(
            {
                "id": limit_id,
                "label": str(label),
                "planType": bucket.get("planType"),
                "rateLimitReachedType": bucket.get("rateLimitReachedType"),
                "windows": windows,
            }
        )

    limits.sort(key=lambda item: (item["id"] != "codex", item["label"].lower()))
    resets = result.get("rateLimitResetCredits")
    available_resets = 0
    if isinstance(resets, dict):
        available_resets = max(0, int(_number(resets.get("availableCount"))))

    credits = {
        "availableResetCount": available_resets,
        "balance": None,
        "hasCredits": False,
        "unlimited": False,
    }
    if isinstance(credit_details, dict):
        balance = credit_details.get("balance")
        credits.update(
            {
                "balance": None if balance is None else str(balance),
                "hasCredits": bool(credit_details.get("hasCredits")),
                "unlimited": bool(credit_details.get("unlimited")),
            }
        )

    return {
        "updatedAt": int(time.time()) if now is None else int(now),
        "limits": limits,
        "credits": credits,
    }


def default_history_path() -> Path:
    """Return the XDG state path for credential-free usage samples."""

    state_root = os.environ.get("XDG_STATE_HOME")
    if not state_root:
        state_root = os.path.expanduser("~/.local/state")
    return Path(state_root) / "cinnamon-chatgpt-usage" / "history.json"


def _history_window_key(limit_id: str, duration: int) -> str:
    return f"{limit_id}:{duration}"


def _sample_from_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
    windows: dict[str, dict[str, Any]] = {}
    for limit in snapshot.get("limits", []):
        limit_id = str(limit.get("id") or "codex")
        for window in limit.get("windows", []):
            duration = int(_number(window.get("durationMinutes")))
            used = _number(window.get("usedPercent"), -1)
            if duration <= 0 or used < 0:
                continue
            windows[_history_window_key(limit_id, duration)] = {
                "usedPercent": min(100.0, max(0.0, used)),
                "resetsAt": int(_number(window.get("resetsAt"))) or None,
            }
    return {"timestamp": int(snapshot["updatedAt"]), "windows": windows}


def _load_history(path: Path) -> list[dict[str, Any]]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return []
    except (OSError, json.JSONDecodeError):
        return []
    if not isinstance(payload, dict) or payload.get("version") != HISTORY_VERSION:
        return []
    samples = payload.get("samples")
    if not isinstance(samples, list):
        return []
    return [
        sample
        for sample in samples
        if isinstance(sample, dict) and _number(sample.get("timestamp")) > 0 and isinstance(sample.get("windows"), dict)
    ]


def _write_history(path: Path, samples: list[dict[str, Any]]) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=".history-", suffix=".json", dir=path.parent)
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            json.dump(
                {"version": HISTORY_VERSION, "samples": samples},
                stream,
                separators=(",", ":"),
            )
            stream.write("\n")
        os.replace(temporary_name, path)
    except BaseException:
        try:
            os.close(descriptor)
        except OSError:
            pass
        try:
            os.unlink(temporary_name)
        except OSError:
            pass
        raise


def _window_points(samples: list[dict[str, Any]], key: str, end_at: int) -> list[tuple[int, dict[str, Any]]]:
    points = []
    for sample in samples:
        timestamp = int(_number(sample.get("timestamp")))
        window = sample.get("windows", {}).get(key)
        if timestamp <= 0 or timestamp > end_at or not isinstance(window, dict):
            continue
        points.append((timestamp, window))
    return sorted(points, key=lambda point: point[0])


def _positive_delta(previous: dict[str, Any], current: dict[str, Any]) -> float:
    previous_reset = previous.get("resetsAt")
    current_reset = current.get("resetsAt")
    current_used = _number(current.get("usedPercent"))
    reset_shift = abs(_number(current_reset) - _number(previous_reset))
    if previous_reset and current_reset and reset_shift > RESET_TIMESTAMP_JITTER_SECONDS:
        return max(0.0, current_used)
    return max(0.0, current_used - _number(previous.get("usedPercent")))


def _observed_consumption(points: list[tuple[int, dict[str, Any]]], start_at: int, end_at: int) -> tuple[float, bool]:
    baseline = None
    after_start = []
    for point in points:
        if point[0] <= start_at:
            baseline = point
        elif point[0] <= end_at:
            after_start.append(point)
    selected = ([baseline] if baseline else []) + after_start
    consumed = sum(_positive_delta(previous[1], current[1]) for previous, current in zip(selected, selected[1:]))
    return consumed, baseline is not None


def build_usage_history(snapshot: dict[str, Any], samples: list[dict[str, Any]]) -> dict[str, Any]:
    """Build observed consumption periods and a 24-hour activity timeline."""

    now = int(snapshot["updatedAt"])
    local_now = dt.datetime.fromtimestamp(now).astimezone()
    start_of_today = int(local_now.replace(hour=0, minute=0, second=0, microsecond=0).timestamp())
    periods = (
        ("1h", now - 60 * 60),
        ("4h", now - 4 * 60 * 60),
        ("12h", now - 12 * 60 * 60),
        ("today", start_of_today),
    )
    history_windows = []
    tracked_since = min((int(_number(sample.get("timestamp"))) for sample in samples), default=now)

    for limit in snapshot.get("limits", []):
        limit_id = str(limit.get("id") or "codex")
        for window in limit.get("windows", []):
            duration = int(_number(window.get("durationMinutes")))
            if duration <= 0:
                continue
            key = _history_window_key(limit_id, duration)
            points = _window_points(samples, key, now)
            period_values = {}
            for period_key, start_at in periods:
                consumed, complete = _observed_consumption(points, start_at, now)
                period_values[period_key] = {
                    "consumedPercent": round(consumed, 2),
                    "complete": complete,
                }

            activity = []
            activity_start = now - ACTIVITY_BUCKET_COUNT * ACTIVITY_BUCKET_SECONDS
            for index in range(ACTIVITY_BUCKET_COUNT):
                bucket_start = activity_start + index * ACTIVITY_BUCKET_SECONDS
                bucket_end = bucket_start + ACTIVITY_BUCKET_SECONDS
                consumed, complete = _observed_consumption(points, bucket_start, bucket_end)
                activity.append(
                    {
                        "consumedPercent": round(consumed, 2),
                        "complete": complete,
                    }
                )

            history_windows.append(
                {
                    "id": limit_id,
                    "durationMinutes": duration,
                    "trackedSince": points[0][0] if points else now,
                    "periods": period_values,
                    "activity24h": activity,
                }
            )

    return {
        "trackedSince": tracked_since,
        "activityBucketMinutes": ACTIVITY_BUCKET_SECONDS // 60,
        "windows": history_windows,
    }


def update_usage_history(snapshot: dict[str, Any], path: Path) -> dict[str, Any]:
    """Append one sample atomically and attach derived history to the snapshot."""

    now = int(snapshot["updatedAt"])
    cutoff = now - HISTORY_RETENTION_SECONDS
    samples = [sample for sample in _load_history(path) if int(_number(sample.get("timestamp"))) >= cutoff]
    current = _sample_from_snapshot(snapshot)
    if current["windows"]:
        if samples and int(_number(samples[-1].get("timestamp"))) == now:
            samples[-1] = current
        else:
            samples.append(current)
    samples = sorted(samples, key=lambda sample: int(_number(sample.get("timestamp"))))
    samples = samples[-10000:]
    _write_history(path, samples)
    snapshot["history"] = build_usage_history(snapshot, samples)
    return snapshot


def resolve_codex(explicit: str | None) -> str:
    """Resolve an executable Codex CLI without inspecting credential storage."""

    if explicit:
        candidate = os.path.abspath(os.path.expanduser(explicit))
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
        raise UsageError(f"Codex CLI is not executable: {candidate}")

    candidate = shutil.which("codex")
    if candidate:
        return candidate
    local_candidate = os.path.expanduser("~/.local/bin/codex")
    if os.path.isfile(local_candidate) and os.access(local_candidate, os.X_OK):
        return local_candidate
    raise UsageError("Codex CLI was not found")


def fetch_rate_limits(codex: str, timeout: float) -> dict[str, Any]:
    """Perform one initialized, read-only app-server request."""

    process = subprocess.Popen(
        [codex, "app-server", "--listen", "stdio://"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        encoding="utf-8",
        bufsize=1,
    )
    if process.stdin is None or process.stdout is None:
        process.kill()
        raise UsageError("Could not open Codex app-server pipes")

    messages = (
        {"method": "initialize", "id": 1, "params": {"clientInfo": CLIENT_INFO}},
        {"method": "initialized", "params": {}},
        {"method": "account/rateLimits/read", "id": 2},
    )
    for message in messages:
        process.stdin.write(json.dumps(message, separators=(",", ":")) + "\n")
    process.stdin.flush()

    deadline = time.monotonic() + timeout
    try:
        while time.monotonic() < deadline:
            remaining = max(0.0, deadline - time.monotonic())
            readable, _, _ = select.select([process.stdout], [], [], remaining)
            if not readable:
                break
            line = process.stdout.readline()
            if not line:
                break
            try:
                message = json.loads(line)
            except json.JSONDecodeError:
                continue
            if message.get("id") != 2:
                continue
            if "error" in message:
                error = message["error"]
                detail = error.get("message") if isinstance(error, dict) else error
                raise UsageError(f"Codex app-server rejected the request: {detail}")
            result = message.get("result")
            if not isinstance(result, dict):
                raise UsageError("Codex app-server returned no usage data")
            return result
        raise UsageError("Timed out while reading ChatGPT usage limits")
    finally:
        try:
            process.stdin.close()
        except (BrokenPipeError, OSError):
            pass
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=2)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--codex", help="Path to the Codex CLI")
    parser.add_argument("--timeout", type=float, default=25, help="Request timeout in seconds")
    parser.add_argument("--history-file", type=Path, help="Override the local history path")
    parser.add_argument("--no-history", action="store_true", help="Do not read or write history")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        codex = resolve_codex(args.codex)
        result = fetch_rate_limits(codex, max(1.0, args.timeout))
        snapshot = normalise_rate_limits(result)
        if not args.no_history:
            try:
                update_usage_history(snapshot, args.history_file or default_history_path())
            except OSError as error:
                snapshot["history"] = {"error": f"Could not store local history: {error}"}
        print(json.dumps(snapshot, separators=(",", ":")))
        return 0
    except (OSError, UsageError) as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
