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
    const bars = source.map(value => {
        const structured = value !== null && typeof value === "object";
        const numeric = structured ? Number(value.consumedPercent) : Number(value);
        if (value === null || value === undefined || !Number.isFinite(numeric)) {
            return {
                known: false,
                complete: false,
                partial: false,
                consumedPercent: null,
                intensity: null
            };
        }
        const consumedPercent = Math.max(0, numeric);
        const complete = structured ? value.complete !== false : true;
        const partial = !complete && consumedPercent > 0;
        return {
            known: complete || partial,
            complete,
            partial,
            consumedPercent,
            intensity: null
        };
    });
    const known = bars.filter(bar => bar.known);
    const peakPercent = known.length > 0
        ? Math.max(...known.map(bar => bar.consumedPercent))
        : 0;
    bars.forEach(bar => {
        if (!bar.known) return;
        const intensity = bar.consumedPercent <= 0 || peakPercent <= 0
            ? 0
            : Math.max(1, Math.ceil((bar.consumedPercent / peakPercent) * 7));
        bar.intensity = intensity;
    });
    const peakComplete = known.some(
        bar => bar.consumedPercent === peakPercent && bar.complete
    );
    return { peakPercent, peakComplete, knownCount: known.length, bars };
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
