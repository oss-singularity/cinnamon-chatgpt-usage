/* global imports */
/* exported main */

// SPDX-License-Identifier: GPL-3.0-or-later

const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;

const UsageFormat = require("./usage-format");

const UUID = "chatgpt-usage@oss-singularity";
const ANALYTICS_URL = "https://chatgpt.com/codex/cloud/settings/analytics#usage";
const PANEL_FONT_SCALE = 0.95;
const PANEL_LABEL_SCALE = 0.79;

class ChatGptUsageApplet extends Applet.Applet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.metadata = metadata;
        this._isVertical = this._orientationIsVertical(orientation);
        this._panelThickness = panelHeight;
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this._destroyed = false;
        this._timeoutId = 0;
        this._busy = false;
        this._cancellable = null;
        this._snapshot = null;
        this._lastError = null;
        this._clockSettings = null;
        this._clockChangedId = 0;
        this._use24HourClock = true;

        this._setDefaults();
        this._bindSystemClockFormat();
        this._bindSettings(instanceId);
        this._buildUi();
        this._buildMenu(orientation);
        this._refreshUsage();
        this._restartTimer();
    }

    _setDefaults() {
        this.refreshInterval = 3;
        this.codexPath = "";
        this.showPanelIcon = true;
        this.showWindowLabels = true;
        this.showWeeklyWithFiveHour = true;
        this.fontSize = 100;
        this.separator = "·";
        this.showColors = true;
        this.normalColor = "#ffffff";
        this.warningColor = "#f6d32d";
        this.criticalColor = "#ed333b";
        this.warningRemaining = 25;
        this.criticalRemaining = 10;
    }

    _bindSettings(instanceId) {
        this.settings = new Settings.AppletSettings(this, UUID, instanceId);
        const layoutChanged = this._onLayoutSettingChanged.bind(this);
        const styleChanged = this._onStyleSettingChanged.bind(this);

        this.settings.bind(
            "refresh-interval",
            "refreshInterval",
            this._onIntervalChanged.bind(this)
        );
        this.settings.bind("codex-path", "codexPath", this._refreshUsage.bind(this));
        this.settings.bind("show-panel-icon", "showPanelIcon", layoutChanged);
        this.settings.bind("show-window-labels", "showWindowLabels", layoutChanged);
        this.settings.bind(
            "show-weekly-with-five-hour",
            "showWeeklyWithFiveHour",
            layoutChanged
        );
        this.settings.bind("font-size", "fontSize", styleChanged);
        this.settings.bind("separator", "separator", layoutChanged);
        this.settings.bind("show-colors", "showColors", styleChanged);
        this.settings.bind("normal-color", "normalColor", styleChanged);
        this.settings.bind("warning-color", "warningColor", styleChanged);
        this.settings.bind("critical-color", "criticalColor", styleChanged);
        this.settings.bind("warning-remaining", "warningRemaining", styleChanged);
        this.settings.bind("critical-remaining", "criticalRemaining", styleChanged);
    }

    _buildUi() {
        this.actor.style = this._isVertical
            ? "padding-left: 0px; padding-right: 0px;"
            : null;
        this._root = new St.BoxLayout({
            reactive: true,
            vertical: this._isVertical
        });
        this.actor.add_child(this._root);
        this._syncPanelThickness();
        this._rebuildPanel();
    }

    _bindSystemClockFormat() {
        try {
            this._clockSettings = new Gio.Settings({
                schema_id: "org.cinnamon.desktop.interface"
            });
            this._use24HourClock = this._clockSettings.get_boolean("clock-use-24h");
            this._clockChangedId = this._clockSettings.connect(
                "changed::clock-use-24h",
                () => {
                    this._use24HourClock = this._clockSettings.get_boolean("clock-use-24h");
                    this._rebuildMenu();
                }
            );
        } catch (error) {
            this._clockSettings = null;
            this._clockChangedId = 0;
            this._use24HourClock = true;
            global.logWarning(`${UUID}: could not read the Cinnamon clock format: ${error}`);
        }
    }

    _buildMenu(orientation) {
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this._rebuildMenu();
    }

    _clearActor(actor) {
        for (const child of actor.get_children()) {
            actor.remove_child(child);
            child.destroy();
        }
    }

    _rebuildPanel() {
        if (!this._root) return;
        this._clearActor(this._root);
        const fontSize = this._panelFontSize();

        const allSummaries = this._snapshot
            ? UsageFormat.summarizeWindows(this._snapshot.limits)
            : [];
        const summaries = UsageFormat.selectPanelWindows(
            allSummaries,
            this.showWeeklyWithFiveHour
        );

        if (summaries.length === 0) {
            if (this.showPanelIcon) this._root.add_child(this._createPanelIcon());
            const placeholder = new St.Label({
                text: this._busy ? "…" : "--",
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
                style: `font-size: ${fontSize}%;`
            });
            this._root.add_child(placeholder);
        } else {
            summaries.forEach((summary, index) => {
                if (!this._isVertical && index > 0 && this.separator) {
                    this._root.add_child(new St.Label({
                        text: this.separator,
                        y_align: Clutter.ActorAlign.CENTER,
                        style: "padding-left: 4px; padding-right: 4px;"
                    }));
                }
                this._root.add_child(
                    this._createWindowActor(summary, this.showPanelIcon)
                );
            });
        }

        this._updateTooltip(summaries);
    }

    _createPanelIcon() {
        const iconPath = `${this.metadata.path}/icons/chatgpt-white.png`;
        const icon = new St.Icon({
            gicon: new Gio.FileIcon({ file: Gio.File.new_for_path(iconPath) }),
            icon_size: 20,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER
        });
        icon.style = "padding-right: 1px;";
        return icon;
    }

    _createWindowActor(summary, showIcon) {
        const fontSize = this._panelFontSize();
        const labelFontSize = Math.max(60, Math.round(fontSize * PANEL_LABEL_SCALE));
        const actor = new St.BoxLayout({
            reactive: false,
            vertical: true
        });
        actor.x_align = Clutter.ActorAlign.CENTER;
        actor.y_align = Clutter.ActorAlign.CENTER;
        actor.style = this._isVertical ? "padding: 1px 0px;" : "";

        if (this.showWindowLabels) {
            const labelRow = new St.BoxLayout({
                reactive: false,
                vertical: false,
                x_align: Clutter.ActorAlign.CENTER
            });
            if (showIcon) labelRow.add_child(this._createPanelIcon());
            const label = new St.Label({
                text: UsageFormat.formatDuration(summary.durationMinutes),
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
                style: `font-size: ${labelFontSize}%;`
            });
            label.clutter_text.set_line_alignment(Pango.Alignment.CENTER);
            labelRow.add_child(label);
            actor.add_child(labelRow);
        } else if (showIcon) {
            actor.add_child(this._createPanelIcon());
        }

        const value = new St.Label({
            text: UsageFormat.formatPercent(summary.remainingPercent),
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            style: `min-width: 32px; font-size: ${fontSize}%; color: ${this._remainingColor(summary.remainingPercent)};`
        });
        value.clutter_text.set_line_alignment(Pango.Alignment.CENTER);
        actor.add_child(value);
        return actor;
    }

    _panelFontSize() {
        return Math.round(this.fontSize * PANEL_FONT_SCALE);
    }

    _updateTooltip(summaries) {
        let text = "ChatGPT Work & Codex usage";
        if (summaries.length > 0) {
            const values = summaries.map(summary => {
                const duration = UsageFormat.formatDuration(summary.durationMinutes);
                return `${duration}: ${UsageFormat.formatPercent(summary.remainingPercent)} remaining`;
            });
            text = values.join(" • ");
        }
        if (this._lastError) text += `\n${this._lastError}`;
        this.set_applet_tooltip(text);
    }

    _remainingColor(remaining) {
        if (!this.showColors || !Number.isFinite(remaining)) return this.normalColor;
        if (remaining <= this.criticalRemaining) return this.criticalColor;
        if (remaining <= this.warningRemaining) return this.warningColor;
        return this.normalColor;
    }

    _rebuildMenu() {
        if (!this.menu) return;
        this.menu.removeAll();

        this._addInfoItem("ChatGPT Work & Codex usage", "font-weight: bold;");
        if (this._snapshot) {
            const updated = UsageFormat.formatTimestamp(
                this._snapshot.updatedAt,
                this._use24HourClock
            );
            this._addInfoItem(`  Updated ${updated}`);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            for (const limit of this._snapshot.limits) {
                this._addInfoItem("Usage limits", "font-weight: bold;");
                for (const window of limit.windows) {
                    const duration = UsageFormat.formatDuration(window.durationMinutes);
                    const remaining = UsageFormat.formatPercent(window.remainingPercent);
                    const reset = UsageFormat.formatTimestamp(
                        window.resetsAt,
                        this._use24HourClock
                    );
                    this._addInfoItem(`  ${duration}: ${remaining} remaining — resets ${reset}`);
                }
            }

            this._addHistoryItems();

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            for (const line of this._creditLines()) this._addInfoItem(line);
        } else {
            this._addInfoItem(this._busy ? "Loading usage limits…" : "No usage data available");
        }

        if (this._lastError) this._addInfoItem(`Last refresh failed: ${this._lastError}`);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const refreshItem = new PopupMenu.PopupIconMenuItem(
            "Refresh now",
            "view-refresh-symbolic",
            St.IconType.SYMBOLIC
        );
        refreshItem.connect("activate", () => this._refreshUsage());
        this.menu.addMenuItem(refreshItem);

        const analyticsItem = new PopupMenu.PopupIconMenuItem(
            "Open ChatGPT analytics",
            "web-browser-symbolic",
            St.IconType.SYMBOLIC
        );
        analyticsItem.connect("activate", () => Util.spawn(["xdg-open", ANALYTICS_URL]));
        this.menu.addMenuItem(analyticsItem);
    }

    _addInfoItem(text, style = null) {
        const item = new PopupMenu.PopupMenuItem(text, { reactive: false });
        if (style) item.label.style = style;
        this.menu.addMenuItem(item);
        return item;
    }

    _creditLines() {
        const credits = this._snapshot ? this._snapshot.credits : null;
        if (!credits) return ["Credits: unavailable", "Rate-limit resets: unavailable"];
        let balance = credits.balance === null ? "unavailable" : credits.balance;
        if (credits.unlimited) balance = "unlimited";
        return [`Credits: ${balance}`, `Rate-limit resets: ${credits.availableResetCount}`];
    }

    _addHistoryItems() {
        const history = this._snapshot ? this._snapshot.history : null;
        if (!history || !Array.isArray(history.windows) || history.windows.length === 0) {
            if (history && history.error) {
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                this._addInfoItem(`Usage history unavailable: ${history.error}`);
            }
            return;
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._addInfoItem("Recent consumption", "font-weight: bold;");
        for (const window of history.windows) {
            const duration = UsageFormat.formatDuration(window.durationMinutes);
            const periods = window.periods || {};
            const oneHour = UsageFormat.formatConsumedPercent(periods["1h"]);
            const fourHours = UsageFormat.formatConsumedPercent(periods["4h"]);
            const twelveHours = UsageFormat.formatConsumedPercent(periods["12h"]);
            const today = UsageFormat.formatConsumedPercent(periods.today);
            const hasPartialPeriod = Object.values(periods).some(
                period => period && period.complete === false
            );

            this._addInfoItem(`  ${duration} usage`, "font-weight: bold;");
            this._addInfoItem(`    1h ${oneHour}  ·  4h ${fourHours}`);
            this._addInfoItem(`    12h ${twelveHours}  ·  Today ${today}`);
            this._addActivityChart(
                window.activity24h,
                history.activityBucketMinutes
            );
            if (hasPartialPeriod) {
                const trackedSince = UsageFormat.formatTimestamp(
                    window.trackedSince || history.trackedSince,
                    this._use24HourClock
                );
                this._addInfoItem(`    ~ collecting since ${trackedSince}`);
            }
        }
    }

    _addActivityChart(values, bucketMinutes) {
        const model = UsageFormat.buildActivityChart(values);
        if (model.bars.length === 0) return;

        const bucketLabel = UsageFormat.formatDuration(bucketMinutes);
        const peakLabel = model.knownCount > 0
            ? UsageFormat.formatConsumedPercent({
                consumedPercent: model.peakPercent,
                complete: true
            })
            : "—";
        const item = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            activate: false
        });
        const column = new St.BoxLayout({ vertical: true });
        column.style = "padding: 2px 0 1px 16px;";

        const caption = new St.Label({
            text: `24h activity  ·  ${bucketLabel} buckets  ·  peak ${peakLabel}`
        });
        caption.style = "font-size: 85%;";
        column.add_child(caption);

        const slotWidth = 16;
        const plotWidth = slotWidth * model.bars.length;
        const plot = new St.BoxLayout({
            vertical: false,
            width: plotWidth,
            height: 30
        });
        plot.style = "border-bottom: 1px solid rgba(255,255,255,0.28); padding-top: 2px;";
        model.bars.forEach((bar, index) => {
            const slot = new St.Bin({ width: slotWidth, height: 28 });
            slot.set_alignment(St.Align.MIDDLE, St.Align.END);
            if (index % 3 === 0) {
                slot.style = "border-left: 1px solid rgba(255,255,255,0.10);";
            }

            let height = 2;
            let style = "background-color: rgba(255,255,255,0.16); border-radius: 2px 2px 0 0;";
            if (bar.known && bar.intensity === 0) {
                style = "background-color: rgba(255,255,255,0.38); border-radius: 2px 2px 0 0;";
            } else if (bar.known) {
                height = 5 + bar.intensity * 3;
                style = "background-gradient-direction: vertical; background-gradient-start: #8ed891; background-gradient-end: #5dbb73; border-radius: 2px 2px 0 0;";
            }
            slot.set_child(new St.Widget({ width: 10, height, style }));
            plot.add_child(slot);
        });
        column.add_child(plot);

        const axis = new St.BoxLayout({ vertical: false, width: plotWidth });
        const labels = [
            { text: "−24h", align: St.Align.START },
            { text: "−12h", align: St.Align.MIDDLE },
            { text: "now", align: St.Align.END }
        ];
        labels.forEach(labelData => {
            const label = new St.Label({
                text: labelData.text
            });
            label.style = "font-size: 75%; color: rgba(255,255,255,0.62);";
            const segment = new St.Bin({
                width: Math.floor(plotWidth / 3)
            });
            segment.set_alignment(labelData.align, St.Align.MIDDLE);
            segment.set_child(label);
            axis.add_child(segment);
        });
        column.add_child(axis);

        item.addActor(column, { span: -1, expand: true });
        this.menu.addMenuItem(item);
    }

    _onLayoutSettingChanged() {
        this._rebuildPanel();
    }

    _onStyleSettingChanged() {
        this._rebuildPanel();
    }

    _onIntervalChanged() {
        this._restartTimer();
    }

    _restartTimer() {
        if (this._timeoutId) {
            Mainloop.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        const minutes = Math.max(1, Number(this.refreshInterval) || 3);
        this._timeoutId = Mainloop.timeout_add_seconds(minutes * 60, () => {
            this._refreshUsage();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _refreshUsage() {
        if (this._destroyed || this._busy) return;

        const python = GLib.find_program_in_path("python3");
        const helper = `${this.metadata.path}/chatgpt_usage.py`;
        const codex = this._resolveCodexPath();
        if (!python || !codex) {
            this._lastError = !python
                ? "python3 was not found"
                : "Codex CLI was not found; configure its path in the applet settings";
            this._rebuildPanel();
            this._rebuildMenu();
            return;
        }

        this._busy = true;
        this._lastError = null;
        this._cancellable = new Gio.Cancellable();
        if (!this._snapshot) this._rebuildPanel();

        try {
            const process = new Gio.Subprocess({
                argv: [python, helper, "--codex", codex, "--timeout", "25"],
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            });
            process.init(null);
            process.communicate_utf8_async(null, this._cancellable, (source, result) => {
                this._busy = false;
                this._cancellable = null;

                try {
                    const [ok, stdout, stderr] = source.communicate_utf8_finish(result);
                    if (!ok || source.get_exit_status() !== 0) {
                        throw new Error(String(stderr || "Usage helper failed").trim());
                    }
                    const snapshot = JSON.parse(String(stdout || "").trim());
                    if (!snapshot || !Array.isArray(snapshot.limits)) {
                        throw new Error("Usage helper returned invalid data");
                    }
                    this._snapshot = snapshot;
                    this._lastError = null;
                } catch (error) {
                    const cancelled = error.matches &&
                        error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED);
                    if (!cancelled) {
                        this._lastError = String(error.message || error).slice(0, 180);
                        global.logError(`${UUID}: usage refresh failed: ${error}`);
                    }
                }

                if (!this._destroyed) {
                    this._rebuildPanel();
                    this._rebuildMenu();
                }
            });
        } catch (error) {
            this._busy = false;
            this._cancellable = null;
            this._lastError = String(error.message || error).slice(0, 180);
            global.logError(`${UUID}: could not start usage helper: ${error}`);
            this._rebuildPanel();
            this._rebuildMenu();
        }
    }

    _resolveCodexPath() {
        const configured = String(this.codexPath || "").trim();
        if (configured) return configured;

        const fromPath = GLib.find_program_in_path("codex");
        if (fromPath) return fromPath;

        const localPath = GLib.build_filenamev([GLib.get_home_dir(), ".local", "bin", "codex"]);
        return GLib.file_test(localPath, GLib.FileTest.IS_EXECUTABLE) ? localPath : null;
    }

    on_applet_clicked() {
        this._rebuildMenu();
        this.menu.toggle();
    }

    on_orientation_changed(orientation) {
        this._isVertical = this._orientationIsVertical(orientation);
        if (!this._root) return;
        this.actor.style = this._isVertical
            ? "padding-left: 0px; padding-right: 0px;"
            : null;
        this._root.set_vertical(this._isVertical);
        this._syncPanelThickness();
        this._rebuildPanel();
    }

    on_panel_height_changed() {
        if (this._isVertical && this.panel) this._panelThickness = this.panel.width;
        this._syncPanelThickness();
    }

    _syncPanelThickness() {
        if (!this._root) return;
        if (this._isVertical) {
            this._root.set_width(this._panelThickness);
            this._root.x_align = Clutter.ActorAlign.START;
        } else {
            this._root.set_width(-1);
            this._root.x_align = Clutter.ActorAlign.FILL;
        }
    }

    _orientationIsVertical(orientation) {
        return orientation === St.Side.LEFT || orientation === St.Side.RIGHT;
    }

    on_applet_removed_from_panel() {
        this._destroyed = true;
        if (this._timeoutId) {
            Mainloop.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        if (this._cancellable) {
            this._cancellable.cancel();
            this._cancellable = null;
        }
        if (this._clockSettings && this._clockChangedId) {
            this._clockSettings.disconnect(this._clockChangedId);
            this._clockChangedId = 0;
        }
        this._clockSettings = null;
        if (this.settings) this.settings.finalize();
    }
}

// Cinnamon loads this entry point by name.
// eslint-disable-next-line no-unused-vars
function main(metadata, orientation, panelHeight, instanceId) {
    return new ChatGptUsageApplet(metadata, orientation, panelHeight, instanceId);
}
