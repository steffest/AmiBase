import ui from "./ui/ui.js";
var Input = function(){
    var me = {};
    let keyBoardRelayTarget;

    me.init = function(){
        document.body.addEventListener("keydown",function(e){

            setMetaKeys(e);
            let modal = ui.getModal();
            if (modal){
                if (e.code === "Escape"){
                    modal.close();
                    e.preventDefault();
                    e.stopPropagation();
                }
                if (e.code === "Enter"){
                    modal.commit();
                    e.preventDefault();
                    e.stopPropagation();
                }
            }

            if (keyBoardRelayTarget && keyBoardRelayTarget.postMessage){
                keyBoardRelayTarget.postMessage({
                    command: 'key',
                    down: true,
                    key: e.key,
                    code: e.code,
                    keyCode: e.keyCode,
                },"*");
            }
        });

        document.body.addEventListener("keyup",function(e){
            setMetaKeys(e);

            if (keyBoardRelayTarget && keyBoardRelayTarget.postMessage){
                keyBoardRelayTarget.postMessage({
                    command: 'key',
                    down: false,
                    key: e.key,
                    code: e.code,
                    keyCode: e.keyCode,
                },"*");
            }
        });
    };

    me.setKeyBoardRelayTarget = function(target){
        keyBoardRelayTarget = target;
    }

    function setMetaKeys(e){
        me.isShiftDown = !! e.shiftKey;
        me.isAltDown = !! e.altKey;
        me.isCtrlDown = !! e.ctrlKey;
        me.isMetaDown = !! e.metaKey;
    }

    return me;
};

export default Input();