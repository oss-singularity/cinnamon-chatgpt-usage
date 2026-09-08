#!/usr/bin/env bash
# Sourced by the private capture driver; never run on the live session bus.

gsettings set org.cinnamon.desktop.notifications notification-duration 1
eval_cinnamon 'JSON.stringify((function(){var a=Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0],p=a.panel,uuid="notifications@cinnamon.org";Main.AppletManager.definitions.push({panelId:p.panelId,orientation:Main.AppletManager.setOrientationForPanel(p.panelPosition),location_label:"right",center:false,order:12,uuid:uuid,real_uuid:uuid,applet_id:"9002",applet:null});imports.ui.extension.loadExtension(uuid,imports.ui.extension.Type.APPLET);return true;})())' >/dev/null
for _ in {1..50}; do
    if eval_cinnamon 'String(Main.AppletManager.getRunningInstancesForUuid("notifications@cinnamon.org").length>0)' | grep -q true; then break; fi
    sleep 0.2
done
sleep 1
for event in warning critical reset; do
    event_code='JSON.stringify((function(){var a=Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0];function s(value,reset){return {limits:[{id:"codex",label:"Codex QA",windows:[{durationMinutes:"EVENT"==="reset"?10080:300,remainingPercent:value,resetsAt:reset}]}]};}var before=s("EVENT"==="warning"?40:20,100000),after=s("EVENT"==="warning"?25:"EVENT"==="critical"?10:100,"EVENT"==="reset"?200000:100000);a._showUsageNotifications(before,after);a._showUsageNotifications(after,after);return true;})())'
    eval_cinnamon "${event_code//EVENT/$event}" >/dev/null
    # Allow the normal banner timeout and animation to complete.
    sleep 3
done
retained=$(eval_cinnamon 'JSON.stringify((function(){var c=Main.AppletManager.getRunningInstancesForUuid("notifications@cinnamon.org")[0];return {retained:c.notifications.length,normal:c.notifications.every(function(n){return !n.isTransient&&!n._destroyed;}),ignoresTransient:c.ignoreTransientNotifications,bannerGone:Main.messageTray._notification===null};})())')
printf 'notification-retention=%s\n' "$retained"
if ! eval_cinnamon 'String((function(){var c=Main.AppletManager.getRunningInstancesForUuid("notifications@cinnamon.org")[0];return c.notifications.length===3&&c.notifications.every(function(n){return !n.isTransient&&!n._destroyed;})&&c.ignoreTransientNotifications&&Main.messageTray._notification===null;})())' | grep -qE "['\"]true['\"]"; then
    printf 'Notifications were not retained after their banner timeout\n' >&2
    exit 1
fi
eval_cinnamon 'Main.AppletManager.getRunningInstancesForUuid("notifications@cinnamon.org")[0].menu.open(false)' >/dev/null
sleep 0.5
eval_cinnamon 'JSON.stringify((function(){var c=Main.AppletManager.getRunningInstancesForUuid("notifications@cinnamon.org")[0],p=c.menu.actor.get_transformed_position(),s=c.menu.actor.get_transformed_size();return [Math.round(p[0]),Math.round(p[1]),Math.round(s[0]),Math.round(s[1])].join(",");})())' | grep -oE '[0-9]+,[0-9]+,[0-9]+,[0-9]+' | tail -1 > "$QA_NOTIFICATION_GEOMETRY"
