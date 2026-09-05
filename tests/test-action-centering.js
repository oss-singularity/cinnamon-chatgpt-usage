/* global imports */

const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;
const [ok, contents] = GLib.file_get_contents("applet.js");
if (!ok) throw new Error("Cannot read applet.js");
const AppletClass = new Function("imports", "require",
    `${ByteArray.toString(contents)}\nreturn ChatGptUsageApplet;`
)(
    { ui: { applet: { Applet: class {} } }, misc: {}, gi: {} },
    () => ({})
);

// Cinnamon's transformed float coordinates straddle half-pixel rounding
// boundaries on the first refresh. Exercise the production centering method
// with both signs of that noise, repeated calls and a secondary monitor.
for (const menuX of [1461, -459]) {
    for (const menuWidth of [419, 448]) {
        for (const error of [-0.0001220703125, 0, 0.0001220703125]) {
            const frame = {
                translation_x: 37,
                get_stage() { return true; },
                get_transformed_position() {
                    return [menuX + 48 + error + this.translation_x, 0];
                },
                get_transformed_size() { return [352 + error, 122]; }
            };
            const applet = Object.create(AppletClass.prototype);
            applet.menu = { actor: {
                get_transformed_position() { return [menuX - error, 0]; },
                get_transformed_size() { return [menuWidth - error, 665]; }
            } };
            applet._actionWidthFrame = frame;
            const expected = menuWidth === 419 ? -14 : 0;
            for (let refresh = 0; refresh < 3; refresh++) {
                applet._syncActionColumnCentering();
                if (frame.translation_x !== expected) {
                    throw new Error(
                        `Action grid drift: width=${menuWidth}, error=${error}, ` +
                        `refresh=${refresh}, expected=${expected}, ` +
                        `actual=${frame.translation_x}`
                    );
                }
            }
        }
    }
}

print("Action centering regression tests passed.");
