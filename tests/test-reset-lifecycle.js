/* global imports */

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;
const [ok, contents] = GLib.file_get_contents("applet.js");
if (!ok) throw new Error("Cannot read applet.js");
const AppletClass = new Function("imports", "require", "global",
    `${ByteArray.toString(contents)}\nreturn ChatGptUsageApplet;`
)(
    { ui: { applet: { Applet: class {} } }, misc: {}, gi: { Gio, GLib }, byteArray: ByteArray },
    () => ({
        parseUsageHelperError: value => ({ message: value }),
        buildResetConsumeFeedback: outcome => outcome === "alreadyRedeemed" ? { title: outcome } : null
    }),
    { logError() {}, logWarning() {} }
);
function assert(value, message) { if (!value) throw new Error(message); }
const directory = GLib.dir_make_tmp("usage-reset-test-XXXXXX");
const journal = Gio.File.new_for_path(`${directory}/attempt.json`);
const backend = `${directory}/fake backend`;
const requests = `${directory}/requests.jsonl`;
GLib.file_set_contents(backend, '#!/usr/bin/python3\n' +
    'import json,sys,pathlib\n' +
    'messages=[json.loads(sys.stdin.readline()) for _ in range(3)]\n' +
    `path=pathlib.Path(${JSON.stringify(requests)})\n` +
    'previous=path.exists()\n' +
    'with path.open("a") as file: file.write(json.dumps(messages[2])+"\\n")\n' +
    'if previous: print(json.dumps({"id":2,"result":{"outcome":"alreadyRedeemed"}}),flush=True)\n');
Gio.File.new_for_path(backend).set_attribute_uint32("unix::mode", 0o700, Gio.FileQueryInfoFlags.NONE, null);
async function instance() {
    const applet = Object.create(AppletClass.prototype);
    applet._resetAttemptFile = () => journal;
    applet._pendingReset = null;
    applet._resetJournalError = null;
    await applet._loadResetAttempt();
    return applet;
}
function consume(applet) {
    return new Promise(resolve => {
    let timeout = 0;
    applet.metadata = { path: GLib.get_current_dir() };
    applet._resolveCodexPath = () => backend;
    applet._setResetConfirmationBusy = () => {};
    applet._finishResetConsume = (_dialog, feedback) => {
        applet._resetConsumeBusy = false;
        applet.feedback = feedback;
        if (timeout) GLib.source_remove(timeout);
        resolve();
    };
    timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 3000, () => {
        throw new Error("Fake reset callback timed out");
    });
    applet._consumeResetCredit({ creditId: "fixture-credit" }, null, null, []);
    });
}
async function run() {
try {
    const first = await instance();
    assert(!first._pendingReset && !first._resetJournalError, "Fresh state");
    await consume(first);
    assert(first.feedback.title === "Reset outcome unknown", "Lost reply must remain unknown");
    const key = first._pendingReset.key;
    assert(Boolean(key), "Attempt persisted before dispatch");
    const mode = journal.query_info("unix::mode", Gio.FileQueryInfoFlags.NONE, null)
        .get_attribute_uint32("unix::mode") & 0o777;
    assert(mode === 0o600, "Journal must be private");
    const restarted = await instance();
    assert(restarted._pendingReset.key === key, "Reload must retain the attempt");
    let rejected = false;
    try { await restarted._saveResetAttempt("/different/backend", "different-credit"); } catch { rejected = true; }
    assert(rejected, "Backend switch during uncertainty must be blocked");
    await consume(restarted);
    assert(restarted.feedback.title === "alreadyRedeemed", "Definitive retry outcome");
    assert(!journal.query_exists(null), "Receipt acknowledges the completed attempt");
    const [, requestBytes] = GLib.file_get_contents(requests);
    const sent = ByteArray.toString(requestBytes).trim().split("\n").map(JSON.parse);
    assert(sent.length === 2, "Only two explicitly confirmed attempts");
    assert(JSON.stringify(sent[0]) === JSON.stringify(sent[1]), "Retry must send identical parameters");
    const concurrent = await Promise.all([instance(), instance()]);
    const saves = await Promise.allSettled(concurrent.map(a => a._saveResetAttempt(backend, "fixture-credit")));
    assert(saves.filter(result => result.status === "fulfilled").length === 1,
        "Reload race must not overwrite another attempt");
    const restored = await instance();
    const successful = saves.find(result => result.status === "fulfilled");
    assert(restored._pendingReset.key === successful.value.key, "Exclusive journal retains the winning key");
    journal.delete(null);
    GLib.file_set_contents(journal.get_path(), "broken");
    const corrupt = await instance();
    assert(Boolean(corrupt._resetJournalError), "Corrupt journal must disable consumption");
    print("Reset lifecycle: lost reply, private journal, reload, same-key retry and corrupt state passed.");
} finally {
    for (const path of [journal.get_path(), backend, requests]) {
        const file = Gio.File.new_for_path(path);
        if (file.query_exists(null)) file.delete(null);
    }
    Gio.File.new_for_path(directory).delete(null);
}

}
const loop = GLib.MainLoop.new(null, false);
let failure = null;
run().catch(error => { failure = error; }).finally(() => loop.quit());
loop.run();
if (failure) throw failure;
