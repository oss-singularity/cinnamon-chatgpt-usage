#!/usr/bin/env python3
"""Read ChatGPT Work and Codex limits through the local Codex app-server."""

from __future__ import annotations

import argparse
import json
import os
import select
import shutil
import subprocess
import sys
import time
from typing import Any


CLIENT_INFO = {
    "name": "cinnamon_chatgpt_usage",
    "title": "Cinnamon ChatGPT Usage",
    "version": "0.1.0",
}


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
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        codex = resolve_codex(args.codex)
        result = fetch_rate_limits(codex, max(1.0, args.timeout))
        print(json.dumps(normalise_rate_limits(result), separators=(",", ":")))
        return 0
    except (OSError, UsageError) as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
