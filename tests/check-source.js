/* global imports, ARGV */

const ByteArray = imports.byteArray;
const GLib = imports.gi.GLib;

for (const path of ARGV) {
    const [ok, contents] = GLib.file_get_contents(path);
    if (!ok) throw new Error(`Cannot read ${path}`);
    const source = ByteArray.toString(contents);
    new Function(source);
    if (path.endsWith("applet.js") && source.includes("collecting since")) {
        throw new Error("Spark history must not expose internal collection-start text");
    }
}
