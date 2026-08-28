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
if (!partialBucketTooltip.includes("~4% consumed · partial bucket")) {
    throw new Error(`Expected partial activity tooltip details, got ${partialBucketTooltip}`);
}
assertEqual(
    UsageFormat.formatAccessibleTooltip("First\nSecond\nThird"),
    "First. Second. Third",
    "All accessible tooltip line breaks"
);

const timestamp24h = UsageFormat.formatTimestamp(1700000000, true);
if (/AM|PM/.test(timestamp24h) || !/:/.test(timestamp24h)) {
    throw new Error(`Expected system-local 24-hour timestamp, got ${timestamp24h}`);
}

print("Usage formatting tests passed.");
