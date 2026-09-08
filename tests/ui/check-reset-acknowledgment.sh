#!/usr/bin/env bash
# Sourced only by the isolated reset capture. Dispatch is replaced by a counter.

reset_assert() {
    if ! eval_cinnamon "String((function(){var a=Main.AppletManager.getRunningInstancesForUuid(\"chatgpt-usage@oss-singularity\")[0];return $1;})())" | grep -qE "['\"]true['\"]"; then
        printf 'Reset acknowledgment regression: %s\n' "$2" >&2
        exit 1
    fi
}
eval_cinnamon 'JSON.stringify((function(){var a=Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0];a._qaResetDispatches=0;a._consumeResetCredit=function(details,dialog,content,buttons){this._qaResetDispatches++;this._resetConsumeBusy=true;this._setResetConfirmationBusy(dialog,content,buttons);};return true;})())' >/dev/null
reset_assert '!a._resetConfirmationDialog.contentLayout.get_children()[1].checked&&!a._resetConfirmationDialog.buttonLayout.get_children()[1].reactive' 'initial dialog is not locked'
xdotool key Return
sleep 0.2
reset_assert 'a._resetConfirmationDialog===null&&a._qaResetDispatches===0' 'Enter must cancel without consuming'
eval_cinnamon 'Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0]._showResetConfirmation()' >/dev/null
sleep 0.3
eval_cinnamon 'JSON.stringify((function(){var d=Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0]._resetConfirmationDialog;d.buttonLayout.get_children()[1].emit("clicked",1);d.contentLayout.get_children()[1].grab_key_focus();return true;})())' >/dev/null
reset_assert 'a._qaResetDispatches===0' 'unchecked click reached dispatch'
xdotool key space
sleep 0.2
reset_assert 'a._resetConfirmationDialog.contentLayout.get_children()[1].checked&&a._resetConfirmationDialog.buttonLayout.get_children()[1].reactive' 'Space did not enable reset'
xdotool key space
sleep 0.2
reset_assert '!a._resetConfirmationDialog.contentLayout.get_children()[1].checked&&!a._resetConfirmationDialog.buttonLayout.get_children()[1].reactive' 'Space did not relock reset'
xdotool key space
xdotool key Escape
sleep 0.2
reset_assert 'a._resetConfirmationDialog===null&&a._qaResetDispatches===0' 'Escape did not cancel safely'
eval_cinnamon 'Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0]._showResetConfirmation()' >/dev/null
sleep 0.3
reset_assert '!a._resetConfirmationDialog.contentLayout.get_children()[1].checked' 'reopening retained acknowledgment'
eval_cinnamon 'JSON.stringify((function(){var a=Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0],d=a._resetConfirmationDialog;d.contentLayout.get_children()[1].checked=true;d.buttonLayout.get_children()[1].emit("clicked",1);d.buttonLayout.get_children()[1].emit("clicked",1);return true;})())' >/dev/null
reset_assert 'a._qaResetDispatches===1&&!a._resetConfirmationDialog.contentLayout.get_children()[1].reactive&&!a._resetConfirmationDialog.buttonLayout.get_children()[1].reactive' 'checked dispatch or double-click guard failed'
eval_cinnamon 'JSON.stringify((function(){var a=Main.AppletManager.getRunningInstancesForUuid("chatgpt-usage@oss-singularity")[0];a._resetConsumeBusy=false;a._showResetConfirmation();a._resetConfirmationDialog.contentLayout.get_children()[1].checked=true;return true;})())' >/dev/null
printf 'Reset acknowledgment: native Enter, Space, Escape, reopen and fake-only single dispatch passed\n'
sleep 3
