#!/usr/bin/env bash
# Sourced by the private capture driver only. Never invokes an account action.
release_assert() {
    local result
    result=$(eval_cinnamon "String((function(){try{var a=Main.AppletManager.getRunningInstancesForUuid(\"chatgpt-usage@oss-singularity\")[0];$1}catch(e){return e.message;}})())")
    if ! grep -qE "['\"]true['\"]" <<< "$result"; then
        printf 'Release QA failed: %s: %s\n' "$2" "$result" >&2
        exit 1
    fi
}
release_assert 'return a.menu.isOpen && a._refreshButton.accessible_name==="Refresh now" && a._chatGptButton.accessible_name==="ChatGPT App" && a._screenshotButton.accessible_name==="Copy Screenshot";' 'named keyboard actions'
release_assert 'var p=a._screenshotButton.get_transformed_position(),s=a._screenshotButton.get_transformed_size(),m=a.menu.actor.get_transformed_position();return s[0]<=30&&s[1]<=30&&p[0]<m[0]+32&&p[1]<m[1]+32;' 'compact screenshot corner'
if [[ "${QA_SCREENSHOT_COPY:-0}" == 1 ]]; then
    eval_cinnamon 'Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0]._screenshotButton.emit("clicked", 1)' >/dev/null
    sleep 0.8
    release_assert 'return a._screenshotButtonLabel && a._screenshotButtonLabel.text==="Copied" && a._screenshotButton.accessible_name==="Copied" && !a._screenshotTempFile;' 'copy screenshot action'
    # shellcheck disable=SC2154 # capture-variant.sh owns this shared temp dir
    clipboard_png="$driver_dir/copied.png"
    python3 - "$clipboard_png" <<'PY'
import sys

import gi
gi.require_version("Gtk", "3.0")
from gi.repository import Gdk, Gtk

Gtk.init([])
image = Gtk.Clipboard.get(Gdk.SELECTION_CLIPBOARD).wait_for_image()
if image is None:
    raise SystemExit("Cinnamon clipboard did not expose the copied PNG")
if not image.savev(sys.argv[1], "png", [], []):
    raise SystemExit("Could not save the copied clipboard image")
PY
    identify -format '%wx%h' "$clipboard_png" | grep -Eq '^[1-9][0-9]*x[1-9][0-9]*$'
fi
eval_cinnamon 'JSON.stringify((function(){var a=Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0];a._refreshButton.grab_key_focus();a._rebuildMenu();return true;})())' >/dev/null
release_assert 'var f=global.stage.get_key_focus();return f===a.actor || a.menu.actor.contains(f);' 'focus survives rebuild'
for _ in 1 2 3; do
    eval_cinnamon 'Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0].menu.close(true)' >/dev/null
    sleep 0.45
    release_assert 'return !a.menu.isOpen && !a.menu.animating && !a.menu.actor.visible && (!global.menuStack || global.menuStack.indexOf(a.menu)<0);' 'native animated close settles and releases stack'
    eval_cinnamon 'Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0].menu.open(true)' >/dev/null
    sleep 0.45
    release_assert 'var p=a.menu.actor.get_transformed_position(),s=a.menu.actor.get_transformed_size();var ok=a.menu.isOpen && !a.menu.animating && Math.round(s[0])===Math.round(419*(global.ui_scale||1)*Math.max(1,new imports.gi.Gio.Settings({schema_id:"org.cinnamon.desktop.interface"}).get_double("text-scaling-factor"))) && p[0]>=0 && p[1]>=0 && p[0]+s[0]<=global.screen_width+1 && p[1]+s[1]<=global.screen_height+1 && global.menuStack.filter(function(m){return m===a.menu;}).length===1;return ok?true:JSON.stringify({position:p,size:s,screen:[global.screen_width,global.screen_height],scale:global.ui_scale,open:a.menu.isOpen,animating:a.menu.animating,stack:global.menuStack.length});' 'reopen bounds and unique stack membership'
    # shellcheck source=tests/ui/check-popup-content.sh
    source "$(dirname "$0")/check-popup-content.sh"
done
eval_cinnamon 'Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0]._refreshButton.grab_key_focus()' >/dev/null
sleep 0.3
release_assert 'var p=a.menu._scroll.get_transformed_position(),s=a.menu._scroll.get_transformed_size(),q=a._refreshButton.get_transformed_position(),t=a._refreshButton.get_transformed_size();var adj=a.menu._scroll.get_vscroll_bar().get_adjustment();return (q[1]>=p[1]-1 && q[1]+t[1]<=p[1]+s[1]+1)?true:JSON.stringify({scroll:p,viewport:s,focus:q,size:t,adjustment:[adj.lower,adj.upper,adj.value,adj.page_size],focusActor:global.stage.get_key_focus().toString(),content:a.menu._content.actor.get_preferred_height(-1)});' 'keyboard focus scrolls the footer into view'
eval_cinnamon 'JSON.stringify((function(){var a=Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0];a._snapshot.credits.nextResetExpiresAt=Math.floor(Date.now()/1000)+1000;a._rebuildMenu();return true;})())' >/dev/null
sleep 0.4
if [[ "$(printenv QA_ANIMATIONS || true)" == false ]]; then
    eval_cinnamon 'JSON.stringify((function(){var a=Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0];return {animations:imports.gi.St.Settings.get().animations_enabled,preference:new imports.gi.Gio.Settings({schema_id:"org.cinnamon.desktop.interface"}).get_boolean("enable-animations"),labels:a._resetExpiryBreathingLabels.map(function(l){var t=l.get_transition("opacity");return {breathing:l._resetExpiryBreathing,opacity:l.opacity,repeat:t?t.get_repeat_count():null};})};})())'
    release_assert 'return a._resetExpiryBreathingLabels.every(function(l){return !l.get_transition("opacity");});' 'reduced motion'
fi
if [[ "${QA_SLOW_VERSION:-0}" == 1 ]]; then
    eval_cinnamon 'JSON.stringify((function(){var a=Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0];global.__usageQaTicks=0;global.__usageQaTickId=imports.gi.GLib.timeout_add(imports.gi.GLib.PRIORITY_DEFAULT,20,function(){global.__usageQaTicks++;return true;});a._backendCachedAt=0;a._refreshBackendInfo();return true;})())' >/dev/null
    sleep 0.4
    release_assert 'return global.__usageQaTicks>=5 && !!a._backendDiscovery;' 'UI main loop advances during a slow backend version probe'
    eval_cinnamon 'imports.gi.GLib.source_remove(global.__usageQaTickId)' >/dev/null
    sleep 2
    release_assert 'return !a._backendDiscovery;' 'bounded backend probe completes'
fi
printf 'Release QA: named actions, rebuild focus, three animated close/reopen cycles, bounds and stack passed\n'
