/* global imports */

const ByteArray = imports.byteArray;
const GLib = imports.gi.GLib;

const [ok, contents] = GLib.file_get_contents("settings-schema.json");
if (!ok) throw new Error("Cannot read settings-schema.json");
const schema = JSON.parse(ByteArray.toString(contents));

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
    }
}

if (!schema.layout.pages.includes("notifications-page")) {
    throw new Error("Notifications page is missing from the settings layout");
}
assertEqual(
    schema["notify-all-weekly-resets"].description,
    "Notify when any model 7d limit refreshes",
    "Master weekly refresh label"
);
assertEqual(
    schema["notify-codex-weekly-reset"].description,
    "Notify when 7d limits reset",
    "Codex weekly reset label"
);
assertEqual(
    schema["notify-spark-weekly-reset"].description,
    "Notify when 7d Spark limits reset",
    "Spark weekly reset label"
);
assertEqual(
    schema["notify-codex-weekly-reset"].dependency,
    "!notify-all-weekly-resets",
    "Master switch disables the Codex-specific switch"
);
assertEqual(
    schema["notify-spark-weekly-reset"].dependency,
    "!notify-all-weekly-resets",
    "Master switch disables the Spark-specific switch"
);
assertEqual(
    schema["enable-five-hour-low-notifications"].default,
    false,
    "Five-hour notifications remain opt-in"
);
assertEqual(
    schema["enable-weekly-low-notifications"].default,
    false,
    "Weekly notifications remain opt-in"
);

for (const prefix of ["five-hour", "weekly"]) {
    const enabledKey = prefix === "five-hour"
        ? "enable-five-hour-low-notifications"
        : "enable-weekly-low-notifications";
    const warning = schema[`${prefix}-warning-remaining`];
    const critical = schema[`${prefix}-critical-remaining`];
    assertEqual(warning.dependency, enabledKey, `${prefix} warning dependency`);
    assertEqual(critical.dependency, enabledKey, `${prefix} critical dependency`);
    assertEqual(warning.default, 25, `${prefix} warning default`);
    assertEqual(critical.default, 10, `${prefix} critical default`);
    assertEqual(warning.min, 1, `${prefix} warning lower bound`);
    assertEqual(critical.max, 99, `${prefix} critical upper bound`);
}

print("Settings schema tests passed.");
