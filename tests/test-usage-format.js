/* global imports */

const ByteArray = imports.byteArray;
const GLib = imports.gi.GLib;

const [ok, contents] = GLib.file_get_contents("usage-format.js");
if (!ok) throw new Error("Cannot read usage-format.js");

const localModule = { exports: {} };
new Function("module", "exports", ByteArray.toString(contents))(
    localModule,
    localModule.exports
);
const UsageFormat = localModule.exports;

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
    }
}

function assertClose(actual, expected, message, tolerance = 1e-9) {
    if (Math.abs(actual - expected) > tolerance) {
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
    }
}

const summaries = UsageFormat.summarizeWindows([
    {
        id: "codex",
        label: "Codex",
        windows: [
            { durationMinutes: 10080, remainingPercent: 87, resetsAt: 100 }
        ]
    },
    {
        id: "codex_model",
        label: "Model",
        windows: [
            { durationMinutes: 300, remainingPercent: 100, resetsAt: 200 },
            { durationMinutes: 10080, remainingPercent: 92, resetsAt: 300 }
        ]
    }
]);

assertEqual(summaries.length, 2, "Summary window count");
assertEqual(summaries[0].durationMinutes, 300, "Shortest window first");
assertEqual(summaries[0].remainingPercent, 100, "Five-hour remaining usage");
assertEqual(summaries[1].remainingPercent, 87, "Most constrained weekly bucket");
const quotaWindows = UsageFormat.listQuotaWindows([
    {
        id: "codex",
        label: "Codex",
        windows: [
            { durationMinutes: 10080, remainingPercent: 87, resetsAt: 100 }
        ]
    },
    {
        id: "codex_model",
        label: "Model",
        windows: [
            { durationMinutes: 10080, remainingPercent: 92, resetsAt: 300 },
            { durationMinutes: 300, remainingPercent: 100, resetsAt: 200 }
        ]
    }
]);
assertEqual(quotaWindows.length, 3, "Keep quota windows from every limit");
assertEqual(quotaWindows[0].durationMinutes, 300, "Sort model windows shortest first");
assertEqual(quotaWindows[1].limitId, "codex_model", "Keep duplicate durations");
assertEqual(quotaWindows[2].limitId, "codex", "Place account limits after models");
assertEqual(
    UsageFormat.selectPanelWindows(summaries, false).length,
    1,
    "Hide weekly window alongside five-hour window"
);
assertEqual(
    UsageFormat.selectPanelWindows([summaries[1]], false).length,
    1,
    "Keep weekly window when no five-hour window exists"
);
assertEqual(
    UsageFormat.selectPanelWindows(summaries, true).length,
    2,
    "Show all windows when weekly display is enabled"
);
assertEqual(UsageFormat.formatDuration(300), "5h", "Five-hour label");
assertEqual(UsageFormat.formatDuration(10080), "7d", "Weekly label");
assertEqual(UsageFormat.formatDuration(90), "90m", "Non-integral hour label");
assertEqual(
    UsageFormat.formatElapsedDuration(1000, 1000 + (8 * 3600) + (31 * 60)),
    "8h 31m",
    "Elapsed collection duration"
);
assertEqual(
    UsageFormat.formatElapsedDuration(1000, 1000 + (42 * 60)),
    "42m",
    "Sub-hour collection duration"
);
assertEqual(
    UsageFormat.formatElapsedDuration(1000, 1000 + (26 * 3600)),
    "26h",
    "Multi-day collection duration in hours"
);
assertEqual(
    UsageFormat.formatElapsedDuration(2000, 1000),
    "?",
    "Invalid collection duration"
);
assertEqual(UsageFormat.formatPercent(99.6), "100%", "Percentage rounding");
assertEqual(UsageFormat.formatPercent(-2), "0%", "Percentage lower clamp");
assertEqual(
    UsageFormat.formatConsumedPercent({ consumedPercent: 2.25, complete: true }),
    "2.3%",
    "Precise observed consumption"
);
assertEqual(
    UsageFormat.formatConsumedPercent({ consumedPercent: 2, complete: false }),
    "~2%",
    "Partial observed consumption"
);

const fiveHourCountdown = UsageFormat.buildResetCountdown(
    { durationMinutes: 300, resetsAt: 10000 },
    1000
);
assertEqual(fiveHourCountdown.valid, true, "Five-hour countdown validity");
assertEqual(fiveHourCountdown.remainingSeconds, 9000, "Five-hour seconds remaining");
assertEqual(fiveHourCountdown.fractionRemaining, 0.5, "Five-hour ring fraction");
assertEqual(fiveHourCountdown.fractionElapsed, 0.5, "Five-hour elapsed fraction");
assertEqual(fiveHourCountdown.label, "2h\n30m", "Five-hour countdown label");

const earlyFiveHourCountdown = UsageFormat.buildResetCountdown(
    { durationMinutes: 300, resetsAt: 1000 + (4 * 3600) },
    1000
);
assertClose(
    earlyFiveHourCountdown.fractionElapsed,
    0.2,
    "Reset progress starts near empty and fills toward reset"
);

const unusedFiveHourCountdown = UsageFormat.buildResetCountdown(
    {
        durationMinutes: 300,
        remainingPercent: 100,
        resetsAt: 1000 + (5 * 3600)
    },
    1002
);
assertEqual(
    unusedFiveHourCountdown.label,
    "5h",
    "Unused five-hour cycle keeps its full duration"
);
assertEqual(
    unusedFiveHourCountdown.fractionElapsed,
    0,
    "Unused five-hour cycle has no reset progress"
);

const unusedWeeklyCountdown = UsageFormat.buildResetCountdown(
    {
        durationMinutes: 10080,
        remainingPercent: 100,
        resetsAt: 1000 + (7 * 86400)
    },
    1002
);
assertEqual(
    unusedWeeklyCountdown.label,
    "7d",
    "Unused weekly cycle keeps its full duration"
);
assertEqual(
    unusedWeeklyCountdown.fractionElapsed,
    0,
    "Unused weekly cycle has no reset progress"
);

assertEqual(
    UsageFormat.buildResetCountdown(
        {
            durationMinutes: 300,
            remainingPercent: 99.9,
            resetsAt: 1000 + (5 * 3600)
        },
        1002
    ).label,
    "4h\n59m",
    "Started cycle keeps counting down"
);

const weeklyCountdown = UsageFormat.buildResetCountdown(
    { durationMinutes: 10080, resetsAt: 1000 + (3 * 86400) + (4 * 3600) },
    1000
);
assertEqual(weeklyCountdown.label, "3d\n4h", "Weekly countdown label");
assertEqual(
    UsageFormat.buildResetCountdown(
        { durationMinutes: 300, resetsAt: 1000 + (42 * 60) + 7 },
        1000
    ).label,
    "42m\n7s",
    "Minute countdown label"
);
assertEqual(
    UsageFormat.buildResetCountdown(
        { durationMinutes: 300, resetsAt: 999 },
        1000
    ).label,
    "now",
    "Expired countdown label"
);
assertEqual(
    UsageFormat.buildResetCountdown({ durationMinutes: 300, resetsAt: null }, 1000).valid,
    false,
    "Missing reset countdown"
);
const weeklyQuota = UsageFormat.buildQuotaIndicator({
    durationMinutes: 10080,
    remainingPercent: 60
});
assertEqual(weeklyQuota.valid, true, "Weekly quota ring validity");
assertEqual(weeklyQuota.durationLabel, "7d", "Weekly quota ring duration");
assertEqual(weeklyQuota.percentLabel, "60%", "Weekly quota ring percentage");
assertEqual(weeklyQuota.fractionRemaining, 0.6, "Weekly quota ring fraction");
assertEqual(
    UsageFormat.buildQuotaIndicator({ durationMinutes: 300, remainingPercent: 120 })
        .fractionRemaining,
    1,
    "Quota ring upper clamp"
);
assertEqual(
    UsageFormat.buildActivityChart([null, 0, 1, 2]).knownCount,
    3,
    "Activity chart known bucket count"
);
const chart = UsageFormat.buildActivityChart([null, 0, 1, 2]);
assertEqual(chart.peakPercent, 2, "Activity chart peak");
assertEqual(chart.totalPercent, 3, "Activity chart rolling total");
assertEqual(chart.totalComplete, false, "Unknown bucket makes total partial");
assertEqual(chart.bars[0].known, false, "Unknown activity bucket");
assertEqual(chart.bars[1].intensity, 0, "Zero-consumption bucket");
assertEqual(chart.bars[2].intensity, 4, "Relative activity intensity");
assertEqual(chart.bars[3].intensity, 7, "Peak activity intensity");

const partialChart = UsageFormat.buildActivityChart([
    { consumedPercent: 0, complete: false },
    { consumedPercent: 4, complete: false }
]);
assertEqual(partialChart.knownCount, 1, "Partial zero remains unknown");
assertEqual(partialChart.bars[0].known, false, "Unknown partial zero bucket");
assertEqual(partialChart.bars[1].partial, true, "Observed partial activity bucket");
assertEqual(partialChart.bars[1].intensity, 7, "Partial peak intensity");
assertEqual(partialChart.peakComplete, false, "Partial peak marker");
assertEqual(partialChart.totalPercent, 4, "Partial activity total");
assertEqual(partialChart.totalComplete, false, "Partial bucket makes total partial");

const completeChart = UsageFormat.buildActivityChart([0, 1, 2]);
assertEqual(completeChart.totalPercent, 3, "Complete activity total");
assertEqual(completeChart.totalComplete, true, "Fully observed total is complete");

const observedZeroChart = UsageFormat.buildActivityChart([
    { consumedPercent: 0, complete: false, observed: true }
]);
assertEqual(observedZeroChart.bars[0].known, true, "Observed zero bucket is known");
assertEqual(observedZeroChart.bars[0].partial, true, "Observed running bucket is partial");
assertEqual(
    UsageFormat.hasRecentActivity([
        { consumedPercent: 0, complete: true, observed: true },
        { consumedPercent: 2, complete: false, observed: true }
    ]),
    true,
    "Positive activity opens recent details"
);
assertEqual(
    UsageFormat.hasRecentActivity([
        null,
        { consumedPercent: 0, complete: true, observed: true }
    ]),
    false,
    "Observed zero activity keeps recent details closed"
);
assertEqual(
    UsageFormat.hasRecentActivity(null),
    false,
    "Missing activity keeps recent details closed"
);
assertEqual(
    UsageFormat.historyPeriodKeys(300).join(","),
    "1h,4h,24h",
    "Five-hour history replaces reset-spanning periods with a rolling day"
);
assertEqual(
    UsageFormat.historyPeriodKeys(10080).join(","),
    "1h,4h,12h,today",
    "Weekly history keeps the longer consumption periods"
);
const fiveHourActivityHistory = {
    durationMinutes: 300,
    activity24h: [
        { consumedPercent: 0, complete: true, observed: true },
        { consumedPercent: 1, complete: true, observed: true }
    ]
};
const weeklyActivityHistory = {
    durationMinutes: 10080,
    activity24h: [
        { consumedPercent: 0, complete: true, observed: true },
        { consumedPercent: 0, complete: true, observed: true }
    ]
};
const sharedActivityValues = UsageFormat.buildSharedActivityValues([
    weeklyActivityHistory,
    fiveHourActivityHistory
], 0.5);
assertEqual(
    sharedActivityValues[1].consumedPercent,
    0.5,
    "Shared Spark chart estimates rounded weekly activity at half scale"
);
assertEqual(
    sharedActivityValues[1].estimated,
    true,
    "Rounded weekly activity remains marked as estimated"
);
const sharedActivityChart = UsageFormat.buildActivityChart(sharedActivityValues);
const fiveHourActivityTotal = UsageFormat.buildActivityTotalPeriod(
    fiveHourActivityHistory.activity24h
);
assertEqual(
    UsageFormat.formatConsumedPercent(fiveHourActivityTotal),
    "1%",
    "Five-hour history exposes its exact rolling-day activity"
);
assertEqual(
    sharedActivityChart.totalPercent,
    0.5,
    "Shared Spark chart keeps the estimated weekly deduction"
);
assertEqual(
    sharedActivityChart.totalEstimated,
    true,
    "Shared Spark chart exposes its estimated total"
);
assertEqual(
    sharedActivityChart.bars[1].intensity,
    1,
    "Estimated sub-percent weekly activity stays at the smallest visible bar"
);
assertEqual(
    UsageFormat.hasRecentActivity(sharedActivityValues),
    true,
    "Shared Spark chart stays aligned with the auto-open activity signal"
);
const estimatedActivityTooltip = UsageFormat.formatActivityBucketTooltip(
    sharedActivityChart.bars[1],
    1,
    2,
    60,
    1700000000,
    true
);
if (!estimatedActivityTooltip.includes("~0.5% consumed · estimated")) {
    throw new Error(
        `Expected estimated weekly deduction tooltip, got ${estimatedActivityTooltip}`
    );
}
const measuredWeeklyActivity = UsageFormat.buildSharedActivityValues([
    fiveHourActivityHistory,
    {
        durationMinutes: 10080,
        activity24h: [
            { consumedPercent: 0, complete: true, observed: true },
            { consumedPercent: 1, complete: true, observed: true }
        ]
    }
], 0.5);
assertEqual(
    measuredWeeklyActivity[1].consumedPercent,
    1,
    "Measured weekly activity takes precedence over the estimate"
);
assertEqual(
    Boolean(measuredWeeklyActivity[1].estimated),
    false,
    "Measured weekly activity is not marked as estimated"
);
assertEqual(
    UsageFormat.formatWholeNumber("250.0000000000"),
    "250",
    "Whole credit balance omits decimal zeroes"
);
assertEqual(
    UsageFormat.formatWholeNumber("239.071181"),
    "239",
    "Fractional credit balance rounds to a whole number"
);
assertEqual(
    UsageFormat.formatWholeNumber("239.8"),
    "240",
    "Credit balance uses conventional whole-number rounding"
);
assertEqual(
    UsageFormat.formatWholeNumber(null),
    "unavailable",
    "Missing credit balance stays unavailable"
);
assertEqual(
    UsageFormat.formatWholeNumber("3.0000000000"),
    "3",
    "Whole reset count omits decimal zeroes"
);
const authenticationError = UsageFormat.parseUsageHelperError(
    "AUTH_REQUIRED: Sign in to ChatGPT with the Codex App/CLI."
);
assertEqual(
    authenticationError.authenticationRequired,
    true,
    "Authentication marker is recognised"
);
assertEqual(
    authenticationError.message,
    "Sign in to ChatGPT with the Codex App/CLI.",
    "Authentication marker is hidden from the user"
);
const refreshError = UsageFormat.parseUsageHelperError("Network unavailable");
assertEqual(
    refreshError.authenticationRequired,
    false,
    "Ordinary refresh errors retain stale usage"
);
assertEqual(refreshError.message, "Network unavailable", "Refresh error text is retained");

const knownBucketTooltip = UsageFormat.formatActivityBucketTooltip(
    chart.bars[3],
    3,
    4,
    120,
    1700000000,
    true
);
if (!knownBucketTooltip.includes("2% consumed") || !knownBucketTooltip.includes("\n")) {
    throw new Error(`Expected known activity tooltip details, got ${knownBucketTooltip}`);
}
const unknownBucketTooltip = UsageFormat.formatActivityBucketTooltip(
    chart.bars[0],
    0,
    4,
    120,
    1700000000,
    true
);
if (!unknownBucketTooltip.endsWith("No observed data")) {
    throw new Error(`Expected unknown activity tooltip details, got ${unknownBucketTooltip}`);
}
const partialBucketTooltip = UsageFormat.formatActivityBucketTooltip(
    partialChart.bars[1],
    1,
    2,
    120,
    1700000000,
    false
);
if (
    !partialBucketTooltip.includes("~4% consumed") ||
    partialBucketTooltip.includes("partial bucket")
) {
    throw new Error(`Expected partial activity tooltip details, got ${partialBucketTooltip}`);
}
const historicalPartialTooltip = UsageFormat.formatActivityBucketTooltip(
    partialChart.bars[1],
    0,
    2,
    120,
    1700000000,
    false
);
if (!historicalPartialTooltip.includes("~4% consumed · partial bucket")) {
    throw new Error(
        `Expected historical partial bucket details, got ${historicalPartialTooltip}`
    );
}
assertEqual(
    UsageFormat.formatAccessibleTooltip("First\nSecond\nThird"),
    "First. Second. Third",
    "All accessible tooltip line breaks"
);
assertEqual(
    UsageFormat.formatAppTooltip(true, "26.825.51511", "chatgpt"),
    "chatgpt 26.825.51511",
    "ChatGPT tooltip includes package and version"
);
assertEqual(
    UsageFormat.formatAppTooltip(true, "26.825.51511", "chatgpt", "30.08.2026"),
    "chatgpt 26.825.51511 — 30.08.2026",
    "Installed ChatGPT tooltip includes release date"
);
assertEqual(
    UsageFormat.formatAppTooltip(true, "codex-cli 0.152.0", "", "01.09.2026"),
    "codex-cli 0.152.0 — 01.09.2026",
    "Installed Codex tooltip includes release date"
);
assertEqual(
    UsageFormat.formatAppTooltip(true, "new-version", "chatgpt", null),
    "chatgpt new-version",
    "Unknown application version has no guessed release date"
);
assertEqual(
    UsageFormat.formatAppTooltip(false),
    "not installed",
    "Missing application tooltip contains only not installed"
);
assertEqual(
    UsageFormat.formatAppTooltip(true),
    "version unavailable",
    "Installed application without readable version reports unavailable version"
);

assertEqual(
    UsageFormat.normalizeNotificationThresholds(25, 10).valid,
    true,
    "Notification thresholds require critical below warning"
);
assertEqual(
    UsageFormat.normalizeNotificationThresholds(10, 10).valid,
    false,
    "Equal notification thresholds are rejected"
);
assertEqual(
    UsageFormat.notificationZone(26, 25, 10),
    "normal",
    "Quota above warning threshold is normal"
);
assertEqual(
    UsageFormat.notificationZone(25, 25, 10),
    "warning",
    "Warning threshold is inclusive"
);
assertEqual(
    UsageFormat.notificationZone(10, 25, 10),
    "critical",
    "Critical threshold is inclusive"
);

function notificationSnapshot(codexFive, codexWeekly, sparkFive, sparkWeekly, resetShift = 0) {
    return {
        limits: [
            {
                id: "codex",
                label: "Codex",
                windows: [
                    {
                        durationMinutes: 300,
                        remainingPercent: codexFive,
                        resetsAt: 20000 + resetShift
                    },
                    {
                        durationMinutes: 10080,
                        remainingPercent: codexWeekly,
                        resetsAt: 700000 + resetShift
                    }
                ]
            },
            {
                id: "codex_spark",
                label: "GPT-5.3-Codex-Spark",
                windows: [
                    {
                        durationMinutes: 300,
                        remainingPercent: sparkFive,
                        resetsAt: 21000 + resetShift
                    },
                    {
                        durationMinutes: 10080,
                        remainingPercent: sparkWeekly,
                        resetsAt: 710000 + resetShift
                    }
                ]
            }
        ]
    };
}

const notificationDefaults = {
    notifyAllWeeklyResets: false,
    notifyCodexWeeklyReset: false,
    notifySparkWeeklyReset: false,
    enableFiveHourLowNotifications: true,
    fiveHourWarningRemaining: 25,
    fiveHourCriticalRemaining: 10,
    enableWeeklyLowNotifications: true,
    weeklyWarningRemaining: 25,
    weeklyCriticalRemaining: 10
};
assertEqual(
    UsageFormat.buildUsageNotificationEvents(
        null,
        notificationSnapshot(20, 20, 20, 20),
        notificationDefaults
    ).length,
    0,
    "First successful refresh stays silent"
);
const warningEvents = UsageFormat.buildUsageNotificationEvents(
    notificationSnapshot(40, 40, 40, 40),
    notificationSnapshot(25, 24, 24, 40),
    notificationDefaults
);
assertEqual(warningEvents.length, 3, "Independent 5h and 7d warning entries");
assertEqual(warningEvents[0].level, "warning", "Warning zone entry level");
assertEqual(
    UsageFormat.buildUsageNotificationEvents(
        notificationSnapshot(25, 24, 24, 40),
        notificationSnapshot(20, 20, 20, 40),
        notificationDefaults
    ).length,
    0,
    "Repeated refresh inside warning zone stays silent"
);
const criticalEvents = UsageFormat.buildUsageNotificationEvents(
    notificationSnapshot(20, 20, 20, 40),
    notificationSnapshot(10, 10, 10, 40),
    notificationDefaults
);
assertEqual(criticalEvents.length, 3, "Critical entry follows an earlier warning");
assertEqual(criticalEvents[0].level, "critical", "Critical zone entry level");
assertEqual(
    UsageFormat.buildUsageNotificationEvents(
        notificationSnapshot(10, 10, 10, 40),
        notificationSnapshot(50, 50, 50, 40),
        notificationDefaults
    ).length,
    0,
    "Recovery to normal stays silent"
);
assertEqual(
    UsageFormat.buildUsageNotificationEvents(
        notificationSnapshot(50, 50, 50, 40),
        notificationSnapshot(25, 50, 50, 40),
        notificationDefaults
    ).length,
    1,
    "Fresh crossing after recovery notifies again"
);
assertEqual(
    UsageFormat.buildUsageNotificationEvents(
        notificationSnapshot(40, 40, 40, 40),
        notificationSnapshot(20, 20, 20, 20),
        {
            ...notificationDefaults,
            enableFiveHourLowNotifications: false
        }
    ).filter(event => event.durationMinutes === 300).length,
    0,
    "Five-hour notification switch is independent"
);
assertEqual(
    UsageFormat.buildUsageNotificationEvents(
        notificationSnapshot(40, 40, 40, 40),
        notificationSnapshot(20, 20, 20, 20),
        {
            ...notificationDefaults,
            enableWeeklyLowNotifications: false
        }
    ).filter(event => event.durationMinutes === 10080).length,
    0,
    "Weekly notification switch is independent"
);
assertEqual(
    UsageFormat.buildUsageNotificationEvents(
        notificationSnapshot(40, 40, 40, 40),
        notificationSnapshot(20, 20, 20, 20),
        {
            ...notificationDefaults,
            fiveHourWarningRemaining: 10,
            fiveHourCriticalRemaining: 10
        }
    ).filter(event => event.durationMinutes === 300).length,
    0,
    "Invalid threshold pair cannot notify"
);

const resetPrevious = notificationSnapshot(50, 60, 50, 70);
const resetCurrent = notificationSnapshot(50, 100, 50, 100, 604800);
const resetEvents = UsageFormat.buildUsageNotificationEvents(
    resetPrevious,
    resetCurrent,
    {
        ...notificationDefaults,
        notifyAllWeeklyResets: true,
        enableFiveHourLowNotifications: false,
        enableWeeklyLowNotifications: false
    }
);
assertEqual(resetEvents.length, 2, "Master reset switch covers Codex and Spark");
assertEqual(resetEvents[0].kind, "reset", "Weekly refresh event kind");
assertEqual(
    UsageFormat.buildUsageNotificationEvents(
        resetPrevious,
        resetCurrent,
        {
            ...notificationDefaults,
            notifySparkWeeklyReset: true,
            enableFiveHourLowNotifications: false,
            enableWeeklyLowNotifications: false
        }
    ).length,
    1,
    "Spark reset switch stays independent"
);
assertEqual(
    UsageFormat.buildUsageNotificationEvents(
        resetCurrent,
        resetCurrent,
        {
            ...notificationDefaults,
            notifyAllWeeklyResets: true,
            enableFiveHourLowNotifications: false,
            enableWeeklyLowNotifications: false
        }
    ).length,
    0,
    "Already observed reset is deduplicated"
);
assertEqual(
    UsageFormat.buildUsageNotificationEvents(
        resetPrevious,
        notificationSnapshot(50, 100, 50, 100, 30),
        {
            ...notificationDefaults,
            notifyAllWeeklyResets: true,
            enableFiveHourLowNotifications: false,
            enableWeeklyLowNotifications: false
        }
    ).length,
    0,
    "Reset timestamp jitter cannot create a refresh notification"
);

const timestamp24h = UsageFormat.formatTimestamp(1700000000, true);
if (/AM|PM/.test(timestamp24h) || !/:/.test(timestamp24h)) {
    throw new Error(`Expected system-local 24-hour timestamp, got ${timestamp24h}`);
}
assertEqual(
    UsageFormat.formatRelativeTime(1000, 1000),
    "just now",
    "Current relative timestamp"
);
assertEqual(
    UsageFormat.formatRelativeTime(1000, 1008.9),
    "8s ago",
    "Second-level relative timestamp"
);
assertEqual(
    UsageFormat.formatRelativeTime(1000, 1120),
    "2m ago",
    "Minute-level relative timestamp"
);
assertEqual(
    UsageFormat.formatRelativeTime(1000, 8200),
    "2h ago",
    "Hour-level relative timestamp"
);
assertEqual(
    UsageFormat.formatRelativeTime(1000, 173800),
    "2d ago",
    "Day-level relative timestamp"
);
assertEqual(
    UsageFormat.formatRelativeTime(1000, 999),
    "just now",
    "Future relative timestamp jitter"
);
assertEqual(
    UsageFormat.formatRelativeTime(null, 1000),
    "unknown",
    "Invalid relative timestamp"
);

print("Usage formatting tests passed.");
