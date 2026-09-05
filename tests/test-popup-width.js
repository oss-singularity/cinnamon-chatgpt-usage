/* global imports, ARGV */

const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;
const [ok, contents] = GLib.file_get_contents(ARGV[0] || "applet.js");
if (!ok) throw new Error("Cannot read applet.js");

class Actor {
    constructor() { this.width = -1; }
    get_style() { return ""; }
    set_width(value) { this.width = value; }
}

class Menu {
    constructor() {
        this.actor = new Actor();
        this.box = new Actor();
        this.isOpen = false;
    }
    connect() { return 1; }
    open() {
        this.isOpen = true;
        if (this.actor.width < 0) this.actor.width = 448;
    }
    close() { this.isOpen = false; }
}

const AppletClass = new Function("imports", "require",
    `${ByteArray.toString(contents)}\nreturn ChatGptUsageApplet;`
)(
    {
        ui: {
            applet: { Applet: class {}, AppletPopupMenu: Menu },
            popupMenu: { PopupMenuManager: class { addMenu() {} } },
            main: {}
        },
        misc: {},
        gi: { St: { PolicyType: { AUTOMATIC: 1 } } }
    },
    () => ({})
);

// Exercise the production open wrapper and rebuild layout callback with
// the horizontal menu's observed 448 px natural size. Native captures cover
// the actual Cinnamon allocation, clipping and visual contents separately.
for (const orientation of ["top", "bottom", "left", "right"]) {
    const applet = Object.create(AppletClass.prototype);
    Object.assign(applet, {
        _isRightPanel: orientation === "right",
        _rightPanelPopupLockedWidth: 0,
        _historySubmenus: [],
        _limitSections: [],
        _popupRightInsetRows: [],
        _activityCharts: [],
        _submenuTriangles: [],
        _rebuildMenu() {},
        _openActiveSparkHistory() {}
    });
    applet._buildMenu(orientation);
    for (let cycle = 0; cycle < 3; cycle++) {
        applet.menu.open(false);
        if (applet.menu.actor.width !== 419 || applet.menu.box.width !== 419) {
            throw new Error(`${orientation}: popup grew on open cycle ${cycle}`);
        }
        applet.menu.actor.width = 448;
        applet.menu.box.width = 448;
        applet._syncPopupRightInsets();
        if (applet.menu.actor.width !== 419 || applet.menu.box.width !== 419) {
            throw new Error(`${orientation}: popup grew during rebuild cycle ${cycle}`);
        }
        // Model the shell releasing its allocation after a completed close.
        applet.menu.isOpen = false;
        applet.menu.actor.width = -1;
    }
}
print("Popup width: all panel orientations retain 419 px through open, rebuild and reopen.");
