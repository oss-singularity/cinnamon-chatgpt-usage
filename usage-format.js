// SPDX-License-Identifier: GPL-3.0-or-later

/* global imports */

const GLib = imports.gi.GLib;

function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}

function summarizeWindows(limits) {
    const summaries = new Map();

    for (const limit of limits || []) {
        for (const window of limit.windows || []) {
            const duration = Number(window.durationMinutes);
            const remaining = Number(window.remainingPercent);
            if (!Number.isFinite(duration) || !Number.isFinite(remaining)) continue;

            const current = summaries.get(duration);
            if (!current || remaining < current.remainingPercent) {
                summaries.set(duration, {
                    durationMinutes: duration,
                    remainingPercent: clamp(remaining, 0, 100),
                    resetsAt: Number(window.resetsAt) || null,
                    limitId: limit.id,
                    limitLabel: limit.label
                });
            }
        }
    }

    return Array.from(summaries.values()).sort(
        (left, right) => left.durationMinutes - right.durationMinutes
    );
}

function selectPanelWindows(summaries, showWeeklyWithFiveHour) {
    const windows = Array.from(summaries || []);
    const hasFiveHour = windows.some(window => window.durationMinutes === 300);
    if (showWeeklyWithFiveHour !== false || !hasFiveHour) return windows;
    return windows.filter(window => window.durationMinutes !== 10080);
}

function formatDuration(minutes) {
    const value = Number(minutes);
    if (!Number.isFinite(value) || value <= 0) return "?";
    if (value % 1440 === 0) return `${value / 1440}d`;
    if (value % 60 === 0) return `${value / 60}h`;
    return `${Math.round(value)}m`;
}

function formatPercent(value) {
    const number = Number(value);
    return Number.isFinite(number) ? `${Math.round(clamp(number, 0, 100))}%` : "--";
}

function formatConsumedPercent(period) {
    if (!period || !Number.isFinite(Number(period.consumedPercent))) return "--";
    const value = Math.max(0, Number(period.consumedPercent));
    const rounded = value < 10 && Math.abs(value - Math.round(value)) >= 0.05
        ? value.toFixed(1)
        : String(Math.round(value));
    return `${period.complete === false ? "~" : ""}${rounded}%`;
}

function buildActivityChart(values) {
    const source = Array.isArray(values) ? values : [];
    const known = source
        .filter(value => value !== null && value !== undefined)
        .map(value => Number(value))
        .filter(value => Number.isFinite(value) && value >= 0);
    const peakPercent = known.length > 0 ? Math.max(...known) : 0;
    const bars = source.map(value => {
        if (value === null || value === undefined || !Number.isFinite(Number(value))) {
            return { known: false, consumedPercent: null, intensity: null };
        }
        const consumedPercent = Math.max(0, Number(value));
        const intensity = consumedPercent <= 0 || peakPercent <= 0
            ? 0
            : Math.max(1, Math.ceil((consumedPercent / peakPercent) * 7));
        return { known: true, consumedPercent, intensity };
    });
    return { peakPercent, knownCount: known.length, bars };
}

function formatTimestamp(epochSeconds, use24Hour) {
    const seconds = Number(epochSeconds);
    if (!Number.isFinite(seconds) || seconds <= 0) return "unknown";
    const dateTime = GLib.DateTime.new_from_unix_local(Math.floor(seconds));
    const timeFormat = use24Hour === false ? "%I:%M:%S %p" : "%H:%M:%S";
    return dateTime.format(`%x ${timeFormat}`);
}

module.exports = {
    summarizeWindows,
    selectPanelWindows,
    formatDuration,
    formatPercent,
    formatConsumedPercent,
    buildActivityChart,
    formatTimestamp
};
