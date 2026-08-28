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
const CHATGPT_URL = "https://chatgpt.com/";
const CODEX_CLOUD_URL = "https://chatgpt.com/codex/cloud";
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

        this._addLaunchButtons();
    }

    _addLaunchButtons() {
        const chatGptApp = this._chatGptAppInfo();
        const codexCommand = this._codexTerminalCommand();
        const item = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            activate: false
        });
        const column = new St.BoxLayout({ vertical: true });
        column.style = "spacing: 8px; padding: 2px 0;";
        const launchRow = new St.Widget({
            layout_manager: new Clutter.BoxLayout({ homogeneous: true, spacing: 8 }),
            x_expand: true
        });
        const utilityRow = new St.Widget({
            layout_manager: new Clutter.BoxLayout({ homogeneous: true, spacing: 8 }),
            x_expand: true
        });
        const webRow = new St.Widget({
            layout_manager: new Clutter.BoxLayout({ homogeneous: true, spacing: 8 }),
            x_expand: true
        });

        this._chatGptButton = this._createLaunchButton(
            "ChatGPT App",
            { iconName: "chatgpt" },
            Boolean(chatGptApp),
            () => this._launchChatGptApp(chatGptApp)
        );
        this._codexButton = this._createLaunchButton(
            "Codex Terminal",
            { fileName: "codex.png" },
            Boolean(codexCommand),
            () => this._launchCodexTerminal(codexCommand)
        );
        const refreshButton = this._createLaunchButton(
            "Refresh now",
            { iconName: "view-refresh-symbolic", symbolic: true, compact: true },
            true,
            () => this._refreshUsage()
        );
        const analyticsButton = this._createLaunchButton(
            "Analytics",
            {
                iconName: "utilities-system-monitor-symbolic",
                symbolic: true,
                compact: true
            },
            true,
            () => Util.spawn(["xdg-open", ANALYTICS_URL])
        );
        const chatGptWebButton = this._createLaunchButton(
            "Open ChatGPT",
            {
                iconName: "web-browser-symbolic",
                symbolic: true,
                compact: true,
                transparent: true
            },
            true,
            () => Util.spawn(["xdg-open", CHATGPT_URL])
        );
        const codexCloudButton = this._createLaunchButton(
            "Open Codex Cloud",
            {
                iconName: "web-browser-symbolic",
                symbolic: true,
                compact: true,
                transparent: true
            },
            true,
            () => Util.spawn(["xdg-open", CODEX_CLOUD_URL])
        );
        launchRow.add_child(this._chatGptButton);
        launchRow.add_child(this._codexButton);
        utilityRow.add_child(refreshButton);
        utilityRow.add_child(analyticsButton);
        webRow.add_child(chatGptWebButton);
        webRow.add_child(codexCloudButton);
        column.add_child(launchRow);
        column.add_child(utilityRow);
        column.add_child(webRow);
        item.addActor(column, { span: -1, expand: true });
        this.menu.addMenuItem(item);
    }

    _createLaunchButton(label, iconSpec, available, action) {
        const content = new St.BoxLayout({
            vertical: false,
            y_align: Clutter.ActorAlign.CENTER
        });
        content.style = "spacing: 6px;";
        const iconProperties = { icon_size: iconSpec.compact ? 18 : 28 };
        if (iconSpec.fileName) {
            const iconPath = `${this.metadata.path}/icons/${iconSpec.fileName}`;
            iconProperties.gicon = new Gio.FileIcon({
                file: Gio.File.new_for_path(iconPath)
            });
        } else {
            iconProperties.icon_name = iconSpec.iconName;
            iconProperties.icon_type = iconSpec.symbolic
                ? St.IconType.SYMBOLIC
                : St.IconType.FULLCOLOR;
        }
        const icon = new St.Icon(iconProperties);
        icon.y_align = Clutter.ActorAlign.CENTER;
        content.add_child(icon);
        content.add_child(new St.Label({
            text: label,
            y_align: Clutter.ActorAlign.CENTER
        }));

        const button = new St.Button({
            child: content,
            style_class: "notification-button",
            reactive: available,
            can_focus: available,
            x_expand: true
        });
        button.style = this._launchButtonStyle(
            available ? "normal" : "disabled",
            iconSpec.compact,
            iconSpec.transparent
        );
        if (!available) {
            button.opacity = 100;
            button.add_style_pseudo_class("insensitive");
        } else {
            button.connect("enter-event", () => {
                button.style = this._launchButtonStyle(
                    "hover",
                    iconSpec.compact,
                    iconSpec.transparent
                );
            });
            button.connect("leave-event", () => {
                button.style = this._launchButtonStyle(
                    "normal",
                    iconSpec.compact,
                    iconSpec.transparent
                );
            });
            button.connect("button-press-event", () => {
                button.style = this._launchButtonStyle(
                    "pressed",
                    iconSpec.compact,
                    iconSpec.transparent
                );
            });
            button.connect("button-release-event", () => {
                button.style = this._launchButtonStyle(
                    "hover",
                    iconSpec.compact,
                    iconSpec.transparent
                );
            });
            button.connect("clicked", () => {
                this.menu.close(false);
                action();
            });
        }
        return button;
    }

    _launchButtonStyle(state, compact = false, transparent = false) {
        const raisedColors = {
            normal: ["rgba(255,255,255,0.14)", "rgba(255,255,255,0.05)"],
            hover: ["rgba(255,255,255,0.22)", "rgba(255,255,255,0.09)"],
            pressed: ["rgba(255,255,255,0.06)", "rgba(255,255,255,0.16)"],
            disabled: ["rgba(255,255,255,0.05)", "rgba(255,255,255,0.02)"]
        };
        const transparentColors = {
            normal: ["rgba(255,255,255,0.035)", "rgba(255,255,255,0.01)"],
            hover: ["rgba(255,255,255,0.13)", "rgba(255,255,255,0.04)"],
            pressed: ["rgba(255,255,255,0.025)", "rgba(255,255,255,0.10)"],
            disabled: ["rgba(255,255,255,0.02)", "rgba(255,255,255,0.005)"]
        };
        const colors = transparent ? transparentColors : raisedColors;
        const [top, bottom] = colors[state] || colors.normal;
        return [
            `padding: ${compact ? (transparent ? 3 : 4) : 7}px 10px`,
            "border-radius: 6px",
            `border: 1px solid rgba(255,255,255,${transparent ? 0.09 : 0.16})`,
            "background-gradient-direction: vertical",
            `background-gradient-start: ${top}`,
            `background-gradient-end: ${bottom}`,
            `box-shadow: inset 0 1px 2px rgba(255,255,255,${transparent ? 0.04 : 0.12})`
        ].join("; ") + ";";
    }

    _chatGptAppInfo() {
        try {
            return Gio.DesktopAppInfo.new("chatgpt.desktop");
        } catch (error) {
            global.logWarning(`${UUID}: could not inspect ChatGPT desktop app: ${error}`);
            return null;
        }
    }

    _codexTerminalCommand() {
        const codex = this._resolveCodexPath();
        if (!codex) return null;
        try {
            const terminalSettings = new Gio.Settings({
                schema_id: "org.cinnamon.desktop.default-applications.terminal"
            });
            const terminal = terminalSettings.get_string("exec").trim();
            const terminalArgument = terminalSettings.get_string("exec-arg").trim();
            const [terminalOk, terminalArgv] = GLib.shell_parse_argv(terminal);
            if (!terminalOk || terminalArgv.length === 0) return null;
            const executable = GLib.find_program_in_path(terminalArgv[0]);
            if (!executable) return null;
            terminalArgv[0] = executable;
            if (terminalArgument) {
                const [argumentOk, argumentArgv] = GLib.shell_parse_argv(terminalArgument);
                if (!argumentOk) return null;
                terminalArgv.push(...argumentArgv);
            }
            terminalArgv.push(codex);
            return terminalArgv;
        } catch (error) {
            global.logWarning(`${UUID}: could not inspect the default terminal: ${error}`);
            return null;
        }
    }

    _launchChatGptApp(appInfo) {
        try {
            appInfo.launch([], null);
        } catch (error) {
            this._reportLaunchError("ChatGPT App", error);
        }
    }

    _launchCodexTerminal(command) {
        try {
            Util.spawn(command);
        } catch (error) {
            this._reportLaunchError("Codex Terminal", error);
        }
    }

    _reportLaunchError(target, error) {
        this._lastError = `Could not open ${target}`;
        global.logError(`${UUID}: ${this._lastError}: ${error}`);
        this._rebuildMenu();
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
                complete: model.peakComplete
            })
            : "—";
        const item = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            activate: false
        });
        const column = new St.BoxLayout({ vertical: true });
        column.style = "padding: 2px 0 1px 0;";

        const caption = new St.BoxLayout({
            vertical: false
        });
        const captionTitle = new St.Label({ text: "  24h Activity" });
        captionTitle.style = "font-weight: bold;";
        const captionDetails = new St.Label({
            text: `  ·  ${bucketLabel} buckets  ·  peak ${peakLabel}`
        });
        caption.add_child(captionTitle);
        caption.add_child(captionDetails);
        column.add_child(caption);

        const chart = new St.BoxLayout({ vertical: true });
        chart.style = "padding-left: 10px;";

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
            const barActor = new St.Widget({ width: 10, height, style });
            if (bar.partial) barActor.opacity = 155;
            slot.set_child(barActor);
            plot.add_child(slot);
        });
        chart.add_child(plot);

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
        chart.add_child(axis);
        column.add_child(chart);

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
