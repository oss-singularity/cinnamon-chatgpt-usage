/* global imports */

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;
const formatModule = { exports: {} };
new Function("module", "exports", ByteArray.toString(GLib.file_get_contents("usage-format.js")[1]))(
    formatModule, formatModule.exports
);
const [ok, contents] = GLib.file_get_contents("applet.js");
if (!ok) throw new Error("Cannot read applet.js");
function assert(value, message) { if (!value) throw new Error(message); }
let desktopLookups = 0;
let desktopLaunches = 0;
const desktop = { launch() { desktopLaunches++; } };
const processes = [];
const AppletClass = new Function("imports", "require", "global",
    `${ByteArray.toString(contents)}\nreturn ChatGptUsageApplet;`
)(
    { gettext: imports.gettext, format: imports.format, ui: { applet: { Applet: class {}, AppletPopupMenu: class {} } }, misc: {}, gi: { GLib, Gio: {
        DesktopAppInfo: { new(id) { assert(id === "chatgpt.desktop", "Preserve desktop ID"); desktopLookups++; return desktop; } },
        SubprocessFlags: Gio.SubprocessFlags,
        Subprocess: { new(argv, flags) {
            const process = Gio.Subprocess.new(argv, flags);
            processes.push({ argv, process });
            return process;
        } }
    } } }, () => formatModule.exports, { logError() {}, logWarning() {} }
);
const applet = Object.create(AppletClass.prototype);
applet._setDefaults();
applet._rebuildMenu = () => {};
assert(applet.chatGptAppPath === "", "Default keeps automatic launcher");
applet._launchChatGptApp(applet._chatGptAppInfo());
assert(desktopLaunches === 1 && desktopLookups === 1 && processes.length === 0, "Empty path uses desktop launcher");
const folder = GLib.dir_make_tmp("chatgpt-launch-test-XXXXXX");
const executable = `${folder}/ChatGPT space ' " $(bad) ; %U.AppImage`;
const countFile = `${executable}.count`;
try {
    GLib.file_set_contents(executable, '#!/bin/sh\nprintf "%s" "$#" > "$0.count"\n');
    Gio.File.new_for_path(executable).set_attribute_uint32("unix::mode", 0o700, Gio.FileQueryInfoFlags.NONE, null);
    applet.chatGptAppPath = executable;
    applet.codexPath = "/unchanged/backend";
    applet._backendInfo = { chatgptVersion: "unrelated", chatgptModifiedAt: 1 };
    assert(applet._chatGptAppInfo() === null && desktopLookups === 1, "Override bypasses desktop lookup");
    assert(applet._chatGptAppVersion(desktop) === null, "Do not label custom app with another installation's metadata");
    applet._launchChatGptApp(null);
    assert(processes.length === 1 && processes[0].argv.length === 1 && processes[0].argv[0] === executable, "Literal path stays a single argv element");
    assert(processes[0].process.wait_check(null), "Configured executable actually starts");
    assert(ByteArray.toString(GLib.file_get_contents(countFile)[1]) === "0", "No shell or desktop placeholder expansion");
    assert(applet.codexPath === "/unchanged/backend", "Launch override leaves backend setting unchanged");
    for (const invalid of [folder, `${folder}/missing`, "relative/ChatGPT", `${executable} --argument`]) {
        applet.chatGptAppPath = invalid;
        applet._launchChatGptApp(desktop);
        assert(applet._lastError.includes("Check the ChatGPT app path"), "Invalid override explains settings correction");
        assert(processes.length === 1 && desktopLaunches === 1, "Invalid override must not fall back");
    }
    Gio.File.new_for_path(executable).set_attribute_uint32("unix::mode", 0o600, Gio.FileQueryInfoFlags.NONE, null);
    applet.chatGptAppPath = executable;
    assert(applet._resolveChatGptAppPath() === null, "Non-executable file is unavailable");
    applet.chatGptAppPath = "~/Applications/ChatGPT AppImage";
    assert(applet._configuredChatGptAppPath() === `${GLib.get_home_dir()}/Applications/ChatGPT AppImage`, "Home shorthand expands");
    applet.chatGptAppPath = "   ";
    applet._launchChatGptApp(applet._chatGptAppInfo());
    assert(desktopLaunches === 2, "Clearing the override restores the desktop launcher");
} finally {
    for (const path of [countFile, executable, folder]) {
        const file = Gio.File.new_for_path(path);
        if (file.query_exists(null)) file.delete(null);
    }
}
applet._backendInfo = { chatgptModifiedAt: 1788250825 };
for (const version of ["26.831.20005", "26.825.51511", "new-version", null]) {
    applet._chatGptAppVersion = () => version;
    const tooltip = applet._chatGptAppTooltip(desktop);
    assert(tooltip === `chatgpt ${version || "version unavailable"}`, "Tooltip preserves version without inferred date or separator");
    assert(!tooltip.includes(" — ") && !/\d{2}\.\d{2}\.\d{4}/.test(tooltip), "No build/install date in ChatGPT hover text");
}
assert(applet._chatGptAppTooltip(null) === "not installed", "Missing ChatGPT app has no version or date");
assert(formatModule.exports.formatAppTooltip(true, "codex-cli 0.152.0", "", "01.09.2026") === "codex-cli 0.152.0 — 01.09.2026", "Codex date handling remains independent");
print("ChatGPT launcher: paths, metadata isolation, clearing and date-free hover passed.");
