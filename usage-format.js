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

function listQuotaWindows(limits) {
    const windows = [];
    const sourceLimits = Array.from(limits || []);
    const orderedLimits = sourceLimits
        .filter(limit => limit.id !== "codex")
        .concat(sourceLimits.filter(limit => limit.id === "codex"));

    for (const limit of orderedLimits) {
        const limitWindows = [];
        for (const window of limit.windows || []) {
            const duration = Number(window.durationMinutes);
            const remaining = Number(window.remainingPercent);
            if (!Number.isFinite(duration) || !Number.isFinite(remaining)) continue;

            limitWindows.push({
                durationMinutes: duration,
                remainingPercent: clamp(remaining, 0, 100),
                resetsAt: Number(window.resetsAt) || null,
                limitId: limit.id,
                limitLabel: limit.label
            });
        }
        limitWindows.sort((left, right) => left.durationMinutes - right.durationMinutes);
        windows.push(...limitWindows);
    }

    return windows;
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

    const remainingPercent = Number(window && window.remainingPercent);
    const remainingSeconds = Number.isFinite(remainingPercent) && remainingPercent >= 100
        ? durationSeconds
        : clamp(Math.ceil(resetsAt - currentSeconds), 0, durationSeconds);
    let primary = "now";
    let secondary = "";
    if (remainingSeconds >= 86400) {
        primary = `${Math.floor(remainingSeconds / 86400)}d`;
        const remainingHours = Math.floor((remainingSeconds % 86400) / 3600);
        secondary = remainingHours > 0 ? `${remainingHours}h` : "";
    } else if (remainingSeconds >= 3600) {
        primary = `${Math.floor(remainingSeconds / 3600)}h`;
        const remainingMinutes = Math.floor((remainingSeconds % 3600) / 60);
        secondary = remainingMinutes > 0 ? `${remainingMinutes}m` : "";
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
                estimated: false,
                consumedPercent: null,
                intensity: null
            };
        }
        const consumedPercent = Math.max(0, numeric);
        const complete = structured ? value.complete !== false : true;
        const observed = structured && typeof value.observed === "boolean"
            ? value.observed
            : complete || consumedPercent > 0;
        const partial = !complete && observed;
        const estimated = structured && value.estimated === true;
        return {
            known: observed,
            complete,
            partial,
            estimated,
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
        const intensity = bar.estimated && bar.consumedPercent > 0
            ? 1
            : bar.consumedPercent <= 0 || peakPercent <= 0
            ? 0
            : Math.max(1, Math.ceil((bar.consumedPercent / peakPercent) * 7));
        bar.intensity = intensity;
    });
    const peakComplete = known.some(
        bar => bar.consumedPercent === peakPercent && bar.complete
    );
    const totalPercent = known.reduce(
        (total, bar) => total + bar.consumedPercent,
        0
    );
    const totalComplete = bars.length > 0 && bars.every(
        bar => bar.known && bar.complete
    );
    const totalEstimated = known.some(bar => bar.estimated);
    return {
        peakPercent,
        peakComplete,
        totalPercent,
        totalComplete,
        totalEstimated,
        knownCount: known.length,
        bars
    };
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
        complete: bar.complete && !bar.estimated
    });
    const partialSuffix = bar.partial && position < count - 1
        ? " · partial bucket"
        : "";
    const estimatedSuffix = bar.estimated ? " · estimated" : "";
    return `${range}\n${consumed} consumed${partialSuffix}${estimatedSuffix}`;
}

function formatAccessibleTooltip(text) {
    return String(text || "").replace(/\n/g, ". ");
}

function formatWholeNumber(value) {
    if (value === null || value === undefined || value === "") return "unavailable";
    const numeric = Number(value);
    return Number.isFinite(numeric) ? String(Math.round(numeric)) : String(value);
}

function parseUsageHelperError(value) {
    const message = String(value || "Usage helper failed").trim();
    const prefix = "AUTH_REQUIRED:";
    if (message.startsWith(prefix)) {
        return {
            authenticationRequired: true,
            message: message.slice(prefix.length).trim()
        };
    }
    return { authenticationRequired: false, message };
}

function hasRecentActivity(activity24h) {
    if (!Array.isArray(activity24h)) return false;
    return activity24h.some(bucket => {
        const consumed = typeof bucket === "object" && bucket !== null
            ? Number(bucket.consumedPercent)
            : Number(bucket);
        return Number.isFinite(consumed) && consumed > 0;
    });
}

function historyPeriodKeys(durationMinutes) {
    return Number(durationMinutes) <= 300
        ? ["1h", "4h", "24h"]
        : ["1h", "4h", "12h", "today"];
}

function buildActivityTotalPeriod(activity24h) {
    const chart = buildActivityChart(activity24h);
    return {
        consumedPercent: chart.totalPercent,
        complete: chart.totalComplete
    };
}

function activityValue(bucket) {
    const value = typeof bucket === "object" && bucket !== null
        ? Number(bucket.consumedPercent)
        : Number(bucket);
    return Number.isFinite(value) ? Math.max(0, value) : null;
}

function buildSharedActivityValues(windows, shortToWeeklyScale = 0.5) {
    const source = Array.from(windows || []);
    if (source.length === 0) return [];
    if (source.length === 1) return Array.from(source[0].activity24h || []);
    const shortest = source.reduce((current, window) =>
        Number(window.durationMinutes) < Number(current.durationMinutes)
            ? window
            : current
    );
    const weekly = source.reduce((current, window) =>
        Number(window.durationMinutes) > Number(current.durationMinutes)
            ? window
            : current
    );
    const shortValues = Array.from(shortest.activity24h || []);
    const weeklyValues = Array.from(weekly.activity24h || []);
    return weeklyValues.map((weeklyBucket, index) => {
        const weeklyConsumed = activityValue(weeklyBucket);
        const shortBucket = shortValues[index];
        const shortConsumed = activityValue(shortBucket);
        if (
            weeklyConsumed === null || weeklyConsumed > 0 ||
            shortConsumed === null || shortConsumed <= 0
        ) {
            return weeklyBucket;
        }
        const shortComplete = typeof shortBucket === "object" && shortBucket !== null
            ? shortBucket.complete !== false
            : true;
        return {
            consumedPercent: shortConsumed * Number(shortToWeeklyScale),
            complete: shortComplete,
            observed: true,
            estimated: true
        };
    });
}

function normalizeNotificationThresholds(warning, critical) {
    const warningValue = Number(warning);
    const criticalValue = Number(critical);
    const boundedWarning = Number.isFinite(warningValue)
        ? clamp(warningValue, 1, 100)
        : 25;
    const boundedCritical = Number.isFinite(criticalValue)
        ? clamp(criticalValue, 0, 99)
        : 10;
    return {
        warning: boundedWarning,
        critical: boundedCritical,
        valid: boundedCritical < boundedWarning
    };
}

function notificationZone(remainingPercent, warning, critical) {
    const remaining = Number(remainingPercent);
    const thresholds = normalizeNotificationThresholds(warning, critical);
    if (!Number.isFinite(remaining) || !thresholds.valid) return null;
    if (remaining <= thresholds.critical) return "critical";
    if (remaining <= thresholds.warning) return "warning";
    return "normal";
}

function quotaWindowMap(snapshot) {
    const windows = new Map();
    for (const limit of snapshot && snapshot.limits || []) {
        for (const window of limit.windows || []) {
            const duration = Number(window.durationMinutes);
            if (!Number.isFinite(duration)) continue;
            windows.set(`${limit.id}:${duration}`, { limit, window, duration });
        }
    }
    return windows;
}

function isSparkLimit(limit) {
    return /spark/i.test(`${limit && limit.id || ""} ${limit && limit.label || ""}`);
}

function resetNotificationEnabled(limit, options) {
    if (options.notifyAllWeeklyResets === true) return true;
    if (isSparkLimit(limit)) return options.notifySparkWeeklyReset === true;
    return limit.id === "codex" && options.notifyCodexWeeklyReset === true;
}

function resetWasObserved(previousWindow, currentWindow) {
    const previousRemaining = Number(previousWindow.remainingPercent);
    const currentRemaining = Number(currentWindow.remainingPercent);
    const previousReset = Number(previousWindow.resetsAt);
    const currentReset = Number(currentWindow.resetsAt);
    return Number.isFinite(previousRemaining) && Number.isFinite(currentRemaining) &&
        currentRemaining > previousRemaining &&
        Number.isFinite(previousReset) && Number.isFinite(currentReset) &&
        currentReset > previousReset + 60;
}

function lowNotificationSettings(duration, options) {
    if (duration === 300 && options.enableFiveHourLowNotifications === true) {
        return {
            warning: options.fiveHourWarningRemaining,
            critical: options.fiveHourCriticalRemaining
        };
    }
    if (duration === 10080 && options.enableWeeklyLowNotifications === true) {
        return {
            warning: options.weeklyWarningRemaining,
            critical: options.weeklyCriticalRemaining
        };
    }
    return null;
}

function buildUsageNotificationEvents(previousSnapshot, snapshot, options = {}) {
    if (!previousSnapshot || !snapshot) return [];
    const previousWindows = quotaWindowMap(previousSnapshot);
    const currentWindows = quotaWindowMap(snapshot);
    const events = [];

    for (const [key, current] of currentWindows) {
        const previous = previousWindows.get(key);
        if (!previous) continue;
        const label = String(current.limit.label || current.limit.id || "Usage");

        if (
            current.duration === 10080 &&
            resetNotificationEnabled(current.limit, options) &&
            resetWasObserved(previous.window, current.window)
        ) {
            events.push({
                kind: "reset",
                limitId: current.limit.id,
                durationMinutes: current.duration,
                title: `${label} 7d limit refreshed`,
                message: `${label} weekly usage is available again.`
            });
        }

        const lowSettings = lowNotificationSettings(current.duration, options);
        if (!lowSettings) continue;
        const previousZone = notificationZone(
            previous.window.remainingPercent,
            lowSettings.warning,
            lowSettings.critical
        );
        const currentZone = notificationZone(
            current.window.remainingPercent,
            lowSettings.warning,
            lowSettings.critical
        );
        if (!previousZone || !currentZone || currentZone === "normal") continue;
        const enteredWarning = currentZone === "warning" && previousZone === "normal";
        const enteredCritical = currentZone === "critical" && previousZone !== "critical";
        if (!enteredWarning && !enteredCritical) continue;
        const durationLabel = formatDuration(current.duration);
        events.push({
            kind: "low",
            level: currentZone,
            limitId: current.limit.id,
            durationMinutes: current.duration,
            title: `${label} ${durationLabel} limit ${currentZone}`,
            message: `${label} has ${formatPercent(current.window.remainingPercent)} remaining.`
        });
    }
    return events;
}

function formatTimestamp(epochSeconds, use24Hour) {
    const seconds = Number(epochSeconds);
    if (!Number.isFinite(seconds) || seconds <= 0) return "unknown";
    const dateTime = GLib.DateTime.new_from_unix_local(Math.floor(seconds));
    const timeFormat = use24Hour === false ? "%I:%M:%S %p" : "%H:%M:%S";
    return dateTime.format(`%x ${timeFormat}`);
}

function formatExpiryCountdown(expiresAt, nowSeconds = null) {
    const expiry = Number(expiresAt);
    const current = nowSeconds === null
        ? GLib.get_real_time() / 1000000
        : Number(nowSeconds);
    if (
        !Number.isFinite(expiry) || expiry <= 0 ||
        !Number.isFinite(current)
    ) {
        return null;
    }

    const remainingSeconds = Math.max(0, Math.floor(expiry - current));
    const days = Math.floor(remainingSeconds / 86400);
    const hours = Math.floor((remainingSeconds % 86400) / 3600);
    return days > 0 ? `~${days}d${hours}h` : `~${hours}h`;
}

function buildResetCreditDisplay(credits, use24Hour, nowSeconds = null) {
    const count = credits
        ? formatWholeNumber(credits.availableResetCount)
        : "unavailable";
    const availableCount = Number(credits && credits.availableResetCount);
    if (!Number.isFinite(availableCount) || availableCount <= 0) {
        return { count, suffix: null, expiresAt: null };
    }

    const expiresAt = Number(credits.nextResetExpiresAt);
    const timestamp = formatTimestamp(expiresAt, use24Hour);
    if (timestamp === "unknown") {
        return { count, suffix: null, expiresAt: null };
    }

    const countdown = formatExpiryCountdown(expiresAt, nowSeconds);
    return {
        count,
        suffix: countdown ? `${timestamp} (${countdown})` : timestamp,
        expiresAt
    };
}

function selectResetCredit(credits) {
    if (!credits || !Array.isArray(credits.resetCredits)) return null;

    const candidates = [];
    for (const credit of credits.resetCredits) {
        const id = String(credit && credit.id || "").trim();
        if (!id) continue;
        const expiresAt = Number(credit.expiresAt);
        candidates.push({
            id,
            expiresAt: Number.isFinite(expiresAt) && expiresAt > 0
                ? Math.floor(expiresAt)
                : null
        });
    }
    candidates.sort((left, right) => {
        if (left.expiresAt === right.expiresAt) return 0;
        if (left.expiresAt === null) return 1;
        if (right.expiresAt === null) return -1;
        return left.expiresAt - right.expiresAt;
    });
    return candidates[0] || null;
}

function buildResetCreditConfirmation(credits, use24Hour, nowSeconds = null) {
    const count = credits
        ? formatWholeNumber(credits.availableResetCount)
        : "unavailable";
    const availableCount = Number(credits && credits.availableResetCount);
    if (!Number.isFinite(availableCount) || availableCount <= 0) {
        return {
            available: false,
            count,
            creditId: null,
            expiresAt: null,
            expiryText: null
        };
    }

    const selected = selectResetCredit(credits);
    const fallbackExpiresAt = Number(credits.nextResetExpiresAt);
    const expiresAt = selected
        ? selected.expiresAt
        : Number.isFinite(fallbackExpiresAt) && fallbackExpiresAt > 0
            ? Math.floor(fallbackExpiresAt)
            : null;
    const timestamp = formatTimestamp(expiresAt, use24Hour);
    const countdown = formatExpiryCountdown(expiresAt, nowSeconds);
    return {
        available: true,
        count,
        creditId: selected ? selected.id : null,
        expiresAt,
        expiryText: timestamp === "unknown"
            ? null
            : countdown ? `${timestamp} (${countdown})` : timestamp
    };
}

function buildResetConsumeFeedback(outcome) {
    switch (outcome) {
    case "reset":
        return {
            title: "Reset applied",
            description: "One reset credit was consumed. Usage limits are refreshing."
        };
    case "alreadyRedeemed":
        return {
            title: "Reset already applied",
            description: "This redemption was already completed. Usage limits are refreshing."
        };
    case "nothingToReset":
        return {
            title: "Reset not applied",
            description: "No usage window was eligible for this reset. Usage limits are refreshing."
        };
    case "noCredit":
        return {
            title: "No reset credit available",
            description: "The displayed count was stale. The available reset count is refreshing."
        };
    default:
        return null;
    }
}

function formatLocalDate(epochSeconds) {
    const seconds = Number(epochSeconds);
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    const dateTime = GLib.DateTime.new_from_unix_local(Math.floor(seconds));
    return dateTime.format("%d.%m.%Y");
}

function formatChatGptVersionDate(version) {
    const match = String(version || "").trim().match(/^(\d{2})\.(\d{3,4})\.\d{5}$/);
    if (!match) return null;

    const year = 2000 + Number(match[1]);
    const dateCode = match[2];
    const month = Number(dateCode.slice(0, -2));
    const day = Number(dateCode.slice(-2));
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
        month < 1 || month > 12 || day < 1 ||
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        return null;
    }

    return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
}

function formatRelativeTime(epochSeconds, nowSeconds = null) {
    const updatedSeconds = Number(epochSeconds);
    const currentSeconds = nowSeconds === null
        ? GLib.get_real_time() / 1000000
        : Number(nowSeconds);
    if (
        !Number.isFinite(updatedSeconds) || updatedSeconds <= 0 ||
        !Number.isFinite(currentSeconds)
    ) {
        return "unknown";
    }

    const elapsedSeconds = Math.floor(Math.max(0, currentSeconds - updatedSeconds));
    if (elapsedSeconds < 1) return "just now";
    if (elapsedSeconds < 60) return `${elapsedSeconds}s ago`;
    if (elapsedSeconds < 3600) return `${Math.floor(elapsedSeconds / 60)}m ago`;
    if (elapsedSeconds < 86400) return `${Math.floor(elapsedSeconds / 3600)}h ago`;
    return `${Math.floor(elapsedSeconds / 86400)}d ago`;
}

function formatAppTooltip(installed, version = null, prefix = "", releaseDate = null) {
    const status = installed
        ? (String(version || "").trim() || "version unavailable")
        : "not installed";
    const datedStatus = installed && releaseDate
        ? `${status} — ${releaseDate}`
        : status;
    return installed && prefix ? `${prefix} ${datedStatus}` : datedStatus;
}

module.exports = {
    summarizeWindows,
    listQuotaWindows,
    selectPanelWindows,
    formatDuration,
    formatElapsedDuration,
    formatPercent,
    formatConsumedPercent,
    buildResetCountdown,
    buildQuotaIndicator,
    buildActivityChart,
    formatWholeNumber,
    parseUsageHelperError,
    hasRecentActivity,
    historyPeriodKeys,
    buildActivityTotalPeriod,
    buildSharedActivityValues,
    normalizeNotificationThresholds,
    notificationZone,
    buildUsageNotificationEvents,
    formatActivityBucketTooltip,
    formatAccessibleTooltip,
    formatTimestamp,
    formatExpiryCountdown,
    buildResetCreditDisplay,
    selectResetCredit,
    buildResetCreditConfirmation,
    buildResetConsumeFeedback,
    formatLocalDate,
    formatChatGptVersionDate,
    formatRelativeTime,
    formatAppTooltip
};
