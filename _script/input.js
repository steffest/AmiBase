import ui from "./ui/ui.js";
var Input = function(){
    var me = {};
    let keyBoardRelayTarget;
    let keyHandlers = {};

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

           for (let handler in keyHandlers){
                keyHandlers[handler](e,true);
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

            for (let handler in keyHandlers){
                keyHandlers[handler](e,false);
            }
        });
    };

    me.setKeyBoardRelayTarget = function(target){
        keyBoardRelayTarget = target;
    }

    me.registerKeyHandler = function(windowId,handler){
        keyHandlers[windowId] = handler;
    }

    me.releaseKeyHandler = function(windowId){
        delete keyHandlers[windowId];
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