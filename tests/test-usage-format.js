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

const timestamp24h = UsageFormat.formatTimestamp(1700000000, true);
if (/AM|PM/.test(timestamp24h) || !/:/.test(timestamp24h)) {
    throw new Error(`Expected system-local 24-hour timestamp, got ${timestamp24h}`);
}

print("Usage formatting tests passed.");
