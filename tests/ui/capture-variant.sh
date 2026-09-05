#!/usr/bin/env bash
set -Eeuo pipefail

variant=${1:?variant is required}
geometry_file=${2:?geometry output path is required}
panel_mode=${3:-vertical}
panel_geometry_file=${4:-}
uuid='chatgpt-usage@oss-singularity'

case "$variant" in
    basic|overview|spark|bucket|four|codex-two|reset|panel|panel-tooltip|install-chatgpt|install-codex|settings-general|settings-colors|settings-notifications) ;;
    *)
        printf 'Unsupported variant: %s\n' "$variant" >&2
        exit 2
        ;;
esac

case "$panel_mode" in
    vertical)
        panel_setting="['3:0:right']"
        panel_position='3'
        ;;
    horizontal)
        panel_setting="['1:0:top']"
        panel_position='0'
        ;;
    *)
        printf 'Unsupported panel mode: %s\n' "$panel_mode" >&2
        exit 2
        ;;
esac

for command in cinnamon gdbus gsettings xdotool xdpyinfo; do
    command -v "$command" >/dev/null || {
        printf 'capture-readme-variant: missing command: %s\n' "$command" >&2
        exit 2
    }
done

[[ "$geometry_file" == /* ]] || {
    printf 'capture-readme-variant: geometry path must be absolute\n' >&2
    exit 2
}
if [[ -n "$panel_geometry_file" && "$panel_geometry_file" != /* ]]; then
    printf 'capture-readme-variant: panel geometry path must be absolute\n' >&2
    exit 2
fi

eval_cinnamon() {
    gdbus call \
        --session \
        --dest org.Cinnamon \
        --object-path /org/Cinnamon \
        --method org.Cinnamon.Eval \
        "$1"
}

driver_dir=$(mktemp -d "${TMPDIR:-/tmp}/cinnamon-readme-driver.XXXXXX")
cinnamon_pid=''

cleanup() {
    local status=$?
    set +e
    # run-isolated.sh intentionally sends TERM after its root frame. Treat
    # that controlled driver shutdown as a successful capture.
    if (( status == 143 )); then status=0; fi
    if [[ -n "$cinnamon_pid" ]] && kill -0 "$cinnamon_pid" 2>/dev/null; then
        eval_cinnamon 'JSON.stringify((function(){var a=Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0];if(!a)return {restored:false};if(a.menu&&a.menu.isOpen)a.menu.close(false);if(a.__captureOriginalSnapshot!==undefined){a._snapshot=a.__captureOriginalSnapshot;a._lastError=a.__captureOriginalLastError;a._authenticationRequired=a.__captureOriginalAuthRequired;a._resetConsumeBusy=a.__captureOriginalResetBusy;a.showModelLimitsInPanel=a.__captureOriginalShowModelLimitsInPanel;a._rebuildPanel();a._rebuildMenu();}if(a.__captureBackgroundActor){a.__captureBackgroundActor.destroy();a.__captureBackgroundActor=null;}if(global.background_actor){if(a.__captureOriginalBackgroundVisible)global.background_actor.show();else global.background_actor.hide();}var desk=imports.ui.main.deskletContainer&&imports.ui.main.deskletContainer.actor;if(desk&&a.__captureOriginalDeskletsVisible)desk.show();if(desk&&!a.__captureOriginalDeskletsVisible)desk.hide();var pointer=a.__captureOriginalPointer;if(pointer)global.set_pointer(pointer[0],pointer[1]);return {restored:true};})())' >/dev/null 2>&1 || true
        kill -TERM "$cinnamon_pid" 2>/dev/null || true
        for _ in {1..40}; do
            kill -0 "$cinnamon_pid" 2>/dev/null || break
            sleep 0.05
        done
        kill -KILL "$cinnamon_pid" 2>/dev/null || true
        wait "$cinnamon_pid" 2>/dev/null || true
    fi
    rm -rf -- "$driver_dir"
    exit "$status"
}
trap cleanup EXIT INT TERM

# Private dconf is provided by run-isolated.sh; no setting below reaches the
# user's real Cinnamon configuration.
# Never use an installed/account-backed Codex in a capture.
mkdir -p "$HOME/.local/bin"
cat > "$HOME/.local/bin/codex" <<'FAKE'
#!/bin/sh
if [ "${1:-}" = "--version" ]; then
    printf 'codex-cli fixture\n'
fi
exit 0
FAKE
chmod 700 "$HOME/.local/bin/codex"
export PATH="$HOME/.local/bin:$PATH"
unset LC_ALL
export LANG=C.UTF-8 LC_MESSAGES=C.UTF-8 LC_TIME=de_DE.UTF-8
export GTK_THEME="${QA_GTK_THEME:-Mint-Y}"

gsettings set org.cinnamon panels-enabled "$panel_setting"
gsettings set org.cinnamon enabled-applets "[]"
gsettings set org.cinnamon enabled-desklets "[]"
gsettings set org.cinnamon.theme name "${QA_THEME:-Mint-Y-Dark}"
gsettings set org.cinnamon.desktop.interface gtk-theme "${QA_THEME:-Mint-Y-Dark}"
gsettings set org.cinnamon.desktop.interface icon-theme "${QA_ICON_THEME:-Adwaita}"

cinnamon --replace --sm-disable >"$driver_dir/cinnamon.log" 2>&1 &
cinnamon_pid=$!

# Wait until Cinnamon has loaded its normal panel and applet manager.
for _ in {1..100}; do
    if gdbus call --session --dest org.Cinnamon --object-path /org/Cinnamon --method org.Cinnamon.Eval 'String(Boolean(Main&&Main.AppletManager&&Main.AppletManager.appletsLoaded&&Main.panelManager&&Main.panelManager.panels.length>0))' 2>/dev/null | grep -qE "['\"]true['\"]"; then
        break
    fi
    sleep 0.2
done

# Keep the private dconf defaults untouched. Add one disposable definition to
# Cinnamon's in-memory manager and ask the normal extension loader to load the
# copied regular-file applet. This avoids a startup-time settings rewrite in
# Cinnamon 6.6 while preserving the real applet/module/panel path.
panel_setup='JSON.stringify((function(){var uuid="chatgpt-usage@oss-singularity",desired=PANEL_POSITION,panel=Main.panelManager.panels.filter(function(p){return p&&p.panelPosition===desired;})[0]||Main.panelManager.panels[1],defs=Main.AppletManager.definitions;if(!panel)throw new Error("private panel unavailable");defs.push({panelId:panel.panelId,orientation:Main.AppletManager.setOrientationForPanel(panel.panelPosition),location_label:"right",center:false,order:13,uuid:uuid,real_uuid:uuid,applet_id:"9001",applet:null});imports.ui.extension.loadExtension(uuid,imports.ui.extension.Type.APPLET);return {definitions:defs.length,panelId:panel.panelId,position:panel.panelPosition,requested:true};})())'
panel_setup=${panel_setup//PANEL_POSITION/$panel_position}
panel_setup_result=$(eval_cinnamon "$panel_setup" 2>&1 || true)
if [[ "$panel_setup_result" != *'(true,'* ]]; then
    printf 'capture-readme-variant: panel setup failed: %s\n' "$panel_setup_result" >&2
    exit 1
fi

instance_ready=''
for _ in {1..100}; do
    instance_ready=$(eval_cinnamon "String(Main.AppletManager.getRunningInstancesForUuid(\"$uuid\").length)" 2>/dev/null || true)
    if [[ "$instance_ready" == *"'1'"* || "$instance_ready" == *'"1"'* ]]; then break; fi
    sleep 0.2
done
if [[ "$instance_ready" != *"'1'"* && "$instance_ready" != *'"1"'* ]]; then
    printf 'capture-readme-variant: applet did not register: %s\n' "$instance_ready" >&2
    sed -n '1,180p' "$driver_dir/cinnamon.log" >&2
    exit 1
fi

# Let the normal startup refresh settle before replacing only the display
# snapshot with the in-memory fixture below.
sleep 2

read -r -d '' setup_code <<'JSEOF' || true
JSON.stringify((function(){
    var a=Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0];
    if(!a)throw new Error("applet not found");
    a.__captureOriginalSnapshot=a._snapshot;
    a.__captureOriginalLastError=a._lastError;
    a.__captureOriginalAuthRequired=a._authenticationRequired;
    a.__captureOriginalResetBusy=a._resetConsumeBusy;
    a.__captureOriginalShowModelLimitsInPanel=a.showModelLimitsInPanel;
    a.__captureOriginalDeskletsVisible=!!(imports.ui.main.deskletContainer&&imports.ui.main.deskletContainer.actor&&imports.ui.main.deskletContainer.actor.visible);
    a.__captureOriginalPointer=global.get_pointer();
    a.__captureOriginalBackgroundVisible=!!(global.background_actor&&global.background_actor.visible);
    if(global.background_actor)global.background_actor.hide();
    var GLib=imports.gi.GLib,St=imports.gi.St,Clutter=imports.gi.Clutter;
    var stageBg=global.stage.get_children()[0];
    if(stageBg){
        stageBg.set_background_color(new Clutter.Color({red:11,green:114,blue:133,alpha:255}));
        var backgroundPath=GLib.getenv("CINNAMON_ISOLATED_BACKGROUND_IMAGE");
        var backgroundActor=St.TextureCache.get_default().load_file_simple(backgroundPath);
        backgroundActor.reactive=false;
        backgroundActor.set_position(0,0);backgroundActor.set_size(global.screen_width,global.screen_height);stageBg.insert_child_at_index(backgroundActor,0);a.__captureBackgroundActor=backgroundActor;
    }
    var now=Math.floor(Date.now()/1000),updated=now-120;
    function win(duration,remaining,offset){return {durationMinutes:duration,usedPercent:100-remaining,remainingPercent:remaining,resetsAt:now+offset};}
    function bucket(value){return {consumedPercent:value,complete:true,observed:true};}
    function historyWindow(id,label,duration,periods,values){periods["24h"]={consumedPercent:values.reduce(function(a,b){return a+b;},0),complete:true};return {id:id,label:label,durationMinutes:duration,trackedSince:now-8*86400,periods:periods,activity24h:values.map(bucket)};}
    var codexLabel="Codex",sparkLabel="GPT-5.3-Codex-Spark",hasSpark="VARIANT"!=="codex-two";
    var codexWindows=[win(10080,62,4*86400+5*3600)];
    var sparkWindows=[win(300,82,3*3600+41*60),win(10080,76,6*86400+3*3600)];
    if("VARIANT"==="four"||"VARIANT"==="codex-two")codexWindows.unshift(win(300,68,2*3600+13*60));
    var codexValues=[0,0,0,1,0,0,0,2,0,0,1,0,0,0,2,0,0,0,1,0,0,0,0,1];
    var sparkFiveValues=[0,0,0,0,0,0,1,0,0,0,0,0,0,2,0,0,0,0,1,0,0,0,0,0];
    var sparkWeeklyValues=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,2,0,0,1,0];
    if("VARIANT"==="basic"||"VARIANT"==="four"){
        sparkWindows=[win(300,100,5*3600),win(10080,100,7*86400)];
        sparkFiveValues=sparkFiveValues.map(function(){return 0;});
        sparkWeeklyValues=sparkWeeklyValues.map(function(){return 0;});
    }
    var codexPeriods={"1h":{consumedPercent:1,complete:true},"4h":{consumedPercent:5,complete:true},"12h":{consumedPercent:26,complete:true},today:{consumedPercent:26,complete:true}};
    var sparkFivePeriods={"1h":{consumedPercent:3,complete:true},"4h":{consumedPercent:10,complete:true}};
    var sparkWeeklyPeriods={"1h":{consumedPercent:3,complete:true},"4h":{consumedPercent:10,complete:true},"12h":{consumedPercent:18,complete:true},today:{consumedPercent:18,complete:true}};
    var codexHistory=historyWindow("codex",codexLabel,10080,codexPeriods,codexValues);
    var sparkFiveHistory=historyWindow("spark",sparkLabel,300,sparkFivePeriods,sparkFiveValues);
    var sparkWeeklyHistory=historyWindow("spark",sparkLabel,10080,sparkWeeklyPeriods,sparkWeeklyValues);
    var historyWindows=[codexHistory];
    if("VARIANT"==="four"||"VARIANT"==="codex-two")historyWindows.push(historyWindow("codex",codexLabel,300,{"1h":{consumedPercent:2,complete:true},"4h":{consumedPercent:5,complete:true}},[0,0,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0]));
    if(hasSpark)historyWindows.push(sparkFiveHistory,sparkWeeklyHistory);
    var limits=[{id:"codex",label:codexLabel,windows:codexWindows}];
    if(hasSpark)limits.push({id:"spark",label:sparkLabel,windows:sparkWindows});
    a.panelTextColor="#ffffff";
    a._snapshot={
        updatedAt:updated,
        limits:limits,
        credits:{balance:"158",availableResetCount:"VARIANT"==="reset"?1:2,nextResetExpiresAt:now+10*86400+4*3600,resetCredits:[{id:"demo-reset-1",expiresAt:now+10*86400+4*3600},{id:"demo-reset-2",expiresAt:now+11*86400}],hasCredits:true,unlimited:false},
        history:{trackedSince:now-8*86400,activityBucketMinutes:60,activityEndAt:Math.ceil(now/3600)*3600,windows:historyWindows}
    };
    if("VARIANT"==="overview"){
        a._snapshot.limits[0].windows=[win(10080,5,6*86400+16*3600)];
        a._snapshot.credits={balance:"250",availableResetCount:1,nextResetExpiresAt:now+29*86400+13*3600,hasCredits:true,unlimited:false};
        a._snapshot.history.windows[0].periods={"1h":{consumedPercent:11,complete:true},"4h":{consumedPercent:35,complete:true},"12h":{consumedPercent:95,complete:true},today:{consumedPercent:123,complete:true}};
        a._snapshot.history.windows[0].activity24h=[3,2,3,3,2,2,3,21,21,0,0,0,0,0,0,0,7,8,8,7,2,3,3,2].map(bucket);
        a._snapshot.history.windows.slice(1).forEach(function(w){w.activity24h=w.activity24h.map(function(){return bucket(0);});});
    }
    a._lastError=null;a._authenticationRequired=false;a._resetConsumeBusy=false;a._resetFeedback=null;a.showModelLimitsInPanel=true;
    if("VARIANT"==="install-chatgpt")a._chatGptAppInfo=function(){return null;};
    if("VARIANT"==="install-codex")a._codexTerminalCommand=function(){return null;};
    a._rebuildPanel();a._rebuildMenu();
    imports.ui.main.deskletContainer.actor.hide();
    return {staged:true,variant:"VARIANT",menuOpen:!!a.menu.isOpen};
})())
JSEOF
setup_code=${setup_code//VARIANT/$variant}
eval_cinnamon "$setup_code" >/dev/null

if [[ "$variant" == settings-* ]]; then
    case "$variant" in
        settings-general) settings_tab=0 ;;
        settings-colors) settings_tab=1 ;;
        settings-notifications) settings_tab=2 ;;
    esac
    python3 /usr/share/cinnamon/cinnamon-settings/xlet-settings.py applet "$uuid" -t "$settings_tab" >"$driver_dir/settings.log" 2>&1 &
    sleep 2
    eval_cinnamon 'JSON.stringify((function(){var w=global.get_window_actors().map(function(a){return a.meta_window;}).filter(function(w){return w.get_title()==="ChatGPT Usage";})[0];if(!w)throw new Error("Settings window missing");var r=w.get_frame_rect();w.move_frame(false,global.screen_width-40-r.width-16,global.screen_height-r.height-16);return true;})())' >/dev/null
    sleep 1
elif [[ "$variant" == install-* ]]; then
    if [[ "$variant" == "install-chatgpt" ]]; then
        eval_cinnamon 'Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0]._chatGptButton.emit("clicked", 1)' >/dev/null
    else
        eval_cinnamon 'Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0]._codexButton.emit("clicked", 1)' >/dev/null
    fi
elif [[ "$variant" == "panel" || "$variant" == "panel-tooltip" ]]; then
    :
elif [[ "$variant" == "reset" ]]; then
    eval_cinnamon 'JSON.stringify((function(){var a=Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0];if(a.menu.isOpen)a.menu.close(false);a._showResetConfirmation();return {resetDialog:!!a._resetConfirmationDialog};})())' >/dev/null
else
    eval_cinnamon 'JSON.stringify((function(){var a=Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0];if(a.menu.isOpen)a.menu.close(false);a.on_applet_clicked();return {menuOpen:!!a.menu.isOpen};})())' >/dev/null
fi
sleep 1

if [[ "$variant" == "panel-tooltip" ]]; then
    point=$(eval_cinnamon 'JSON.stringify((function(){var a=Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0],p=a.actor.get_transformed_position(),s=a.actor.get_transformed_size();return [Math.round(p[0]+s[0]/2),Math.round(p[1]+s[1]/2)].join(",");})())' | grep -oE '[0-9]+,[0-9]+' | tail -1)
    IFS=, read -r hover_x hover_y <<< "$point"
    xdotool mousemove "$hover_x" "$hover_y"
    sleep 1
fi
if [[ "$variant" == "bucket" ]]; then
    hover_geometry=$(eval_cinnamon 'JSON.stringify((function(){var a=Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0],charts=a._activityCharts;if(!charts||charts.length<2)throw new Error("activity chart unavailable");var plot=charts[charts.length-1].chart.get_children()[0],slots=plot.get_children(),slot=slots[slots.length-1],p=slot.get_transformed_position(),s=slot.get_transformed_size();return [Math.round(p[0]+s[0]/2),Math.round(p[1]+s[1]/2)].join(",");})())' | grep -oE '[0-9]+,[0-9]+' | tail -1)
    IFS=, read -r hover_x hover_y <<< "$hover_geometry"
    xdotool mousemove "$hover_x" "$hover_y" >/dev/null
    sleep 1
fi

if [[ "$variant" == settings-* ]]; then
    menu_geometry=$(eval_cinnamon 'JSON.stringify((function(){var w=global.get_window_actors().map(function(a){return a.meta_window;}).filter(function(w){return w.get_title()==="ChatGPT Usage";})[0],r=w.get_frame_rect();return [r.x,r.y,r.width,r.height].join(",");})())' | grep -oE '[0-9]+,[0-9]+,[0-9]+,[0-9]+' | tail -1)
elif [[ "$variant" == install-* ]]; then
    menu_geometry=$(eval_cinnamon 'JSON.stringify((function(){var d=Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0]._installHelpDialog.dialogLayout,p=d.get_transformed_position(),s=d.get_transformed_size();return [Math.round(p[0]),Math.round(p[1]),Math.round(s[0]),Math.round(s[1])].join(",");})())' | grep -oE '[0-9]+,[0-9]+,[0-9]+,[0-9]+' | tail -1)
elif [[ "$variant" == "panel-tooltip" ]]; then
    menu_geometry=$(eval_cinnamon 'JSON.stringify((function(){var a=Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0],d=a._applet_tooltip._tooltip,p=d.get_transformed_position(),s=d.get_transformed_size();return [Math.round(p[0]),Math.round(p[1]),Math.round(s[0]),Math.round(s[1])].join(",");})())' | grep -oE '[0-9]+,[0-9]+,[0-9]+,[0-9]+' | tail -1)
elif [[ "$variant" == "panel" ]]; then
    menu_geometry='0,0,0,0'
elif [[ "$variant" == "reset" ]]; then
    menu_geometry=$(eval_cinnamon 'JSON.stringify((function(){var a=Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0],d=a._resetConfirmationDialog;if(!d||!d.dialogLayout||!d.dialogLayout.visible)throw new Error("reset dialog unavailable");var p=d.dialogLayout.get_transformed_position(),s=d.dialogLayout.get_transformed_size();return [Math.round(p[0]),Math.round(p[1]),Math.round(s[0]),Math.round(s[1])].join(",");})())' | grep -oE '[0-9]+,[0-9]+,[0-9]+,[0-9]+' | tail -1)
else
    menu_geometry=$(eval_cinnamon 'JSON.stringify((function(){var a=Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0],p=a.menu.actor.get_transformed_position(),s=a.menu.actor.get_transformed_size();return [Math.round(p[0]),Math.round(p[1]),Math.round(s[0]),Math.round(s[1])].join(",");})())' | grep -oE '[0-9]+,[0-9]+,[0-9]+,[0-9]+' | tail -1)
fi
printf '%s\n' "$menu_geometry" >"$geometry_file"
printf 'private-menu=%s variant=%s\n' "$menu_geometry" "$variant"

if [[ -n "$panel_geometry_file" ]]; then
    panel_geometry=$(eval_cinnamon 'JSON.stringify((function(){var a=Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0],p=a.panel.actor.get_transformed_position(),s=a.panel.actor.get_transformed_size(),q=a.actor.get_transformed_position(),t=a.actor.get_transformed_size();return [Math.round(p[0]),Math.round(p[1]),Math.round(s[0]),Math.round(s[1]),Math.round(q[0]),Math.round(q[1]),Math.round(t[0]),Math.round(t[1])].join(",");})())' | grep -oE '[0-9]+,[0-9]+,[0-9]+,[0-9]+,[0-9]+,[0-9]+,[0-9]+,[0-9]+' | tail -1)
    printf '%s\n' "$panel_geometry" >"$panel_geometry_file"
    printf 'private-panel=%s\n' "$panel_geometry"
fi

# Keep Cinnamon alive until run-isolated.sh takes its single root frame.
sleep 12
