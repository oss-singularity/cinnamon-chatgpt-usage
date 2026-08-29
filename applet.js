/* global imports */
/* exported main */

// SPDX-License-Identifier: GPL-3.0-or-later

const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const Tooltips = imports.ui.tooltips;
const Main = imports.ui.main;
const ModalDialog = imports.ui.modalDialog;
const Dialog = imports.ui.dialog;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;
const Cairo = imports.cairo;

const UsageFormat = require("./usage-format");

const UUID = "chatgpt-usage@oss-singularity";
const CHATGPT_URL = "https://chatgpt.com/";
const CODEX_CLOUD_URL = "https://chatgpt.com/codex/cloud";
const ANALYTICS_URL = "https://chatgpt.com/codex/cloud/settings/analytics#usage";
const CHATGPT_LINUX_INSTALL_URL = "https://learn.chatgpt.com/docs/linux/linux-app";
const CODEX_CLI_INSTALL_URL = "https://learn.chatgpt.com/docs/codex/cli#getting-started";
const PANEL_FONT_SCALE = 0.95;
const PANEL_LABEL_SCALE = 0.79;
const ACTIVITY_TOOLTIP_DELAY_MS = 120;
const POPUP_ACTION_GRID_WIDTH = 352;
const POPUP_RIGHT_PANEL_WIDTH_BUMP = 5;
const POPUP_RIGHT_INSET = 4;
const POPUP_CHART_RIGHT_INSET = 14;
const POPUP_SUBMENU_ARROW_OFFSET = -35;
const POPUP_EXPANDED_RIGHT_INSET = 10;
const POPUP_EXPANDED_ARROW_INSET = 25;
const QUOTA_RING_SIZE = 52;
const COMPACT_QUOTA_RING_SIZE = 40;
const SPARK_BADGE_COLOR = "#f2a15f";

class ChatGptUsageApplet extends Applet.Applet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.metadata = metadata;
        this._isVertical = this._orientationIsVertical(orientation);
        this._panelThickness = panelHeight;
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this._destroyed = false;
        this._timeoutId = 0;
        this._countdownTimeoutId = 0;
        this._countdownWidgets = [];
        this._quotaWidgets = [];
        this._activityTooltips = [];
        this._popupRightInsetRows = [];
        this._activityCharts = [];
        this._submenuTriangles = [];
        this._isRightPanel = this._orientationIsRight(orientation);
        this._refreshConfirmationTimeoutId = 0;
        this._refreshSpinnerTimeoutId = 0;
        this._menuRebuildTimeoutId = 0;
        this._rightPanelPopupClosedId = 0;
        this._rightPanelPopupOpenStateChangedId = 0;
        this._refreshButton = null;
        this._refreshButtonIcon = null;
        this._refreshButtonLabel = null;
        this._refreshSpinnerLabel = null;
        this._updatedLabel = null;
        this._refreshSpinnerFrame = 0;
        this._historySubmenus = [];
        this._actionFrame = null;
        this._actionWidthFrame = null;
        this._actionColumn = null;
        this._actionColumnWidth = POPUP_ACTION_GRID_WIDTH;
        this._installHelpDialog = null;
        this._refreshConfirmed = false;
        this._busy = false;
        this._cancellable = null;
        this._snapshot = null;
        this._lastError = null;
        this._rightPanelMenuStyleBase = null;
        this._clockSettings = null;
        this._clockChangedId = 0;
        this._use24HourClock = true;

        this._setDefaults();
        this._bindSystemClockFormat();
        this._bindSettings(instanceId);
        this._buildUi();
        this._buildMenu(orientation);
        this._restartCountdownTimer();
        this._refreshUsage();
        this._restartTimer();
    }

    _setDefaults() {
        this.refreshInterval = 3;
        this.activityBucketMinutes = "60";
        this.codexPath = "";
        this.showPanelIcon = true;
        this.showWindowLabels = true;
        this.showModelLimitsInPanel = false;
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
        this.settings.bind(
            "activity-bucket-minutes",
            "activityBucketMinutes",
            this._refreshUsage.bind(this)
        );
        this.settings.bind("codex-path", "codexPath", this._refreshUsage.bind(this));
        this.settings.bind("show-panel-icon", "showPanelIcon", layoutChanged);
        this.settings.bind("show-window-labels", "showWindowLabels", layoutChanged);
        this.settings.bind(
            "show-model-limits-in-panel",
            "showModelLimitsInPanel",
            layoutChanged
        );
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
        this._rightPanelMenuStyleBase = this.menu.actor.get_style() || "";
        this._menuOpenOriginal = this.menu.open.bind(this.menu);
        this._menuCloseOriginal = this.menu.close.bind(this.menu);
        this.menu.open = animate => {
            if (this._isRightPanel) this._applyRightPanelPopupWidth();
            return this._menuOpenOriginal(animate);
        };
        this.menu.close = animate => {
            if (this._isRightPanel) this._normalizeRightPanelPopupCloseWidth();
            return this._menuCloseOriginal(animate);
        };
        this._rightPanelPopupOpenStateChangedId = this.menu.connect(
            "open-state-changed",
            (_menu, open) => {
                if (!this._isRightPanel || !this.menu) return;

                if (!open) this._normalizeRightPanelPopupCloseWidth();
            }
        );
        this._rightPanelPopupClosedId = this.menu.connect("menu-animated-closed", () => {
            if (!this._isRightPanel || !this.menu) return;
            this.menu.actor.set_width(-1);
            this.menu.actor.translation_x = 0;
        });
        this._rebuildMenu();
    }

    _clearActor(actor) {
        for (const child of actor.get_children()) {
            actor.remove_child(child);
            child.destroy();
        }
    }

    _setActionColumnWidth(width) {
        if (!this._actionWidthFrame) return;
        if (width > 0) {
            this._actionWidthFrame.set_width(width);
            if (this._actionColumn) this._actionColumn.set_width(width);
            this._actionWidthFrame.min_width = width;
            this._actionWidthFrame.natural_width = width;
            this._actionWidthFrame.min_width_set = true;
            this._actionWidthFrame.natural_width_set = true;
            return;
        }
        this._actionWidthFrame.set_width(-1);
        if (this._actionColumn) this._actionColumn.set_width(-1);
        this._actionWidthFrame.min_width_set = false;
        this._actionWidthFrame.natural_width_set = false;
    }

    _syncActionColumnCentering() {
        if (
            !this.menu ||
            !this._actionWidthFrame ||
            !this._actionWidthFrame.get_stage()
        ) return;
        this._actionWidthFrame.translation_x = 0;
        const [menuX] = this.menu.actor.get_transformed_position();
        const [menuWidth] = this.menu.actor.get_transformed_size();
        const [gridX] = this._actionWidthFrame.get_transformed_position();
        const [gridWidth] = this._actionWidthFrame.get_transformed_size();
        const menuCenter = menuX + menuWidth / 2;
        const gridCenter = gridX + gridWidth / 2;
        this._actionWidthFrame.translation_x = Math.round(menuCenter - gridCenter);
    }

    _rebuildPanel() {
        if (!this._root) return;
        this._clearActor(this._root);
        const fontSize = this._panelFontSize();

        let panelLimits = this._snapshot ? this._snapshot.limits : [];
        if (!this.showModelLimitsInPanel) {
            const accountLimits = panelLimits.filter(limit => limit.id === "codex");
            if (accountLimits.length > 0) panelLimits = accountLimits;
        }
        const allSummaries = UsageFormat.summarizeWindows(panelLimits);
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

    _modelBadge(limit) {
        if (!limit || limit.limitId === "codex" || limit.id === "codex") return null;
        const label = String(limit.limitLabel || limit.label || "");
        return /spark/i.test(label) ? "S" : "M";
    }

    _modelBadgeStyle(fontPercent) {
        return [
            `font-size: ${fontPercent}%`,
            "font-weight: bold",
            "font-style: italic",
            `color: ${SPARK_BADGE_COLOR}`,
            "background-color: #25272d",
            "border: 1px solid rgba(242,161,95,0.92)",
            "border-radius: 8px",
            "padding: 0 3px"
        ].join("; ") + ";";
    }

    _createPanelIcon(limit = null, size = 20) {
        const iconPath = `${this.metadata.path}/icons/chatgpt-white.png`;
        const icon = new St.Icon({
            gicon: new Gio.FileIcon({ file: Gio.File.new_for_path(iconPath) }),
            icon_size: limit ? size + 2 : size,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER
        });
        icon.style = "padding-right: 1px;";
        const badgeText = this._modelBadge(limit);
        if (!badgeText) return icon;

        const actor = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            width: size + 6,
            height: size + 2
        });
        const badge = new St.Label({
            text: badgeText,
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.START
        });
        badge.style = this._modelBadgeStyle(45);
        badge.translation_x = -2;
        actor.add_child(icon);
        actor.add_child(badge);
        return actor;
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
            if (showIcon) labelRow.add_child(this._createPanelIcon(summary));
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
            actor.add_child(this._createPanelIcon(summary));
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
        if (this._snapshot && this._snapshot.limits.length > 0) {
            const showLimitLabels = this._snapshot.limits.length > 1;
            const values = [];
            for (const limit of this._snapshot.limits) {
                for (const window of limit.windows || []) {
                    const duration = UsageFormat.formatDuration(window.durationMinutes);
                    const prefix = showLimitLabels ? `${limit.label || limit.id} ` : "";
                    values.push(
                        `${prefix}${duration}: ${UsageFormat.formatPercent(window.remainingPercent)} remaining`
                    );
                }
            }
            if (values.length > 0) text = values.join("\n");
        } else if (summaries.length > 0) {
            text = summaries.map(summary => {
                const duration = UsageFormat.formatDuration(summary.durationMinutes);
                return `${duration}: ${UsageFormat.formatPercent(summary.remainingPercent)} remaining`;
            }).join(" • ");
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
        const wasOpen = this.menu.isOpen;
        const expandedSubmenus = new Set();
        if (wasOpen) this.actor.grab_key_focus();
        for (const entry of this._historySubmenus) {
            if (!entry.submenu.menu.isOpen) continue;
            expandedSubmenus.add(entry.id);
            entry.submenu.menu.close(false);
        }
        this._stopRefreshSpinner();
        this._refreshButton = null;
        this._refreshButtonIcon = null;
        this._refreshButtonLabel = null;
        this._refreshSpinnerLabel = null;
        this._updatedLabel = null;
        this._historySubmenus = [];
        this._actionFrame = null;
        this._actionWidthFrame = null;
        this._actionColumn = null;
        this._countdownWidgets = [];
        this._quotaWidgets = [];
        this._activityTooltips = [];
        this._popupRightInsetRows = [];
        this._activityCharts = [];
        this._submenuTriangles = [];
        this.menu.removeAll();

        this._addHeaderItem();
        if (this._snapshot) {
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            const limits = this._snapshot.limits || [];
            const usageTitle = this._addInfoItem("Usage limits", "font-weight: bold;");
            usageTitle.actor.style = "padding-bottom: 2px;";
            const showLimitLabels = limits.length > 1;
            for (const limit of limits) {
                if (showLimitLabels) {
                    this._addLimitHeading(limit);
                }
                for (const window of limit.windows) {
                    this._addLimitWindowItem(window);
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

        if (wasOpen) {
            for (const entry of this._historySubmenus) {
                if (expandedSubmenus.has(entry.id)) entry.submenu.menu.open(false);
            }
        }
    }

    _scheduleMenuRebuild() {
        if (this._destroyed || this._menuRebuildTimeoutId) return;
        this._menuRebuildTimeoutId = Mainloop.timeout_add(60, () => {
            const [, , modifiers] = global.get_pointer();
            if (modifiers & Clutter.ModifierType.BUTTON1_MASK) {
                return GLib.SOURCE_CONTINUE;
            }
            this._menuRebuildTimeoutId = 0;
            this._rebuildMenu();
            return GLib.SOURCE_REMOVE;
        });
    }

    _addHeaderItem() {
        const item = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            activate: false
        });
        const text = new St.BoxLayout({
            vertical: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        text.x_expand = true;
        const title = new St.Label({ text: "ChatGPT Work & Codex usage" });
        title.style = "font-weight: bold;";
        text.add_child(title);
        if (this._snapshot) {
            this._updatedLabel = new St.Label({
                text: `Updated ${UsageFormat.formatRelativeTime(this._snapshot.updatedAt)}`
            });
            this._updatedLabel.style = [
                "padding-top: 6px",
                "padding-left: 6px",
                "font-size: 90%",
                "color: rgba(255,255,255,0.68)"
            ].join("; ") + ";";
            text.add_child(this._updatedLabel);
        }
        const row = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        row.style = `padding-right: ${POPUP_RIGHT_INSET}px;`;
        this._popupRightInsetRows.push(row);
        row.add_child(text);

        if (this._snapshot) {
            const summaries = UsageFormat.listQuotaWindows(this._snapshot.limits);
            const compact = summaries.length >= 4;
            const rings = new St.BoxLayout({
                vertical: false,
                x_align: Clutter.ActorAlign.END,
                y_align: Clutter.ActorAlign.CENTER
            });
            rings.style = `spacing: ${compact ? 2 : 8}px;`;
            for (const summary of summaries) {
                rings.add_child(
                    this._createQuotaRing(
                        summary,
                        compact ? COMPACT_QUOTA_RING_SIZE : QUOTA_RING_SIZE
                    )
                );
            }
            row.add_child(rings);
        }
        item.addActor(row, { expand: true, span: -1 });
        this.menu.addMenuItem(item);
    }

    _createQuotaRing(window, size = QUOTA_RING_SIZE) {
        const actor = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            width: size,
            height: size
        });
        const area = new St.DrawingArea({ width: size, height: size });
        const model = UsageFormat.buildQuotaIndicator(window);
        const badgeText = this._modelBadge(window);
        const label = new St.Label({
            text: `${model.durationLabel}\n${model.percentLabel}`,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER
        });
        label.translation_x = badgeText ? 2 : 0;
        label.clutter_text.set_line_alignment(Pango.Alignment.CENTER);
        label.style = [
            `font-size: ${size < QUOTA_RING_SIZE ? 60 : 72}%`,
            "font-weight: bold",
            "color: rgba(255,255,255,0.96)",
            "text-align: center"
        ].join("; ") + ";";
        area.connect("repaint", drawingArea => {
            const color = this._ringColor(this._quotaRingColor(window.remainingPercent));
            this._paintCircularProgress(
                drawingArea,
                model.valid ? model.fractionRemaining : 0,
                color
            );
        });
        actor.add_child(area);
        actor.add_child(label);
        if (badgeText) {
            const badge = new St.Label({
                text: badgeText,
                x_expand: true,
                y_expand: true,
                x_align: Clutter.ActorAlign.START,
                y_align: Clutter.ActorAlign.START
            });
            badge.style = this._modelBadgeStyle(
                size < QUOTA_RING_SIZE ? 50 : 60
            );
            badge.translation_x = size < QUOTA_RING_SIZE ? 6 : 8;
            badge.translation_y = size < QUOTA_RING_SIZE ? 8 : 11;
            actor.add_child(badge);
        }
        this._quotaWidgets.push({ area, label, window });
        area.queue_repaint();
        return actor;
    }

    _addLimitWindowItem(window) {
        const duration = UsageFormat.formatDuration(window.durationMinutes);
        const remaining = UsageFormat.formatPercent(window.remainingPercent);
        const reset = UsageFormat.formatTimestamp(
            window.resetsAt,
            this._use24HourClock
        );
        const item = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            activate: false
        });
        item.actor.style = "padding-top: 0px;";
        const text = new St.BoxLayout({
            vertical: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        text.x_expand = true;
        const headline = new St.BoxLayout({
            vertical: false,
            y_align: Clutter.ActorAlign.CENTER
        });
        const durationLabel = new St.Label({
            text: `  ${duration} usage`
        });
        durationLabel.style = "font-weight: bold;";
        const remainingLabel = new St.Label({
            text: `${remaining} remaining`
        });
        remainingLabel.style = [
            "padding-left: 12px",
            "font-size: 102%",
            "font-weight: bold",
            `color: ${this._remainingColor(window.remainingPercent)}`
        ].join("; ") + ";";
        remainingLabel.opacity = 195;
        headline.add_child(durationLabel);
        headline.add_child(remainingLabel);
        const resetLabel = new St.Label({
            text: `  Resets ${reset}`
        });
        resetLabel.style = "padding-top: 3px; font-size: 90%; color: rgba(255,255,255,0.68);";
        text.add_child(headline);
        text.add_child(resetLabel);
        const countdown = this._createResetCountdown(window);
        const row = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        row.style = `padding-right: ${POPUP_RIGHT_INSET}px;`;
        this._popupRightInsetRows.push(row);
        row.add_child(text);
        row.add_child(countdown);
        item.addActor(row, { expand: true, span: -1 });
        this.menu.addMenuItem(item);
    }

    _addLimitHeading(limit) {
        const item = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            activate: false
        });
        const row = new St.BoxLayout({
            vertical: false,
            y_align: Clutter.ActorAlign.CENTER
        });
        row.style = "spacing: 6px;";
        row.add_child(this._createPanelIcon(limit, 18));
        const label = new St.Label({
            text: limit.label || limit.id,
            y_align: Clutter.ActorAlign.CENTER
        });
        label.style = "font-weight: bold;";
        row.add_child(label);
        item.addActor(row);
        this.menu.addMenuItem(item);
    }

    _createResetCountdown(window) {
        const size = 52;
        const actor = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            width: size,
            height: size
        });
        const area = new St.DrawingArea({ width: size, height: size });
        const label = new St.Label({
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER
        });
        label.clutter_text.set_line_alignment(Pango.Alignment.CENTER);
        label.style = [
            "font-size: 72%",
            "font-weight: bold",
            "color: rgba(255,255,255,0.94)",
            "text-align: center"
        ].join("; ") + ";";
        area.connect("repaint", drawingArea => {
            this._paintResetCountdown(drawingArea, window);
        });
        actor.add_child(area);
        actor.add_child(label);
        this._countdownWidgets.push({ area, label, window });
        this._updateResetCountdown({ area, label, window });
        return actor;
    }

    _paintResetCountdown(area, window) {
        const model = UsageFormat.buildResetCountdown(window);
        this._paintCircularProgress(
            area,
            model.valid ? model.fractionElapsed : 0,
            new Clutter.Color({
                red: 101,
                green: 214,
                blue: 139,
                alpha: 255
            })
        );
    }

    _ringColor(value) {
        const [valid, color] = Clutter.Color.from_string(String(value || ""));
        if (valid) {
            color.alpha = 255;
            return color;
        }
        return new Clutter.Color({
            red: 101,
            green: 214,
            blue: 139,
            alpha: 255
        });
    }

    _quotaRingColor(remaining) {
        if (!this.showColors || !Number.isFinite(remaining)) return this.normalColor;
        if (remaining <= this.criticalRemaining) return this.criticalColor;
        if (remaining <= this.warningRemaining) return this.warningColor;
        return "#62c7f5";
    }

    _paintCircularProgress(area, fraction, progressColor) {
        const [width, height] = area.get_surface_size();
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.max(1, Math.min(width, height) / 2 - 5);
        const startAngle = -Math.PI / 2;
        const progressFraction = Math.max(0, Math.min(1, Number(fraction) || 0));
        const context = area.get_context();
        const track = new Clutter.Color({
            red: 255,
            green: 255,
            blue: 255,
            alpha: 42
        });
        const glow = new Clutter.Color({
            red: progressColor.red,
            green: progressColor.green,
            blue: progressColor.blue,
            alpha: 58
        });
        const progress = new Clutter.Color({
            red: progressColor.red,
            green: progressColor.green,
            blue: progressColor.blue,
            alpha: 255
        });

        context.setLineCap(Cairo.LineCap.ROUND);
        context.setLineWidth(5);
        Clutter.cairo_set_source_color(context, track);
        context.arc(centerX, centerY, radius, 0, Math.PI * 2);
        context.stroke();

        if (progressFraction > 0) {
            const endAngle = startAngle + (Math.PI * 2 * progressFraction);
            context.setLineWidth(8);
            Clutter.cairo_set_source_color(context, glow);
            context.arc(centerX, centerY, radius, startAngle, endAngle);
            context.stroke();
            context.setLineWidth(5);
            Clutter.cairo_set_source_color(context, progress);
            context.arc(centerX, centerY, radius, startAngle, endAngle);
            context.stroke();
        }
        context.$dispose();
    }

    _updateResetCountdown(entry) {
        const model = UsageFormat.buildResetCountdown(entry.window);
        entry.label.set_text(model.label);
        entry.area.queue_repaint();
    }

    _updateResetCountdowns() {
        for (const entry of this._countdownWidgets) {
            this._updateResetCountdown(entry);
        }
    }

    _updateRelativeTime() {
        if (!this._updatedLabel || !this._snapshot) return;
        const relativeTime = UsageFormat.formatRelativeTime(this._snapshot.updatedAt);
        this._updatedLabel.set_text(`Updated ${relativeTime}`);
    }

    _addLaunchButtons() {
        const chatGptApp = this._chatGptAppInfo();
        const codexCommand = this._codexTerminalCommand();
        const item = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            activate: false
        });
        item.actor.style = "padding-left: 0px; padding-right: 0px;";
        const column = new St.BoxLayout({ vertical: true });
        column.style = "spacing: 8px; padding: 2px 0;";
        column.x_expand = true;
        column.x_align = Clutter.ActorAlign.FILL;
        const actionWidthFrame = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            x_align: Clutter.ActorAlign.CENTER
        });
        actionWidthFrame.add_child(column);
        const actionFrame = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            x_expand: true
        });
        actionFrame.add_child(actionWidthFrame);
        this._actionFrame = actionFrame;
        this._actionWidthFrame = actionWidthFrame;
        this._actionColumn = column;
        actionFrame.connect(
            "notify::allocation",
            () => this._syncActionColumnCentering()
        );
        if (this._actionColumnWidth > 0) {
            this._setActionColumnWidth(this._actionColumnWidth);
        }
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
            true,
            () => {
                if (chatGptApp) {
                    this._launchChatGptApp(chatGptApp);
                    return;
                }
                this._showInstallHelp(
                    "Install ChatGPT App",
                    "The ChatGPT desktop app was not found. OpenAI provides it for supported " +
                        "Linux distributions.",
                    CHATGPT_LINUX_INSTALL_URL
                );
            }
        );
        this._codexButton = this._createLaunchButton(
            "Codex CLI",
            { fileName: "codex.png" },
            true,
            () => {
                if (codexCommand) {
                    this._launchCodexTerminal(codexCommand);
                    return;
                }
                this._showInstallHelp(
                    "Install Codex CLI",
                    "The Codex CLI was not found. Follow OpenAI's official getting-started " +
                        "guide to install it, sign in, and then refresh this applet.",
                    CODEX_CLI_INSTALL_URL
                );
            }
        );
        const refreshConfirmed = this._refreshConfirmed;
        this._refreshButton = this._createLaunchButton(
            refreshConfirmed ? "Updated" : "Refresh now",
            {
                iconName: refreshConfirmed
                    ? "emblem-ok-symbolic"
                    : "view-refresh-symbolic",
                symbolic: true,
                compact: true,
                keepMenuOpen: true,
                success: refreshConfirmed
            },
            true,
            () => this._refreshUsage(true)
        );
        this._refreshButtonIcon = this._refreshButton._usageIcon;
        this._refreshButtonLabel = this._refreshButton._usageLabel;
        this._refreshSpinnerLabel = new St.Label({
            text: "◐",
            width: 18,
            height: 18,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER
        });
        this._refreshSpinnerLabel.style = "font-size: 16px; text-align: center;";
        this._refreshSpinnerLabel.clutter_text.set_line_alignment(
            Pango.Alignment.CENTER
        );
        this._refreshSpinnerLabel.hide();
        this._refreshButton._usageContent.insert_child_at_index(
            this._refreshSpinnerLabel,
            0
        );
        this._syncRefreshButtonState();
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
            "ChatGPT",
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
            "Codex Cloud",
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
        utilityRow.add_child(this._refreshButton);
        utilityRow.add_child(analyticsButton);
        webRow.add_child(chatGptWebButton);
        webRow.add_child(codexCloudButton);
        column.add_child(launchRow);
        column.add_child(utilityRow);
        column.add_child(webRow);
        item.addActor(actionFrame, { span: -1, expand: true });
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
        const buttonLabel = new St.Label({
            text: label,
            y_align: Clutter.ActorAlign.CENTER
        });
        if (iconSpec.success) {
            icon.style = "color: #8ed891;";
            buttonLabel.style = "color: #8ed891; font-weight: bold;";
        }
        content.add_child(buttonLabel);

        const button = new St.Button({
            child: content,
            style_class: "notification-button",
            reactive: available,
            can_focus: available,
            x_expand: true
        });
        button._usageIcon = icon;
        button._usageLabel = buttonLabel;
        button._usageContent = content;
        button._usageBusy = false;
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
                if (button._usageBusy) return Clutter.EVENT_PROPAGATE;
                button.style = this._launchButtonStyle(
                    "hover",
                    iconSpec.compact,
                    iconSpec.transparent
                );
                return Clutter.EVENT_PROPAGATE;
            });
            button.connect("leave-event", () => {
                if (button._usageBusy) return Clutter.EVENT_PROPAGATE;
                button.style = this._launchButtonStyle(
                    "normal",
                    iconSpec.compact,
                    iconSpec.transparent
                );
                return Clutter.EVENT_PROPAGATE;
            });
            button.connect("button-press-event", () => {
                if (button._usageBusy) return Clutter.EVENT_PROPAGATE;
                button.style = this._launchButtonStyle(
                    "pressed",
                    iconSpec.compact,
                    iconSpec.transparent
                );
                return Clutter.EVENT_PROPAGATE;
            });
            button.connect("button-release-event", () => {
                if (button._usageBusy) return Clutter.EVENT_PROPAGATE;
                button.style = this._launchButtonStyle(
                    "hover",
                    iconSpec.compact,
                    iconSpec.transparent
                );
                return Clutter.EVENT_PROPAGATE;
            });
            button.connect("clicked", () => {
                if (button._usageBusy) return;
                if (!iconSpec.keepMenuOpen) this.menu.close(false);
                action();
            });
        }
        return button;
    }

    _syncRefreshButtonState() {
        const button = this._refreshButton;
        const icon = this._refreshButtonIcon;
        const label = this._refreshButtonLabel;
        const spinner = this._refreshSpinnerLabel;
        if (!button || !icon || !label || !spinner) return;

        if (this._busy) {
            label.set_text("Updating…");
            label.style = null;
            icon.hide();
            spinner.show();
            button._usageBusy = true;
            button.reactive = true;
            button.can_focus = false;
            button.opacity = 255;
            button.add_style_pseudo_class("insensitive");
            button.style = this._launchButtonStyle("disabled", true, false);
            this._startRefreshSpinner(spinner);
            return;
        }

        this._stopRefreshSpinner();
        spinner.hide();
        icon.show();
        icon.icon_name = this._refreshConfirmed
            ? "emblem-ok-symbolic"
            : "view-refresh-symbolic";
        icon.icon_type = St.IconType.SYMBOLIC;
        label.set_text(this._refreshConfirmed ? "Updated" : "Refresh now");
        const successStyle = this._refreshConfirmed
            ? "color: #8ed891; font-weight: bold;"
            : "";
        icon.style = this._refreshConfirmed ? "color: #8ed891;" : null;
        label.style = successStyle || null;
        button._usageBusy = this._refreshConfirmed;
        button.reactive = true;
        button.can_focus = !this._refreshConfirmed;
        button.opacity = 255;
        button.remove_style_pseudo_class("insensitive");
        button.style = this._launchButtonStyle("normal", true, false);
    }

    _startRefreshSpinner(spinner) {
        this._stopRefreshSpinner();
        const frames = ["◐", "◓", "◑", "◒"];
        this._refreshSpinnerFrame = 0;
        spinner.set_text(frames[0]);
        this._refreshSpinnerTimeoutId = Mainloop.timeout_add(120, () => {
            if (this._destroyed || spinner.is_finalized()) {
                this._refreshSpinnerTimeoutId = 0;
                return GLib.SOURCE_REMOVE;
            }
            this._refreshSpinnerFrame = (this._refreshSpinnerFrame + 1) % frames.length;
            spinner.set_text(frames[this._refreshSpinnerFrame]);
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopRefreshSpinner() {
        if (!this._refreshSpinnerTimeoutId) return;
        Mainloop.source_remove(this._refreshSpinnerTimeoutId);
        this._refreshSpinnerTimeoutId = 0;
    }

    _showInstallHelp(title, description, url) {
        if (this._installHelpDialog) this._installHelpDialog.destroy();

        const dialog = new ModalDialog.ModalDialog();
        const content = new Dialog.MessageDialogContent({ title, description });
        dialog.contentLayout.add_child(content);
        const close = () => {
            dialog.destroy();
            if (this._installHelpDialog === dialog) this._installHelpDialog = null;
        };
        dialog.setButtons([
            {
                label: "Close",
                action: close,
                key: Clutter.KEY_Escape
            },
            {
                label: "Open installation guide",
                action: () => {
                    close();
                    Util.spawn(["xdg-open", url]);
                },
                default: true
            }
        ]);
        this._installHelpDialog = dialog;
        dialog.open();
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
            this._reportLaunchError("Codex CLI", error);
        }
    }

    _reportLaunchError(target, error) {
        this._lastError = `Could not open ${target}`;
        global.logError(`${UUID}: ${this._lastError}: ${error}`);
        this._rebuildMenu();
    }

    _addInfoItem(text, style = null, menu = this.menu) {
        const item = new PopupMenu.PopupMenuItem(text, { reactive: false });
        if (style) item.label.style = style;
        menu.addMenuItem(item);
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
        const windowsByLimit = new Map();
        for (const window of history.windows) {
            const limitId = window.id || "codex";
            if (!windowsByLimit.has(limitId)) windowsByLimit.set(limitId, []);
            windowsByLimit.get(limitId).push(window);
        }
        const showLimitLabels = windowsByLimit.size > 1;
        for (const [limitId, windows] of windowsByLimit) {
            if (showLimitLabels && limitId !== "codex") {
                const first = windows[0];
                const submenu = new PopupMenu.PopupSubMenuMenuItem(
                    ""
                );
                submenu.actor.style = `padding-right: ${POPUP_RIGHT_INSET}px;`;
                submenu._triangle.translation_x = POPUP_SUBMENU_ARROW_OFFSET;
                this._submenuTriangles.push(submenu._triangle);
                if ("overlay_scrollbars" in submenu.menu.actor) {
                    submenu.menu.actor.overlay_scrollbars = true;
                }
                submenu.removeActor(submenu.label);
                submenu.label.destroy();
                const submenuTitle = new St.BoxLayout({
                    vertical: false,
                    y_align: Clutter.ActorAlign.CENTER
                });
                submenuTitle.style = "spacing: 6px;";
                submenuTitle.add_child(
                    this._createPanelIcon({ id: limitId, label: first.label }, 18)
                );
                const submenuLabel = new St.Label({
                    text: first.label || first.id,
                    y_align: Clutter.ActorAlign.CENTER
                });
                submenuLabel.style = "font-weight: bold;";
                submenuLabel.opacity = 128;
                submenuTitle.add_child(submenuLabel);
                submenu.addActor(submenuTitle, { position: 0 });
                submenu.label = submenuLabel;
                submenu.actor.label_actor = submenuLabel;
                this.menu.addMenuItem(submenu);
                this._historySubmenus.push({ id: limitId, submenu });
                submenu.menu.connect("open-state-changed", () => {
                    this._syncPopupRightInsets();
                });
                windows.forEach((window, index) => {
                    if (index > 0) {
                        submenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                    }
                    this._addHistoryWindow(window, history, submenu.menu, false);
                });
                continue;
            }
            for (const window of windows) {
                this._addHistoryWindow(window, history, this.menu, showLimitLabels);
            }
        }
    }

    _addHistoryWindow(window, history, menu, showLimitLabel) {
        const duration = UsageFormat.formatDuration(window.durationMinutes);
        const periods = window.periods || {};
        const oneHour = UsageFormat.formatConsumedPercent(periods["1h"]);
        const fourHours = UsageFormat.formatConsumedPercent(periods["4h"]);
        const twelveHours = UsageFormat.formatConsumedPercent(periods["12h"]);
        const today = UsageFormat.formatConsumedPercent(periods.today);
        const hasPartialPeriod = Object.values(periods).some(
            period => period && period.complete === false
        );
        const labelPrefix = showLimitLabel ? `${window.label || window.id} · ` : "";

        this._addInfoItem(
            `  ${labelPrefix}${duration} usage`,
            "font-weight: bold;",
            menu
        );
        this._addInfoItem(`    1h ${oneHour}  ·  4h ${fourHours}`, null, menu);
        this._addInfoItem(`    12h ${twelveHours}  ·  Today ${today}`, null, menu);
        this._addActivityChart(
            window.activity24h,
            history.activityBucketMinutes,
            history.activityEndAt || this._snapshot.updatedAt,
            menu
        );
        if (hasPartialPeriod) {
            const trackedSinceSeconds = window.trackedSince || history.trackedSince;
            const trackedSince = UsageFormat.formatTimestamp(
                trackedSinceSeconds,
                this._use24HourClock
            );
            const trackedDuration = UsageFormat.formatElapsedDuration(
                trackedSinceSeconds,
                this._snapshot.updatedAt
            );
            this._addInfoItem(
                `    ~ collecting since ${trackedSince} (${trackedDuration})`,
                null,
                menu
            );
        }
    }

    _addActivityChart(values, bucketMinutes, endAt, menu = this.menu) {
        const model = UsageFormat.buildActivityChart(values);
        if (model.bars.length === 0) return;

        const bucketLabel = UsageFormat.formatDuration(bucketMinutes);
        const peakLabel = model.knownCount > 0
            ? UsageFormat.formatConsumedPercent({
                consumedPercent: model.peakPercent,
                complete: model.peakComplete
            })
            : "—";
        const totalLabel = model.knownCount > 0
            ? UsageFormat.formatPercent(model.totalPercent)
            : "—";
        const item = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            activate: false
        });
        const column = new St.BoxLayout({ vertical: true, x_expand: true });
        column.style = "padding: 2px 0 1px 0;";

        const caption = new St.BoxLayout({
            vertical: false
        });
        const captionTitle = new St.Label({ text: "  24h Activity" });
        captionTitle.style = "font-weight: bold;";
        const captionDetails = new St.Label({
            text: `  ·  ${totalLabel}  ·  ${bucketLabel} buckets  ·  peak ${peakLabel}`
        });
        caption.add_child(captionTitle);
        caption.add_child(captionDetails);
        column.add_child(caption);

        const chart = new St.BoxLayout({ vertical: true, x_expand: true });
        chart.style = [
            "padding-left: 10px",
            `padding-right: ${POPUP_CHART_RIGHT_INSET}px`
        ].join("; ") + ";";
        this._activityCharts.push({
            chart,
            nested: menu !== this.menu
        });

        const plot = new St.Widget({
            layout_manager: new Clutter.BoxLayout({ homogeneous: true }),
            height: 30,
            x_expand: true
        });
        plot.style = "border-bottom: 1px solid rgba(255,255,255,0.28); padding-top: 2px;";
        model.bars.forEach((bar, index) => {
            const slot = new St.Bin({
                height: 28,
                reactive: true,
                track_hover: true,
                x_expand: true
            });
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
            const barWidth = model.bars.length >= 24 ? 8 : 14;
            const barActor = new St.Widget({ width: barWidth, height, style });
            if (bar.partial) barActor.opacity = 155;
            slot.set_child(barActor);
            const tooltipText = UsageFormat.formatActivityBucketTooltip(
                bar,
                index,
                model.bars.length,
                bucketMinutes,
                endAt,
                this._use24HourClock
            );
            slot.accessible_name = UsageFormat.formatAccessibleTooltip(tooltipText);
            this._activityTooltips.push(
                this._createActivityTooltip(slot, tooltipText)
            );
            plot.add_child(slot);
        });
        chart.add_child(plot);

        const axis = new St.Widget({
            layout_manager: new Clutter.BoxLayout({ homogeneous: true }),
            x_expand: true
        });
        const labelsByAxisSlot = new Map([
            [0, "−24h"],
            [3, "−18h"],
            [6, "−12h"],
            [9, "−6h"],
            [11, "now"]
        ]);
        for (let index = 0; index < 12; index++) {
            const segment = new St.Bin({ x_expand: true });
            segment.set_alignment(St.Align.MIDDLE, St.Align.MIDDLE);
            const labelText = labelsByAxisSlot.get(index);
            if (labelText) {
                const label = new St.Label({ text: labelText });
                label.style = "font-size: 75%; color: rgba(255,255,255,0.62);";
                segment.set_child(label);
            }
            axis.add_child(segment);
        }
        chart.add_child(axis);
        column.add_child(chart);

        item.addActor(column, { span: -1, expand: true });
        menu.addMenuItem(item);
    }

    _syncPopupRightInsets() {
        const expanded = this._historySubmenus.some(
            entry => entry.submenu.menu.isOpen
        );
        const extra = expanded ? POPUP_EXPANDED_RIGHT_INSET : 0;
        for (const row of this._popupRightInsetRows) {
            row.style = `padding-right: ${POPUP_RIGHT_INSET + extra}px;`;
        }
        for (const entry of this._activityCharts) {
            const nestedExtra = expanded && entry.nested
                ? POPUP_EXPANDED_RIGHT_INSET
                : 0;
            entry.chart.style = [
                "padding-left: 10px",
                `padding-right: ${POPUP_CHART_RIGHT_INSET + extra + nestedExtra}px`
            ].join("; ") + ";";
        }
        for (const triangle of this._submenuTriangles) {
            triangle.translation_x = POPUP_SUBMENU_ARROW_OFFSET - (
                expanded ? POPUP_EXPANDED_ARROW_INSET : 0
            );
        }
    }

    _createActivityTooltip(slot, text) {
        const tooltip = new Tooltips.Tooltip(slot, text);
        tooltip.set_text(text);
        const nativeShow = tooltip.show.bind(tooltip);
        tooltip.show = () => {
            nativeShow();
            if (!tooltip.visible || !tooltip.mousePosition) return;

            const monitor = Main.layoutManager.findMonitorForActor(slot);
            const [, naturalWidth] = tooltip._tooltip.get_preferred_width(-1);
            const [, naturalHeight] = tooltip._tooltip.get_preferred_height(
                naturalWidth
            );
            const cursorSize = tooltip.desktop_settings.get_int("cursor-size");
            const preferredLeft = tooltip.mousePosition[0] + Math.round(
                cursorSize / 2
            );
            const preferredTop = tooltip.mousePosition[1] + Math.round(
                cursorSize / 1.5
            );
            const left = Math.max(
                monitor.x,
                Math.min(
                    preferredLeft,
                    monitor.x + monitor.width - naturalWidth
                )
            );
            const top = Math.max(
                monitor.y,
                Math.min(
                    preferredTop,
                    monitor.y + monitor.height - naturalHeight
                )
            );
            tooltip._tooltip.set_position(Math.floor(left), Math.floor(top));
        };
        tooltip._fastShowTimeoutId = 0;
        const cancelFastShow = () => {
            if (!tooltip._fastShowTimeoutId) return;
            Mainloop.source_remove(tooltip._fastShowTimeoutId);
            tooltip._fastShowTimeoutId = 0;
        };
        slot.connect("enter-event", () => {
            cancelFastShow();
            tooltip._fastShowTimeoutId = Mainloop.timeout_add(
                ACTIVITY_TOOLTIP_DELAY_MS,
                () => {
                    tooltip._fastShowTimeoutId = 0;
                    if (!slot.has_pointer || tooltip.visible) return GLib.SOURCE_REMOVE;
                    if (tooltip._showTimer) {
                        Mainloop.source_remove(tooltip._showTimer);
                        tooltip._showTimer = null;
                    }
                    tooltip.show();
                    return GLib.SOURCE_REMOVE;
                }
            );
            return Clutter.EVENT_PROPAGATE;
        });
        slot.connect("leave-event", () => {
            cancelFastShow();
            return Clutter.EVENT_PROPAGATE;
        });
        slot.connect("destroy", () => {
            cancelFastShow();
        });
        return tooltip;
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

    _restartCountdownTimer() {
        if (this._countdownTimeoutId) {
            Mainloop.source_remove(this._countdownTimeoutId);
            this._countdownTimeoutId = 0;
        }
        this._countdownTimeoutId = Mainloop.timeout_add_seconds(1, () => {
            if (this.menu && this.menu.isOpen) {
                this._updateResetCountdowns();
                this._updateRelativeTime();
            }
            return GLib.SOURCE_CONTINUE;
        });
    }

    _refreshUsage(showConfirmation = false) {
        if (this._destroyed || this._busy) return;

        const python = GLib.find_program_in_path("python3");
        const helper = `${this.metadata.path}/chatgpt_usage.py`;
        const codex = this._resolveCodexPath();
        if (!python || !codex) {
            this._lastError = !python
                ? "python3 was not found"
                : "Codex CLI was not found; configure its path in the applet settings";
            this._rebuildPanel();
            this._scheduleMenuRebuild();
            return;
        }

        this._busy = true;
        this._lastError = null;
        this._cancellable = new Gio.Cancellable();
        this._syncRefreshButtonState();
        if (!this._snapshot) this._rebuildPanel();

        try {
            const process = new Gio.Subprocess({
                argv: [
                    python,
                    helper,
                    "--codex",
                    codex,
                    "--timeout",
                    "25",
                    "--activity-bucket-minutes",
                    String(this.activityBucketMinutes) === "120" ? "120" : "60"
                ],
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            });
            process.init(null);
            process.communicate_utf8_async(null, this._cancellable, (source, result) => {
                this._busy = false;
                this._cancellable = null;
                this._stopRefreshSpinner();
                let succeeded = false;

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
                    succeeded = true;
                } catch (error) {
                    const cancelled = error.matches &&
                        error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED);
                    if (!cancelled) {
                        this._lastError = String(error.message || error).slice(0, 180);
                        global.logError(`${UUID}: usage refresh failed: ${error}`);
                    }
                }

                if (!this._destroyed) {
                    if (showConfirmation && succeeded) this._showRefreshConfirmation();
                    this._rebuildPanel();
                    this._scheduleMenuRebuild();
                }
            });
        } catch (error) {
            this._busy = false;
            this._cancellable = null;
            this._stopRefreshSpinner();
            this._lastError = String(error.message || error).slice(0, 180);
            global.logError(`${UUID}: could not start usage helper: ${error}`);
            this._rebuildPanel();
            this._scheduleMenuRebuild();
        }
    }

    _showRefreshConfirmation() {
        this._refreshConfirmed = true;
        if (this._refreshConfirmationTimeoutId) {
            Mainloop.source_remove(this._refreshConfirmationTimeoutId);
        }
        this._stopRefreshSpinner();
        this._syncRefreshButtonState();
        this._refreshConfirmationTimeoutId = Mainloop.timeout_add(1800, () => {
            this._refreshConfirmationTimeoutId = 0;
            this._refreshConfirmed = false;
            if (!this._destroyed) this._syncRefreshButtonState();
            return GLib.SOURCE_REMOVE;
        });
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
        this._isRightPanel = this._orientationIsRight(orientation);
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

    _applyRightPanelPopupWidth() {
        if (!this._isRightPanel || !this.menu) return;
        const naturalWidth = this.menu.actor.get_preferred_width(-1)[1];
        const width = Math.max(0, Math.ceil(naturalWidth) + POPUP_RIGHT_PANEL_WIDTH_BUMP);
        if (!width) return;
        const baseStyle = this._rightPanelMenuStyleBase
            ? `${this._rightPanelMenuStyleBase}; `
            : "";
        this.menu.actor.style = `${baseStyle}min-width: ${width}px;`;
        this.menu.actor.translation_x = 0;
    }

    _normalizeRightPanelPopupCloseWidth() {
        if (!this._isRightPanel || !this.menu) return;
        const naturalWidth = this.menu.actor.get_preferred_width(-1)[1];
        const normalizedWidth = Math.max(0, Math.ceil(naturalWidth));
        this.menu.actor.style = this._rightPanelMenuStyleBase;
        this.menu.actor.translation_x = 0;
        if (normalizedWidth > 0) {
            this.menu.actor.set_width(normalizedWidth);
            return;
        }
        this.menu.actor.set_width(-1);
    }

    _orientationIsVertical(orientation) {
        return orientation === St.Side.LEFT || orientation === St.Side.RIGHT;
    }

    _orientationIsRight(orientation) {
        return orientation === St.Side.RIGHT;
    }

    on_applet_removed_from_panel() {
        this._destroyed = true;
        if (this._timeoutId) {
            Mainloop.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        if (this._countdownTimeoutId) {
            Mainloop.source_remove(this._countdownTimeoutId);
            this._countdownTimeoutId = 0;
        }
        if (this._refreshConfirmationTimeoutId) {
            Mainloop.source_remove(this._refreshConfirmationTimeoutId);
            this._refreshConfirmationTimeoutId = 0;
        }
        if (this._rightPanelPopupClosedId) {
            this.menu.disconnect(this._rightPanelPopupClosedId);
            this._rightPanelPopupClosedId = 0;
        }
        if (this._rightPanelPopupOpenStateChangedId) {
            this.menu.disconnect(this._rightPanelPopupOpenStateChangedId);
            this._rightPanelPopupOpenStateChangedId = 0;
        }
        if (this._menuRebuildTimeoutId) {
            Mainloop.source_remove(this._menuRebuildTimeoutId);
            this._menuRebuildTimeoutId = 0;
        }
        this._stopRefreshSpinner();
        if (this._cancellable) {
            this._cancellable.cancel();
            this._cancellable = null;
        }
        if (this._installHelpDialog) {
            this._installHelpDialog.destroy();
            this._installHelpDialog = null;
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
