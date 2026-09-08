#!/usr/bin/env bash
# Sourced only by capture-variant.sh on its private bus and private HOME.
mkdir -p "$HOME/Custom App"
cat > "$HOME/Custom App/chatgpt" <<'FAKE'
#!/bin/sh
exit 0
FAKE
chmod 700 "$HOME/Custom App/chatgpt"
installation_check=$(eval_cinnamon 'String((function(){
    try {var a=Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0],G=imports.gi.GLib;
    var originalRefresh=a._refreshUsage,count=0;a._refreshUsage=function(){count++;};
    function entries(d){return d.contentLayout.get_children()[1].get_children().filter(function(c){return c instanceof imports.gi.St.Entry;});}
    function save(d){d.buttonLayout.get_children()[2].emit("clicked",1);}
    var d=a._installHelpDialog,e=entries(d),before=[a.codexPath,a.chatGptAppPath];
    if(e.length!==2)throw new Error("Missing setup path fields");
    e[0].set_text(G.get_home_dir()+"/.local/bin/codex");e[1].set_text("/missing/app");save(d);
    if(a._installHelpDialog!==d||a.codexPath!==before[0]||a.chatGptAppPath!==before[1]||count)throw new Error("Invalid draft was saved");
    e[1].set_text(G.get_home_dir()+"/Custom App/chatgpt");save(d);
    if(a._installHelpDialog||count!==1||a.settings.getValue("chatgpt-app-path")!==G.get_home_dir()+"/Custom App/chatgpt")throw new Error("Paths not persisted");
    a._showInstallHelp("Set up ChatGPT App","Choose optional paths or leave them empty for automatic detection.","https://example.invalid");
    d=a._installHelpDialog;e=entries(d);
    if(e[1].get_text()!==a.chatGptAppPath)throw new Error("Saved path missing on reopen");
    e[1].set_text("/unsaved/draft");d.buttonLayout.get_children()[0].emit("clicked",1);
    if(a.chatGptAppPath.endsWith("draft"))throw new Error("Cancel saved draft");
    a._showInstallHelp("Set up ChatGPT App","Choose optional paths or leave them empty for automatic detection.","https://example.invalid");
    d=a._installHelpDialog;e=entries(d);e.forEach(function(c){c.set_text("");});save(d);
    if(a.codexPath||a.chatGptAppPath||count!==2)throw new Error("Clearing did not restore automatic detection");
    a._refreshUsage=originalRefresh;
    a._showInstallHelp("Set up ChatGPT App","Choose optional paths or leave them empty for automatic detection.","https://example.invalid");
    return true;
    } catch(error) { return String(error) + " | " + String(error.stack || ""); }
})())')
if ! grep -qE "['\"]true['\"]" <<< "$installation_check"; then
    printf 'Native installation-path check failed: %s\n' "$installation_check" >&2
    tail -45 "${driver_dir:?}/cinnamon.log" >&2
    exit 1
fi
printf 'Installation paths: native entries, invalid draft, save, reopen, cancel and clearing passed\n'

sleep 1
placeholder_check=$(eval_cinnamon 'String((function(){
    var a=Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0];
    var e=a._installHelpDialog.contentLayout.get_children()[1].get_children().filter(function(c){return c instanceof imports.gi.St.Entry;});
    if(e[0].get_text()||!e[0].hint_text.endsWith("/codex"))return false;
    e[0].clutter_text.grab_key_focus();
    if(e[0].hint_text)return false;
    e[1].clutter_text.grab_key_focus();
    return e[0].hint_text.endsWith("/codex")&&!e[0].get_text()&&!e[1].hint_text;
})())')
if ! grep -qE "['\"]true['\"]" <<< "$placeholder_check"; then
    printf 'Native setup placeholders failed: %s\n' "$placeholder_check" >&2
    exit 1
fi
printf 'Setup placeholders: automatic paths, focus hiding/restoration and no implicit value passed\n'
