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

function formatElapsedDuration(startSeconds, endSeconds) {
    const start = Number(startSeconds);
    const end = Number(endSeconds);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "?";

    const totalMinutes = Math.floor((end - start) / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes}m`;
    return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
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

function buildResetCountdown(window, nowSeconds = null) {
    const durationSeconds = Number(window && window.durationMinutes) * 60;
    const resetsAt = Number(window && window.resetsAt);
    const currentSeconds = nowSeconds === null
        ? GLib.get_real_time() / 1000000
        : Number(nowSeconds);
    if (
        !Number.isFinite(durationSeconds) || durationSeconds <= 0 ||
        !Number.isFinite(resetsAt) || resetsAt <= 0 ||
        !Number.isFinite(currentSeconds)
    ) {
        return {
            valid: false,
            fractionRemaining: 0,
            fractionElapsed: 0,
            remainingSeconds: null,
            primary: "--",
            secondary: "",
            label: "--"
        };
    }

    const remainingSeconds = clamp(
        Math.ceil(resetsAt - currentSeconds),
        0,
        durationSeconds
    );
    let primary = "now";
    let secondary = "";
    if (remainingSeconds >= 86400) {
        primary = `${Math.floor(remainingSeconds / 86400)}d`;
        secondary = `${Math.floor((remainingSeconds % 86400) / 3600)}h`;
    } else if (remainingSeconds >= 3600) {
        primary = `${Math.floor(remainingSeconds / 3600)}h`;
        secondary = `${Math.floor((remainingSeconds % 3600) / 60)}m`;
    } else if (remainingSeconds >= 60) {
        primary = `${Math.floor(remainingSeconds / 60)}m`;
        secondary = `${remainingSeconds % 60}s`;
    } else if (remainingSeconds > 0) {
        primary = `${remainingSeconds}s`;
    }

    const fractionRemaining = remainingSeconds / durationSeconds;
    return {
        valid: true,
        fractionRemaining,
        fractionElapsed: 1 - fractionRemaining,
        remainingSeconds,
        primary,
        secondary,
        label: secondary ? `${primary}\n${secondary}` : primary
    };
}

function buildQuotaIndicator(window) {
    const durationMinutes = Number(window && window.durationMinutes);
    const remainingPercent = Number(window && window.remainingPercent);
    if (
        !Number.isFinite(durationMinutes) || durationMinutes <= 0 ||
        !Number.isFinite(remainingPercent)
    ) {
        return {
            valid: false,
            fractionRemaining: 0,
            durationLabel: "?",
            percentLabel: "--"
        };
    }
    const remaining = clamp(remainingPercent, 0, 100);
    return {
        valid: true,
        fractionRemaining: remaining / 100,
        durationLabel: formatDuration(durationMinutes),
        percentLabel: formatPercent(remaining)
    };
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

function formatActivityBucketTooltip(
    bar,
    index,
    bucketCount,
    bucketMinutes,
    endAt,
    use24Hour
) {
    const count = Number(bucketCount);
    const position = Number(index);
    const seconds = Number(bucketMinutes) * 60;
    const endSeconds = Number(endAt);
    if (
        !bar || !Number.isFinite(count) || count <= 0 ||
        !Number.isFinite(position) || position < 0 || position >= count ||
        !Number.isFinite(seconds) || seconds <= 0 ||
        !Number.isFinite(endSeconds) || endSeconds <= 0
    ) {
        return "Activity details unavailable";
    }

    const bucketStart = endSeconds - ((count - position) * seconds);
    const bucketEnd = bucketStart + seconds;
    const start = GLib.DateTime.new_from_unix_local(Math.floor(bucketStart));
    const end = GLib.DateTime.new_from_unix_local(Math.floor(bucketEnd));
    const timeFormat = use24Hour === false ? "%I:%M %p" : "%H:%M";
    const sameDay = start.format("%F") === end.format("%F");
    const range = sameDay
        ? `${start.format("%a")} ${start.format(timeFormat)}–${end.format(timeFormat)}`
        : `${start.format("%a")} ${start.format(timeFormat)}–` +
            `${end.format("%a")} ${end.format(timeFormat)}`;
    if (!bar.known) return `${range}\nNo observed data`;

    const consumed = formatConsumedPercent({
        consumedPercent: bar.consumedPercent,
        complete: bar.complete
    });
    return `${range}\n${consumed} consumed${bar.partial ? " · partial bucket" : ""}`;
}

function formatAccessibleTooltip(text) {
    return String(text || "").replace(/\n/g, ". ");
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
    formatElapsedDuration,
    formatPercent,
    formatConsumedPercent,
    buildResetCountdown,
    buildQuotaIndicator,
    buildActivityChart,
    formatActivityBucketTooltip,
    formatAccessibleTooltip,
    formatTimestamp
};
