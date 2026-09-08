/* global imports */

const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;
const source = ByteArray.toString(GLib.file_get_contents("applet.js")[1]);
function assert(value, message) { if (!value) throw new Error(message); }
const discoveries = [];
const requests = [];
class Process {
    constructor(options) { this.argv = options.argv; requests.push(this); }
    static new(argv) { const process = new Process({ argv }); discoveries.push(process); return process; }
    init() {}
    communicate_utf8_async(_input, _cancel, callback) { this.callback = callback; }
    communicate_utf8_finish() { return [true, JSON.stringify({ codex: "/resolved/codex" }), ""]; }
    get_exit_status() { return 0; }
}
const AppletClass = new Function("imports", "require", "global", `${source}\nreturn ChatGptUsageApplet;`)(
    { ui: { applet: { Applet: class {} } }, misc: {}, gi: {
        GLib, Gio: { Subprocess: Process, SubprocessFlags: {}, Cancellable: class {} }
    } }, () => ({}), { logWarning() {}, logError() {} }
);
const applet = Object.create(AppletClass.prototype);
applet._setDefaults();
applet.metadata = { path: "/fixture" };
applet._scheduleMenuRebuild = () => {};
applet._rebuildMenu = () => {};
applet._rebuildPanel = () => {};
applet._syncRefreshButtonState = () => {};
applet._snapshot = { limits: [] };
applet.codexPath = "/Explicit Codex";
applet.chatGptAppPath = "/First App/chatgpt";
applet._refreshBackendInfo();
assert(discoveries.length === 1 && discoveries[0].argv.includes("--chatgpt-app"), "Discovery receives app hint");
applet.chatGptAppPath = "/Second App/chatgpt";
discoveries[0].callback(discoveries[0], {});
assert(!applet._backendInfo && discoveries.length === 2, "Stale discovery is discarded and retried for changed app path");
discoveries[1].callback(discoveries[1], {});
assert(applet._resolveBundledCodexPath() === "/resolved/codex", "Current discovery can be used");
applet._refreshBackendInfo();
assert(discoveries.length === 2, "Unchanged pair uses discovery cache");
applet._refreshUsage();
const request = requests[requests.length - 1];
assert(request.argv.includes("--chatgpt-app") && request.argv.includes("/Second App/chatgpt") &&
    request.argv.includes("--codex") && request.argv.includes("/Explicit Codex"), "Usage receives both literal path hints");
applet.chatGptAppPath = "";
assert(applet._resolveBundledCodexPath() === null, "Clearing app path invalidates cached backend immediately");
assert(!applet._backendPathArguments().includes("--chatgpt-app"), "Empty app path restores automatic discovery");
print("Backend paths: both hints in requests, paired cache, stale discovery and clearing passed.");
