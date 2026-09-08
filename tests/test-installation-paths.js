/* global imports */

const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;
const source = ByteArray.toString(GLib.file_get_contents("applet.js")[1]);
function assert(value, message) { if (!value) throw new Error(message); }
class Box {
    constructor() { this.children = []; }
    add_child(child) { this.children.push(child); }
    add(child) { this.children.push(child); }
}
class Label {
    constructor(options) { Object.assign(this, options); this.clutter_text = { set_line_wrap() {}, set_line_wrap_mode() {} }; }
    set_text(text) { this.text = text; }
}
class Entry {
    constructor(options) { Object.assign(this, options); this.clutter_text = { connect() {} }; }
    get_text() { return this.text; }
}
class Modal {
    constructor() { this.contentLayout = new Box(); }
    setButtons(buttons) { this.buttons = buttons; }
    connect() {}
    destroy() { this.destroyed = true; }
    open() {}
}
const AppletClass = new Function("imports", "require", `${source}\nreturn ChatGptUsageApplet;`)(
    { ui: { applet: { Applet: class {} }, modalDialog: { ModalDialog: Modal }, dialog: { MessageDialogContent: Label } }, misc: {}, gi: {
        GLib, St: { Align: {}, BoxLayout: Box, Label, Entry, Button: class { connect() {} } }, Pango: { WrapMode: {} }, Clutter: { KEY_Escape: 27, ActorAlign: {} }
    } }, () => ({})
);
const applet = Object.create(AppletClass.prototype);
applet._setDefaults();
applet._detectAutomaticPaths = callback => { callback({ codex: "/automatic/codex", chatgpt: "/automatic/chatgpt" }); return () => {}; };
const saved = [];
let refreshed = 0;
applet.settings = { setValue(key, value) { saved.push([key, value]); applet[key === "codex-path" ? "codexPath" : "chatGptAppPath"] = value; } };
applet._onChatGptAppPathChanged = () => { refreshed++; };
function open() {
    applet._showInstallHelp("Set up", "Fixture", "https://example.invalid");
    const dialog = applet._installHelpDialog;
    const fields = dialog.contentLayout.children[1].children;
    return { dialog, entries: fields.filter(child => child instanceof Entry), status: fields[fields.length - 2] };
}
let ui = open();
assert(ui.entries.length === 2 && ui.entries.every(entry => entry.text === "" && entry.accessible_name), "Setup exposes both optional accessible fields");
ui.entries[0].text = "/bin/true";
ui.dialog.buttons[0].action();
assert(saved.length === 0 && !applet._installHelpDialog, "Cancel never saves drafts");
ui = open();
ui.entries[0].text = "/bin/true";
ui.entries[1].text = "/missing/app";
ui.dialog.buttons[2].action();
assert(saved.length === 0 && !ui.dialog.destroyed && ui.status.text.includes("ChatGPT app"), "Invalid app rejects both values and stays open with feedback");
ui.entries[1].text = "/bin/true";
ui.dialog.buttons[2].action();
assert(saved.length === 2 && refreshed === 1 && !applet._installHelpDialog, "Save persists both paths and retries detection once");
ui = open();
assert(ui.entries.every(entry => entry.text === "/bin/true"), "Setup reopens with the same saved settings");
ui.entries.forEach(entry => { entry.text = ""; });
ui.dialog.buttons[2].action();
assert(applet.codexPath === "" && applet.chatGptAppPath === "" && refreshed === 2, "Clearing fields saves automatic detection");
print("Installation paths: both fields, cancel, validation before writes, save/recheck, persistence and clearing passed.");
