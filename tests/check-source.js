/* global imports, ARGV */

const ByteArray = imports.byteArray;
const GLib = imports.gi.GLib;

for (const path of ARGV) {
    const [ok, contents] = GLib.file_get_contents(path);
    if (!ok) throw new Error(`Cannot read ${path}`);
    new Function(ByteArray.toString(contents));
}
