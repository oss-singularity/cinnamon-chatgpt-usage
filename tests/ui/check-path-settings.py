"""Exercise the native GTK path widget only on an isolated display."""

import os
import sys
import tempfile
from pathlib import Path

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
from gi.repository import Gdk, GLib  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from path_settings import InstallationPaths  # noqa: E402


class Settings:
    def __init__(self):
        self.values = {"codex-path": "/manual/codex", "chatgpt-app-path": ""}
        self.writes = []

    def get_property(self, _key, _property):
        return "Path fixture"

    def bind(self, key, entry, _property, _flags):
        entry.set_text(self.values[key])
        entry.connect("changed", self.changed, key)

    def changed(self, entry, key):
        self.values[key] = entry.get_text()
        self.writes.append(key)


def settle(widget):
    deadline = GLib.get_monotonic_time() + 7000000
    context = GLib.MainContext.default()
    while widget._process is not None and GLib.get_monotonic_time() < deadline:
        context.iteration(True)
    assert widget._process is None, "Path check did not finish"


with tempfile.TemporaryDirectory(prefix="settings-path-test-") as directory:
    root = Path(directory)
    commands = root / "bin"
    commands.mkdir()
    for name in ["codex", "chatgpt"]:
        executable = commands / name
        executable.write_text('#!/bin/sh\ntouch "$0.executed"\n')
        executable.chmod(0o700)
    os.environ["PATH"] = str(commands)
    os.environ["HOME"] = str(root)
    settings = Settings()
    widget = InstallationPaths({}, "fixture", settings)
    settle(widget)
    codex = widget.entries["codex-path"]
    app = widget.entries["chatgpt-app-path"]
    assert codex.get_placeholder_text() == str(commands / "codex")
    assert app.get_placeholder_text() == str(commands / "chatgpt")
    assert not settings.writes and codex.get_text() == "/manual/codex" and app.get_text() == ""
    event = Gdk.Event.new(Gdk.EventType.FOCUS_CHANGE)
    app.emit("focus-in-event", event)
    assert app.get_placeholder_text() is None
    app.emit("focus-out-event", event)
    assert app.get_placeholder_text() == str(commands / "chatgpt")
    app.set_text("/my/app")
    writes = len(settings.writes)
    (commands / "chatgpt").unlink()
    widget.recheck_button.emit("clicked")
    settle(widget)
    assert app.get_placeholder_text() == "No automatic path found"
    assert app.get_text() == "/my/app" and len(settings.writes) == writes
    assert not list(commands.glob("*.executed")), "Detection executed an app"
    app.set_text("")
    assert settings.values["chatgpt-app-path"] == "" and app.get_text() == ""
    widget.destroy()
print("GTK path settings: detected placeholders, focus, edits, Recheck, no execution and no implicit writes passed.")
