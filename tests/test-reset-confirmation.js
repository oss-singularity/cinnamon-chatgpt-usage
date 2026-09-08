/* global imports, ARGV */

const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;
const [ok, contents] = GLib.file_get_contents(ARGV[0] || "applet.js");
if (!ok) throw new Error("Cannot read applet.js");
function assert(value, message) { if (!value) throw new Error(message); }
class Actor {
    constructor() { this.reactive = true; this.can_focus = true; this.signals = {}; this.classes = new Set(); }
    connect(name, callback) { this.signals[name] = callback; }
    set checked(value) { this._checked = value; if (this.signals["notify::checked"]) this.signals["notify::checked"](); }
    get checked() { return this._checked; }
    change_style_pseudo_class(name, enabled) { if (enabled) this.classes.add(name); else this.classes.delete(name); }
    add_style_pseudo_class(name) { this.classes.add(name); }
}
class Modal {
    constructor() {
        this.children = [];
        this.buttons = [];
        this.contentLayout = { add_child: child => this.children.push(child) };
        this.buttonLayout = { get_children: () => this.buttons };
    }
    addButton(info) { const button = Object.assign(new Actor(), info); this.buttons.push(button); return button; }
    connect(_name, callback) { this.onDestroy = callback; }
    destroy() { this.onDestroy(); }
    open() {}
}
const AppletClass = new Function("imports", "require",
    `${ByteArray.toString(contents)}\nreturn ChatGptUsageApplet;`
)(
    { gettext: imports.gettext, format: imports.format, ui: {
        applet: { Applet: class {}, AppletPopupMenu: class {} },
        modalDialog: { ModalDialog: Modal },
        dialog: { MessageDialogContent: class { constructor(options) { Object.assign(this, options); } } },
        checkBox: { CheckBox: class {
            constructor(label, _params, checked) { this.actor = new Actor(); this.actor.label = label; this.actor.checked = checked; }
        } }
    }, misc: {}, gi: { Clutter: { KEY_Escape: 27 } } },
    () => ({ buildResetCreditConfirmation: () => ({ available: true, count: 1, expiryText: "fixture" }) })
);
for (const pending of [null, { key: "same-attempt" }]) {
    const applet = Object.create(AppletClass.prototype);
    Object.assign(applet, { _snapshot: { credits: {} }, _resetJournalReady: true, _pendingReset: pending });
    let consumed = 0;
    applet._consumeResetCredit = (_details, dialog, content, buttons) => {
        consumed++;
        applet._resetConsumeBusy = true;
        applet._setResetConfirmationBusy(dialog, content, buttons);
    };
    applet._showResetConfirmation();
    const first = applet._resetConfirmationDialog;
    const checkbox = first.children[1];
    const [cancel, use] = first.buttons;
    assert(checkbox && !checkbox.checked, "Every reset dialog must start unchecked");
    assert(!use.reactive && !use.can_focus && use.classes.has("insensitive"), "Reset button must start disabled");
    assert(cancel.default && !use.default && cancel.key === 27, "Cancel keeps initial focus and Escape");
    use.action();
    assert(consumed === 0, "Unchecked callback must not dispatch");
    checkbox.checked = true;
    assert(use.reactive && use.can_focus && !use.classes.has("insensitive"), "Checking must enable reset");
    checkbox.checked = false;
    use.action();
    assert(!use.reactive && consumed === 0, "Unchecking must relock reset");
    checkbox.checked = true;
    cancel.action();
    applet._showResetConfirmation();
    const second = applet._resetConfirmationDialog;
    assert(!second.children[1].checked && !second.buttons[1].reactive, "Reopening must forget acknowledgment");
    use.action();
    assert(consumed === 0, "Stale dialog callback must not dispatch");
    second.children[1].checked = true;
    second.buttons[1].action();
    second.buttons[1].action();
    assert(consumed === 1, "A checked dialog dispatches once");
    assert(!second.children[1].reactive && !second.buttons[1].reactive, "Busy state disables checkbox and action");
    second.children[1].checked = false;
    second.children[1].checked = true;
    assert(!second.buttons[1].reactive, "Checked changes cannot rearm a submitted dialog");
}
print("Reset acknowledgment: checked gate, cancel/reopen, retry, stale callbacks and double activation passed.");
