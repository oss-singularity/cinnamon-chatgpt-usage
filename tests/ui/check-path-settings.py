"""Exercise the native GTK path widget only on an isolated display."""

import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
from gi.repository import Gdk, GLib, Gtk  # noqa: E402

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


def drain():
    deadline = time.monotonic() + 0.12
    context = GLib.MainContext.default()
    while time.monotonic() < deadline:
        while context.pending():
            context.iteration(False)
        time.sleep(0.005)


def pointer(target, click=True):
    window = target.get_toplevel()
    left, top = target.translate_coordinates(window, 0, 0)
    _ok, x, y = window.get_window().get_origin()
    subprocess.run(
        [
            "/usr/bin/xdotool",
            "mousemove",
            str(x + left + target.get_allocated_width() // 2),
            str(y + top + target.get_allocated_height() // 2),
        ],
        check=True,
        timeout=5,
    )
    if click:
        subprocess.run(["/usr/bin/xdotool", "click", "1"], check=True, timeout=5)
    drain()


def native_focus_checks(widget, settings):
    if os.environ.get("USAGE_TEST_ISOLATED") != "1":
        raise RuntimeError("Run through check-path-settings.sh on its private display")
    window = Gtk.Window(title="Isolated installation paths regression")
    window.set_default_size(720, 400)
    box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12, margin=20)
    outside_label = Gtk.Label(label="Non-focusable text outside the custom settings widget")
    outside_button = Gtk.Button(label="Unrelated action")
    outside_entry = Gtk.Entry()
    toggle = Gtk.CheckButton(label="Unrelated setting")
    box.pack_start(outside_label, False, False, 0)
    box.pack_start(widget, False, False, 0)
    box.pack_start(outside_button, False, False, 0)
    box.pack_start(outside_entry, False, False, 0)
    box.pack_start(toggle, False, False, 0)
    window.add(box)
    window.show_all()
    drain()
    subprocess.run(
        ["/usr/bin/xdotool", "search", "--name", "^Isolated installation paths regression$", "windowfocus", "--sync"],
        check=True,
    )
    drain()
    activated = []
    outside_button.connect("clicked", lambda *_: activated.append(True))
    codex, app = widget.entries.values()
    codex.set_text("")
    app.set_text("")
    values = dict(settings.values)
    writes = len(settings.writes)
    for entry in [codex, app]:
        for target in [widget.content_widget.get_child_at(0, 0), widget.status, outside_label, outside_button, toggle]:
            pointer(entry)
            assert entry.has_focus() and entry.get_placeholder_text() is None
            pointer(target, click=False)
            assert entry.has_focus(), "Merely moving the pointer must preserve editing focus"
            pointer(target)
            assert not entry.has_focus(), "Clicking outside an entry must release its focus"
            assert entry.get_placeholder_text(), "Automatic hint must return after an outside click"
        pointer(entry)
        pointer(entry)
        assert entry.has_focus(), "Clicking within the entry must preserve focus"
    assert len(activated) == 2, "Outside button clicks must still activate their normal action"
    assert not toggle.get_active(), "Outside toggle must receive both clicks"
    pointer(codex)
    pointer(app)
    assert app.has_focus() and codex.get_placeholder_text(), "Switching fields must focus the new entry"
    pointer(outside_entry)
    assert outside_entry.has_focus(), "Other text fields must retain normal focus behavior"
    pointer(outside_label)
    assert outside_entry.has_focus(), "Do not change unrelated entries' focus policy"
    pointer(app)
    subprocess.run(["/usr/bin/xdotool", "key", "Tab"], check=True)
    drain()
    assert widget.recheck_button.has_focus() and app.get_placeholder_text(), "Keyboard navigation must remain intact"
    assert dict(settings.values) == values and len(settings.writes) == writes, "Focus changes must not save hints"
    app.set_text("/manual/ChatGPT with spaces")
    writes = len(settings.writes)
    pointer(app)
    pointer(widget.recheck_button)
    settle(widget)
    assert app.get_text() == "/manual/ChatGPT with spaces" and len(settings.writes) == writes
    old_gesture = widget._click_gesture
    box.remove(widget)
    assert widget._click_gesture is None and old_gesture.get_propagation_phase() == Gtk.PropagationPhase.NONE
    second = Gtk.Window()
    second.add(widget)
    second.show_all()
    assert widget._click_gesture is not old_gesture, "Reparenting must bind to the new window"
    new_gesture = widget._click_gesture
    widget.destroy()
    assert widget._click_gesture is None and new_gesture.get_propagation_phase() == Gtk.PropagationPhase.NONE
    window.destroy()
    second.destroy()
    drain()


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
    native_focus_checks(widget, settings)
print(
    "GTK path settings: real outside clicks, mouse movement, field switching, Tab, normal controls, manual values, Recheck and teardown passed."
)
